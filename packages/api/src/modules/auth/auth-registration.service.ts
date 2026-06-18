import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  generateSlug,
  registerSchema,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_LOYALTY_TERMS_VERSION,
  CURRENT_LOYALTY_PRIVACY_VERSION,
  LEGAL_DOCUMENT_TYPES,
  PRODUCT_SKUS,
  LOYALTY_PLAN_SLUG,
  type ProductSku,
} from '@queueplatform/shared';
import { validateEmailExistence } from '../../common/utils/email-validator.util';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { syncSystemRolePermissions } from '../../common/rbac/system-role-permissions';
import { AuditService } from '../../common/audit/audit.service';
import { BCRYPT_ROUNDS, generateToken, sha256 } from './auth-token.util';

@Injectable()
export class AuthRegistrationService {
  private readonly logger = new Logger(AuthRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService,
  ) {}

  async register(input: {
    businessName: string;
    firstName?: string;
    lastName?: string;
    email: string;
    password: string;
    phone?: string;
    acceptLegal: boolean;
    productSku?: ProductSku;
  }) {
    // One global identity per email; org rows are memberships on `users`.
    const existingAccount = await this.prisma.account.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existingAccount) {
      throw new ConflictException('Email already registered');
    }

    // 0. Validate input
    try {
      registerSchema.parse(input);
    } catch (err) {
      if (err instanceof Error) {
        throw new BadRequestException(err.message);
      }
      throw new BadRequestException('Invalid registration data');
    }

    // 0.1 Deep email existence check (DNS MX)
    await validateEmailExistence(input.email);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const orgSlug = generateSlug(input.businessName) + '-' + uuidv4().slice(0, 6);
    const productSku: ProductSku = input.productSku ?? PRODUCT_SKUS.QMS;
    const isLoyaltyOnly = productSku === PRODUCT_SKUS.LOYALTY;
    const defaultPlanSlug = isLoyaltyOnly ? LOYALTY_PLAN_SLUG : 'free';

