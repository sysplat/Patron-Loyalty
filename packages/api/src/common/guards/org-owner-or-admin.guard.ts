import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { userIsOrganizationOwnerOrAdmin } from '../rbac/org-owner.util';
import {
  impersonationSimulatesOwnerOrAdmin,
  isFullImpersonationBypass,
} from '../rbac/impersonation-rbac.util';

/**
 * Restricts a route to the organization owner or admin (not manager/staff/viewer).
 * Use with @UseGuards(OrgOwnerOrAdminGuard) on owner/admin-only endpoints.
 */
@Injectable()
export class OrgOwnerOrAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.userId || !user?.orgId) {
      throw new ForbiddenException('Authentication required');
    }

    if (isFullImpersonationBypass(user)) {
      return true;
    }

    if (user.impersonation === true && user.actAsRole) {
      if (impersonationSimulatesOwnerOrAdmin(user)) {
        return true;
      }
      throw new ForbiddenException('Only the organization owner or admin may perform this action.');
    }

    const isOwnerOrAdmin = await userIsOrganizationOwnerOrAdmin(
      this.prisma,
      user.orgId,
      user.userId,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Only the organization owner or admin may perform this action.');
    }

    return true;
  }
}
