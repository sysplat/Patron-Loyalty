import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CUSTOMER_IMPORT_MAX_BYTES,
  CUSTOMER_IMPORT_MAX_ROWS,
  customerImportRowSchema,
  parseCustomerImportConsent,
  type CustomerImportResult,
  type CustomerImportRow,
  type CustomerImportRowResult,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from '../loyalty/loyalty-account.service';
import {
  customerPhoneOr,
  mergeCustomerMetadata,
  parseCustomerMetadata,
} from './customer-contact.util';
import { csvRowsToObjects, parseCsvText } from './customer-import-csv.util';

function importErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return 'A patron with this email, phone, or external_id already exists';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Import failed';
}
@Injectable()
export class CustomerImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    @Inject(forwardRef(() => LoyaltyAccountService))
    private readonly accounts: LoyaltyAccountService,
  ) {}

  async importCsv(orgId: string, file: { buffer?: Buffer; size?: number; originalname?: string }) {
    await this.patronCrmFeature.requireEnabled(orgId);

    const size = file.size ?? file.buffer?.byteLength ?? 0;
    if (!file.buffer || size === 0) {
      throw new BadRequestException('Upload a CSV file');
    }
    if (size > CUSTOMER_IMPORT_MAX_BYTES) {
      throw new BadRequestException(
        `CSV is too large (max ${Math.floor(CUSTOMER_IMPORT_MAX_BYTES / (1024 * 1024))}MB)`,
      );
    }

    const text = file.buffer.toString('utf8');
    const matrix = parseCsvText(text);
    if (matrix.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row');
    }

    const { records } = csvRowsToObjects(matrix);
    if (records.length === 0) {
      throw new BadRequestException('CSV has no data rows');
    }
    if (records.length > CUSTOMER_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `CSV has ${records.length} rows; maximum is ${CUSTOMER_IMPORT_MAX_ROWS} per upload`,
      );
    }

    const seenKeys = new Set<string>();
    const rowResults: CustomerImportRowResult[] = [];
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const { rowNumber, record: raw } of records) {
      const result = await this.importOneRow(orgId, rowNumber, raw, seenKeys);
      rowResults.push(result);
      if (result.status === 'created') created += 1;
      else if (result.status === 'updated') updated += 1;
      else errors += 1;
    }

    const summary: CustomerImportResult = {
      created,
      updated,
      errors,
      rows: rowResults,
    };
    return summary;
  }

  private async importOneRow(
    orgId: string,
    rowNumber: number,
    raw: Record<string, string>,
    seenKeys: Set<string>,
  ): Promise<CustomerImportRowResult> {
    const withConsent = {
      ...raw,
      marketingSmsConsent: parseCustomerImportConsent(raw.marketingSmsConsent),
      marketingEmailConsent: parseCustomerImportConsent(raw.marketingEmailConsent),
    };

    const parsed = customerImportRowSchema.safeParse(withConsent);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid row';
      return { row: rowNumber, status: 'error', error: message };
    }

    const data = parsed.data;
    const dupKey = this.fileDupKey(data);
    if (dupKey) {
      for (const key of dupKey) {
        if (seenKeys.has(key)) {
          return {
            row: rowNumber,
            status: 'error',
            error: 'Duplicate identity within this CSV file',
          };
        }
      }
      for (const key of dupKey) seenKeys.add(key);
    }

    try {
      const existing = await this.resolveMatch(orgId, data);
      if (existing) {
        await this.applyUpdate(orgId, existing.id, existing.metadata, data);
        await this.accounts.ensureAccount(orgId, existing.id);
        return { row: rowNumber, status: 'updated', customerId: existing.id };
      }

      const customerId = await this.createPatron(orgId, data);
      await this.accounts.ensureAccount(orgId, customerId);
      if (data.openingPoints && data.openingPoints > 0) {
        await this.accounts.adjustPoints(
          orgId,
          customerId,
          data.openingPoints,
          'CSV import opening balance',
        );
      }
      return { row: rowNumber, status: 'created', customerId };
    } catch (err) {
      return { row: rowNumber, status: 'error', error: importErrorMessage(err) };
    }
  }

  private fileDupKey(data: CustomerImportRow): string[] {
    const keys: string[] = [];
    if (data.externalId) keys.push(`ext:${data.externalId.toLowerCase()}`);
    if (data.email) keys.push(`email:${data.email}`);
    if (data.phone) keys.push(`phone:${data.phone}`);
    return keys;
  }

  private async resolveMatch(orgId: string, data: CustomerImportRow) {
    return this.prisma.withTenant(orgId, async (tx) => {
      if (data.externalId) {
        const byExt = await tx.customer.findFirst({
          where: { orgId, externalId: data.externalId },
        });
        if (byExt) return byExt;
      }
      if (data.email) {
        const byEmail = await tx.customer.findFirst({
          where: { orgId, email: data.email },
        });
        if (byEmail) return byEmail;
      }
      if (data.phone) {
        const phoneOr = customerPhoneOr(data.phone);
        if (phoneOr.length > 0) {
          const byPhone = await tx.customer.findFirst({
            where: { orgId, OR: phoneOr },
          });
          if (byPhone) return byPhone;
        }
      }
      return null;
    });
  }

  private async createPatron(orgId: string, data: CustomerImportRow): Promise<string> {
    const marketingSms =
      data.marketingSmsConsent === true
        ? 'GRANTED'
        : data.marketingSmsConsent === false
          ? 'REVOKED'
          : 'REVOKED';
    const marketingEmail =
      data.marketingEmailConsent === true
        ? 'GRANTED'
        : data.marketingEmailConsent === false
          ? 'REVOKED'
          : 'REVOKED';

    const metadata = mergeCustomerMetadata(null, {
      tags: data.tags,
      notes: data.notes,
      externalId: data.externalId,
    });

    const created = await this.prisma.withTenant(orgId, (tx) =>
      tx.customer.create({
        data: {
          orgId,
          name: data.name,
          email: data.email ?? null,
          phone: data.phone ?? null,
          externalId: data.externalId ?? null,
          birthday: data.birthday ? new Date(`${data.birthday}T00:00:00.000Z`) : null,
          gender: data.gender ?? null,
          addressLine1: data.addressLine1 ?? null,
          city: data.city ?? null,
          region: data.region ?? null,
          postalCode: data.postalCode ?? null,
          country: data.country ?? null,
          marketingSmsConsent: marketingSms,
          marketingEmailConsent: marketingEmail,
          marketingConsentSource: 'csv_import',
          metadata: metadata as Prisma.InputJsonValue,
        },
        select: { id: true },
      }),
    );
    return created.id;
  }

  private async applyUpdate(
    orgId: string,
    customerId: string,
    existingMetadata: unknown,
    data: CustomerImportRow,
  ) {
    const parsedMeta = parseCustomerMetadata(existingMetadata);
    const metadata = mergeCustomerMetadata(existingMetadata, {
      tags: data.tags ?? parsedMeta.tags,
      notes: data.notes ?? parsedMeta.notes,
      externalId: data.externalId ?? parsedMeta.externalId,
    });

    const consentPatch: {
      marketingSmsConsent?: string;
      marketingEmailConsent?: string;
      marketingConsentSource?: string;
    } = {};
    if (data.marketingSmsConsent === true) {
      consentPatch.marketingSmsConsent = 'GRANTED';
      consentPatch.marketingConsentSource = 'csv_import';
    } else if (data.marketingSmsConsent === false) {
      consentPatch.marketingSmsConsent = 'REVOKED';
      consentPatch.marketingConsentSource = 'csv_import';
    }
    if (data.marketingEmailConsent === true) {
      consentPatch.marketingEmailConsent = 'GRANTED';
      consentPatch.marketingConsentSource = 'csv_import';
    } else if (data.marketingEmailConsent === false) {
      consentPatch.marketingEmailConsent = 'REVOKED';
      consentPatch.marketingConsentSource = 'csv_import';
    }

    await this.prisma.withTenant(orgId, (tx) =>
      tx.customer.update({
        where: { id: customerId },
        data: {
          name: data.name,
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
          ...(data.birthday !== undefined
            ? { birthday: new Date(`${data.birthday}T00:00:00.000Z`) }
            : {}),
          ...(data.gender !== undefined ? { gender: data.gender } : {}),
          ...(data.addressLine1 !== undefined ? { addressLine1: data.addressLine1 } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.region !== undefined ? { region: data.region } : {}),
          ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
          ...(data.country !== undefined ? { country: data.country } : {}),
          ...consentPatch,
          metadata: metadata as Prisma.InputJsonValue,
        },
      }),
    );
  }
}