    // Create account + organization + owner membership in a transaction
    const result = await this.prisma.withBypassRls(
      async (tx) => {
        const account = await tx.account.create({
          data: {
            email: input.email.toLowerCase(),
            passwordHash,
            emailVerified: false,
            phone: input.phone || null,
          },
        });

        const requestContext = this.requestContext.getContext();
        const legalContext = {
          ipAddress: requestContext?.ip ?? null,
          userAgent: requestContext?.userAgent ?? null,
        };
        const legalAcceptanceRows: Array<{
          accountId: string;
          documentType: string;
          version: string;
          ipAddress: string | null;
          userAgent: string | null;
        }> = [];

        if (productSku !== PRODUCT_SKUS.LOYALTY) {
          legalAcceptanceRows.push(
            {
              accountId: account.id,
              documentType: LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE,
              version: CURRENT_TERMS_VERSION,
              ...legalContext,
            },
            {
              accountId: account.id,
              documentType: LEGAL_DOCUMENT_TYPES.PRIVACY_POLICY,
              version: CURRENT_PRIVACY_VERSION,
              ...legalContext,
            },
          );
        }
        if (productSku === PRODUCT_SKUS.LOYALTY || productSku === PRODUCT_SKUS.BUNDLE) {
          legalAcceptanceRows.push(
            {
              accountId: account.id,
              documentType: LEGAL_DOCUMENT_TYPES.LOYALTY_TERMS_OF_SERVICE,
              version: CURRENT_LOYALTY_TERMS_VERSION,
              ...legalContext,
            },
            {
              accountId: account.id,
              documentType: LEGAL_DOCUMENT_TYPES.LOYALTY_PRIVACY_POLICY,
              version: CURRENT_LOYALTY_PRIVACY_VERSION,
              ...legalContext,
            },
          );
        }

        await tx.legalAcceptance.createMany({ data: legalAcceptanceRows });

        // 1. Create organization
        const org = await tx.organization.create({
          data: {
            name: input.businessName,
            slug: orgSlug,
            productSku,
            patronCrmEnabled: isLoyaltyOnly || productSku === PRODUCT_SKUS.BUNDLE,
            onboardingStep: isLoyaltyOnly ? 'completed' : 'email_verification',
          },
        });

        // Set the current org ID in the transaction context so RLS allows subsequent inserts
        await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_org_id', ${org.id}, true)`);

        // 2. Create owner membership
        const user = await tx.user.create({
          data: {
            accountId: account.id,
            orgId: org.id,
            email: account.email,
            firstName: input.firstName || null,
            lastName: input.lastName || null,
            phone: input.phone || null,
            passwordHash,
            status: 'pending_verification',
            emailVerified: false,
          },
        });

        // 3. Create email verification record
        const verificationToken = generateToken();
        const verificationTokenHash = sha256(verificationToken);
        await tx.emailVerification.create({
          data: {
            userId: user.id,
            tokenHash: verificationTokenHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });

        // 3. Create and synchronize system roles for this org
        const systemRoles = await syncSystemRolePermissions(tx, org.id);

        // 4. Assign owner role to the registering user
        await tx.roleAssignment.create({
          data: { userId: user.id, roleId: systemRoles.owner },
        });

        // 5. Create subscription (queue free trial or loyalty starter trial)
        const plan = await tx.plan.findFirst({ where: { slug: defaultPlanSlug } });
        if (plan) {
          await tx.subscription.create({
            data: {
              orgId: org.id,
              planId: plan.id,
              status: 'trialing',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
          });
        }

        // 6. Seed default queue notification templates (QMS / bundle only)
        if (!isLoyaltyOnly) {
          await tx.notificationTemplate.createMany({
            data: [
              {
                orgId: org.id,
                type: 'ticket_created',
                channel: 'email',
                subject: 'Your Queue Ticket - {{displayNumber}}',
                body: 'Hello {{customerName}},\n\nYour ticket {{displayNumber}} has been created for {{serviceName}} at {{branchName}}.\n\nEstimated wait: {{estimatedWait}}\n\nTrack your position: {{trackingUrl}}',
                variables: JSON.parse(
                  '["displayNumber","customerName","serviceName","branchName","estimatedWait","trackingUrl"]',
                ),
              },
              {
                orgId: org.id,
                type: 'ticket_called',
                channel: 'email',
                subject: 'Your Turn! Ticket {{displayNumber}}',
                body: 'Hello {{customerName}},\n\nYour ticket {{displayNumber}} has been called. Please proceed to Desk {{counterNumber}}.\n\n{{branchName}}',
                variables: JSON.parse(
                  '["displayNumber","customerName","counterNumber","branchName"]',
                ),
              },
              {
                orgId: org.id,
                type: 'ticket_created',
                channel: 'sms',
                subject: null,
                body: 'Ticket {{displayNumber}} created for {{serviceName}}. Est. wait: {{estimatedWait}}. Track: {{trackingUrl}}',
                variables: JSON.parse(
                  '["displayNumber","serviceName","estimatedWait","trackingUrl"]',
                ),
              },
              {
                orgId: org.id,
                type: 'ticket_called',
                channel: 'sms',
                subject: null,
                body: 'Your turn! Ticket {{displayNumber}} — please proceed to Desk {{counterNumber}}.',
                variables: JSON.parse('["displayNumber","counterNumber"]'),
              },
            ],
          });
        }

        return { org, user, verificationToken, productSku };
      },
      { timeoutMs: 15000 },
    );

    // 6. Queue email verification email via BullMQ
    const verifyBase =
      result.productSku === PRODUCT_SKUS.LOYALTY
        ? this.configService.get<string>('app.loyaltyUrl') || 'http://localhost:3003'
        : this.configService.get<string>('app.appUrl') || 'http://localhost:3000';
    const verificationLink = `${verifyBase.replace(/\/$/, '')}/verify-email?token=${result.verificationToken}`;
    const productLabel = result.productSku === PRODUCT_SKUS.LOYALTY ? 'Patron Loyalty' : 'QlessQ';
    await this.notificationService
      .send(result.org.id, {
        channel: 'email',
        to: result.user.email,
        subject: `Verify your email — ${productLabel}`,
        body: [
          `Hello ${result.user.firstName || ''},`,
          '',
          `Thank you for signing up for ${productLabel}. Please click the link below to verify your email address:`,
          '',
          verificationLink,
          '',
          'This link expires in 24 hours.',
          '',
          `— The ${productLabel} Team`,
        ].join('\n'),
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to queue verification email: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });

    await this.audit.logActivity({
      orgId: result.org.id,
      userId: result.user.id,
      action: 'legal.accepted',
      resourceType: 'legal',
      metadata: {
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      },
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        orgId: result.org.id,
        emailVerified: result.user.emailVerified,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
        timezone: result.org.timezone,
        productSku: result.org.productSku,
      },
      // Note: No tokens issued until verified
      // Dev/Smoke: return token directly so the flow works without SMTP
      ...(this.configService.get<string>('EXPOSE_INVITE_TOKENS') === 'true'
        ? { verificationToken: result.verificationToken }
        : {}),
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }
}
