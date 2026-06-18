import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { Request } from 'express';

export const SKIP_APPOINTMENT_FEATURE_GUARD_KEY = 'skipAppointmentFeatureGuard';
export const SkipAppointmentFeatureGuard = () =>
  SetMetadata(SKIP_APPOINTMENT_FEATURE_GUARD_KEY, true);

@Injectable()
export class AppointmentFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipGuard = this.reflector.getAllAndOverride<boolean>(
      SKIP_APPOINTMENT_FEATURE_GUARD_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipGuard) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Resolve orgId. For authenticated routes, user.orgId is populated.
    // For public routes (like booking/slots), branchId is passed as a query param.
    let orgId: string | undefined;

    if (request.user && (request.user as any).orgId) {
      orgId = (request.user as any).orgId;
    } else if (request.query.branchId) {
      const branchId = Array.isArray(request.query.branchId)
        ? request.query.branchId[0]
        : request.query.branchId;

      if (typeof branchId === 'string') {
        const cacheKey = `branch-org:${branchId}`;
        const cachedOrgId = await this.redis.get(cacheKey);

        if (cachedOrgId) {
          orgId = cachedOrgId;
        } else {
          const branch = await this.prisma.withBypassRls(async (tx) => {
            return tx.branch.findUnique({
              where: { id: branchId },
              select: { orgId: true },
            });
          });

          if (branch) {
            orgId = branch.orgId;
            await this.redis.set(cacheKey, orgId, 3600); // cache branch -> org mapping for 1 hour
          }
        }
      }
    }

    if (!orgId) {
      // If we can't determine the orgId (e.g., malformed request), let the underlying validation/guards handle it
      return true;
    }

    const isEnabled = await this.isAppointmentsEnabled(orgId);

    if (!isEnabled) {
      throw new ForbiddenException('appointments_not_enabled');
    }

    return true;
  }

  private async isAppointmentsEnabled(orgId: string): Promise<boolean> {
    const cacheKey = `feature:appointmentsEnabled:${orgId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached !== null) {
      return cached === 'true';
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { appointmentsEnabled: true },
    });

    const isEnabled = org?.appointmentsEnabled ?? false;
    await this.redis.set(cacheKey, String(isEnabled), 300); // 5 min cache

    return isEnabled;
  }
}
