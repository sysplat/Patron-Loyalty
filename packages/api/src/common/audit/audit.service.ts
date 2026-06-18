import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../request-context/request-context.service';

interface ActivityLogInput {
  orgId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  userId?: string | null;
  metadata?: Prisma.InputJsonObject;
}

interface AuditLogInput {
  orgId: string;
  action: string;
  tableName: string;
  recordId: string;
  userId?: string | null;
  oldValues?: Prisma.InputJsonObject;
  newValues?: Prisma.InputJsonObject;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly config: ConfigService,
  ) {}

  async logActivity(input: ActivityLogInput): Promise<void> {
    const context = this.requestContext.getContext();

    try {
      await this.prisma.withTenant(input.orgId, (tx) =>
        tx.activityLog.create({
          data: {
            orgId: input.orgId,
            userId: input.userId ?? null,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId ?? null,
            metadata: this.withRequestContext(input.metadata, context?.requestId),
            ipAddress: context?.ip,
            userAgent: context?.userAgent,
          },
        }),
      );
      this.exportImmutableAudit('activity', {
        orgId: input.orgId,
        userId: input.userId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? {},
        requestId: context?.requestId ?? null,
        ipAddress: context?.ip ?? null,
        userAgent: context?.userAgent ?? null,
        occurredAt: new Date().toISOString(),
      }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown immutable export failure';
        this.logger.warn(`Failed immutable activity export: ${message}`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown audit activity failure';
      this.logger.error(`Failed to write activity log: ${message}`);
    }
  }

  async logAudit(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.withTenant(input.orgId, (tx) =>
        tx.auditLog.create({
          data: {
            orgId: input.orgId,
            userId: input.userId ?? null,
            action: input.action,
            tableName: input.tableName,
            recordId: input.recordId,
            oldValues: this.withRequestContext(input.oldValues),
            newValues: this.withRequestContext(input.newValues),
          },
        }),
      );
      this.exportImmutableAudit('audit', {
        orgId: input.orgId,
        userId: input.userId ?? null,
        action: input.action,
        tableName: input.tableName,
        recordId: input.recordId,
        oldValues: input.oldValues ?? {},
        newValues: input.newValues ?? {},
        occurredAt: new Date().toISOString(),
      }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown immutable export failure';
        this.logger.warn(`Failed immutable audit export: ${message}`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown audit record failure';
      this.logger.error(`Failed to write audit log: ${message}`);
    }
  }

  private withRequestContext(
    value?: Prisma.InputJsonObject,
    requestId = this.requestContext.getRequestId(),
  ): Prisma.InputJsonObject | undefined {
    if (!value && !requestId) {
      return undefined;
    }

    return {
      ...(value ?? {}),
      ...(requestId ? { requestId } : {}),
    };
  }

  private async exportImmutableAudit(
    kind: 'activity' | 'audit',
    payload: Record<string, unknown>,
  ): Promise<void> {
    const url = this.config.get<string>('IMMUTABLE_AUDIT_WEBHOOK_URL');
    if (!url) return;
    const secret = this.config.get<string>('IMMUTABLE_AUDIT_WEBHOOK_SECRET');
    const body = JSON.stringify({ kind, payload, source: 'queueplatform-api' });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      headers['X-QueuePlatform-Signature'] = createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    if (!response.ok) {
      throw new Error(`Sink responded with HTTP ${response.status}`);
    }
  }
}
