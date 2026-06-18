import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../request-context/request-context.service';

export type PlatformAuditSeverity = 'info' | 'warning' | 'critical';

@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async log(input: {
    actorUserId?: string | null;
    actorEmail?: string | null;
    eventType: string;
    severity?: PlatformAuditSeverity;
    subjectOrgId?: string | null;
    metadata?: Prisma.InputJsonObject;
  }): Promise<void> {
    const ctx = this.requestContext.getContext();
    try {
      await this.prisma.platformAuditEvent.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          actorEmail: input.actorEmail ?? null,
          eventType: input.eventType,
          severity: input.severity ?? 'info',
          subjectOrgId: input.subjectOrgId ?? null,
          metadata: this.withRequestContext(input.metadata, ctx?.requestId),
          ipAddress: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`platform audit write failed: ${msg}`);
    }
  }

  private withRequestContext(
    metadata: Prisma.InputJsonObject | undefined,
    requestId: string | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (!metadata && !requestId) return undefined;
    const base = (metadata ?? {}) as Record<string, unknown>;
    if (requestId) base.requestId = requestId;
    return base as Prisma.InputJsonValue;
  }
}
