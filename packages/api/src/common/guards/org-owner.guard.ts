import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { userIsOrganizationOwner } from '../rbac/org-owner.util';
import {
  impersonationSimulatesOwner,
  isFullImpersonationBypass,
} from '../rbac/impersonation-rbac.util';

/**
 * Restricts a route to the organization owner (not admin/manager/staff).
 * Use with @UseGuards(OrgOwnerGuard) on owner-only mutations.
 */
@Injectable()
export class OrgOwnerGuard implements CanActivate {
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
      if (impersonationSimulatesOwner(user)) {
        return true;
      }
      throw new ForbiddenException('Only the organization owner may perform this action.');
    }

    const isOwner = await userIsOrganizationOwner(this.prisma, user.orgId, user.userId);
    if (!isOwner) {
      throw new ForbiddenException('Only the organization owner may perform this action.');
    }

    return true;
  }
}
