import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { normalizeSystemRoleName, type SystemRole } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { isPlatformOperator } from '../../common/platform-operator.util';
import { branchScopedImpersonationRole } from '../../common/rbac/impersonation-rbac.util';
import { RedisService } from '../../redis/redis.service';
import type { JwtPayload } from './jwt.strategy';

export type ImpersonationStartOptions = {
  role?: SystemRole;
  branchId?: string;
};

export type ImpersonationStartResult = {
  accessToken: string;
  expiresIn: number;
  targetOrganization: { id: string; name: string; slug: string; productSku: string };
  simulation?: {
    role: SystemRole;
    branchId: string | null;
    branchName: string | null;
  };
};

@Injectable()
export class AuthImpersonationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly platformAudit: PlatformAuditService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Issues a short-lived access JWT for a platform operator to act inside `targetOrgId`.
   * Refresh is not issued; client should keep the prior session and restore it when exiting.
   *
   * When `options.role` is omitted, the session receives full RBAC bypass (support/debug).
   * When `options.role` is set, tenant RBAC is enforced for that system role.
   */
  async startImpersonation(
    actor: { userId: string; email: string },
    targetOrgId: string,
    options?: ImpersonationStartOptions,
  ): Promise<ImpersonationStartResult> {
    const operator = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id: actor.userId },
        include: { organization: true },
      }),
    );

    if (!operator || !isPlatformOperator(actor.userId, actor.email, operator.organization.slug)) {
      throw new ForbiddenException('Only platform operators can impersonate a tenant');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: targetOrgId },
      select: { id: true, name: true, slug: true, productSku: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const simulatedRole = options?.role ? normalizeSystemRoleName(options.role) : null;
    if (options?.role && !simulatedRole) {
      throw new ForbiddenException('Invalid impersonation role');
    }

    let resolvedBranch: { id: string; name: string } | null = null;
    if (simulatedRole && branchScopedImpersonationRole(simulatedRole)) {
      if (options?.branchId) {
        resolvedBranch = await this.prisma.withTenant(targetOrgId, (tx) =>
          tx.branch.findFirst({
            where: { id: options.branchId, orgId: targetOrgId },
            select: { id: true, name: true },
          }),
        );
        if (!resolvedBranch) {
          throw new NotFoundException('Branch not found in target organization');
        }
      } else {
        resolvedBranch = await this.prisma.withTenant(targetOrgId, (tx) =>
          tx.branch.findFirst({
            where: { orgId: targetOrgId },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true },
          }),
        );
        if (!resolvedBranch) {
          throw new NotFoundException(
            'Target organization has no branches — required for branch-scoped role simulation',
          );
        }
      }
    }

    await this.platformAudit.log({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      eventType: 'platform.impersonation.start',
      severity: 'warning',
      subjectOrgId: targetOrgId,
      metadata: {
        targetOrgName: org.name,
        targetOrgSlug: org.slug,
        ...(simulatedRole
          ? {
              simulatedRole,
              simulatedBranchId: resolvedBranch?.id ?? null,
              simulatedBranchName: resolvedBranch?.name ?? null,
            }
          : { mode: 'full_access' }),
      },
    });

    const ttl = this.configService.get<number>('app.jwt.impersonationAccessTtl');
    if (ttl === undefined || ttl === null) {
      throw new Error('JWT_IMPERSONATION_TTL config is missing');
    }
    const payload: JwtPayload = {
      sub: actor.userId,
      userId: actor.userId,
      orgId: operator.orgId,
      orgSlug: operator.organization.slug,
      email: operator.email,
      imp: true,
      actAsOrgId: targetOrgId,
      jti: randomUUID(),
      ...(simulatedRole ? { actAsRole: simulatedRole } : {}),
      ...(resolvedBranch ? { actAsBranchId: resolvedBranch.id } : {}),
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: `${ttl}s` });

    return {
      accessToken,
      expiresIn: ttl,
      targetOrganization: org,
      ...(simulatedRole
        ? {
            simulation: {
              role: simulatedRole,
              branchId: resolvedBranch?.id ?? null,
              branchName: resolvedBranch?.name ?? null,
            },
          }
        : {}),
    };
  }

  /** Log end of impersonation (call with impersonation JWT still active). */
  async endImpersonationAudit(
    actor: { userId: string; email: string },
    actedOrgId: string,
    jti?: string,
  ): Promise<void> {
    await this.platformAudit.log({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      eventType: 'platform.impersonation.end',
      severity: 'info',
      subjectOrgId: actedOrgId,
      metadata: {},
    });

    if (jti) {
      const ttl = this.configService.get<number>('app.jwt.impersonationAccessTtl');
      if (ttl === undefined || ttl === null) {
        throw new Error('JWT_IMPERSONATION_TTL config is missing');
      }
      await this.redis.set(`auth:blacklist:${jti}`, '1', ttl);
    }
  }
}
