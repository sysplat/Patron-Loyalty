import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  BRANCH_SCOPED_LIST_READ_KEY,
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildSimulatedRoleAssignments,
  isFullImpersonationBypass,
  isRoleSimulationImpersonation,
} from '../rbac/impersonation-rbac.util';
import { normalizeSystemRoleName } from '@queueplatform/shared';

type PermissionScope = 'own' | 'branch' | 'org';

interface AuthorizationContext {
  /** Single branch from route/query/body when unambiguous */
  branchId: string | null;
  /** For resources attached to multiple branches (e.g. service), every linked branch id */
  resourceBranchIds: string[] | null;
  targetUserId: string | null;
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userId = user?.userId ?? user?.id ?? null;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    /** Platform operator impersonating a tenant — full dashboard access for support/debug. */
    if (isFullImpersonationBypass(user)) {
      return true;
    }

    const allowBranchScopedListRead =
      this.reflector.getAllAndOverride<boolean>(BRANCH_SCOPED_LIST_READ_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    const authContext = await this.resolveAuthorizationContext(
      request,
      requiredPermissions,
      user.orgId,
      userId,
    );

    const roleAssignments = isRoleSimulationImpersonation(user)
      ? buildSimulatedRoleAssignments(
          normalizeSystemRoleName(user.actAsRole)!,
          user.actAsBranchId ?? null,
        )
      : await this.prisma.withTenant(user.orgId, (tx) =>
          tx.roleAssignment.findMany({
            where: {
              userId,
              role: { orgId: user.orgId },
            },
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          }),
        );

    const hasAll = requiredPermissions.every((requiredPermission) =>
      roleAssignments.some((assignment) => {
        if (
          !this.isAssignmentApplicable(
            assignment.branchId,
            authContext.branchId,
            authContext.resourceBranchIds,
          )
        ) {
          return false;
        }

        return assignment.role.rolePermissions.some(({ permission }) => {
          const actionMatches =
            permission.resource === requiredPermission.resource &&
            (permission.action === requiredPermission.action || permission.action === 'manage');

          if (!actionMatches) {
            return false;
          }

          return this.isPermissionScopeSatisfied(
            permission.scope as PermissionScope,
            authContext,
            userId,
            assignment.branchId,
            requiredPermission,
            allowBranchScopedListRead,
          );
        });
      }),
    );

    if (!hasAll) {
      throw new ForbiddenException('You do not have sufficient permission for this action.');
    }

    return true;
  }

  private async resolveAuthorizationContext(
    request: {
      params?: Record<string, unknown>;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      route?: { path?: string };
    },
    requiredPermissions: RequiredPermission[],
    orgId: string,
    userId: string,
  ): Promise<AuthorizationContext> {
    const explicitBranchId = this.readString(
      request.params?.branchId,
      request.body?.branchId,
      request.query?.branchId,
    );

    const resourceId = this.readString(request.params?.id, request.body?.id, request.query?.id);

    let resourceBranchIds: string[] | null = null;
    if (resourceId && requiredPermissions.some((p) => p.resource === 'service')) {
      resourceBranchIds = await this.loadServiceBranchIds(orgId, resourceId);
    }
    if (resourceId && requiredPermissions.some((p) => p.resource === 'user')) {
      resourceBranchIds = await this.loadUserBranchIds(orgId, resourceId);
    }

    let branchId = explicitBranchId;
    if (!branchId && resourceId) {
      branchId = await this.resolveBranchIdFromResource(orgId, resourceId, requiredPermissions);
    }

    const queueIdPayload = this.readString(
      request.body?.queueId,
      request.query?.queueId,
      request.params?.queueId,
    );
    if (!branchId && queueIdPayload && requiredPermissions.some((p) => p.resource === 'ticket')) {
      const queue = await this.prisma.withTenant(orgId, (tx) =>
        tx.queue.findFirst({
          where: { id: queueIdPayload, orgId },
          select: { branchId: true },
        }),
      );
      if (queue) {
        branchId = queue.branchId;
      }
    }

    const ticketIdPayload = this.readString(request.body?.ticketId, request.query?.ticketId);
    if (!branchId && ticketIdPayload && requiredPermissions.some((p) => p.resource === 'ticket')) {
      const ticket = await this.prisma.withTenant(orgId, (tx) =>
        tx.ticket.findFirst({
          where: { id: ticketIdPayload, orgId },
          select: { branchId: true },
        }),
      );
      if (ticket) {
        branchId = ticket.branchId;
      }
    }

    return {
      branchId,
      resourceBranchIds,
      targetUserId: this.extractTargetUserId(request, requiredPermissions, userId),
    };
  }

  private async loadUserBranchIds(orgId: string, targetUserId: string): Promise<string[] | null> {
    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.roleAssignment.findMany({
        where: { userId: targetUserId, role: { orgId } },
        select: { branchId: true },
      }),
    );
    const ids = [...new Set(rows.map((r) => r.branchId).filter((id): id is string => Boolean(id)))];
    const exists = await this.prisma.withTenant(orgId, (tx) =>
      tx.user.findFirst({
        where: { id: targetUserId, orgId },
        select: { id: true },
      }),
    );
    if (!exists) {
      return null;
    }
    return ids;
  }

  private async loadServiceBranchIds(orgId: string, serviceId: string): Promise<string[] | null> {
    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.branchService.findMany({
        where: { serviceId, branch: { orgId } },
        select: { branchId: true },
      }),
    );
    if (rows.length === 0) {
      const exists = await this.prisma.withTenant(orgId, (tx) =>
        tx.service.findFirst({
          where: { id: serviceId, orgId },
          select: { id: true },
        }),
      );
      return exists ? [] : null;
    }
    return rows.map((row) => row.branchId);
  }

  private extractTargetUserId(
    request: {
      params?: Record<string, unknown>;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      route?: { path?: string };
    },
    requiredPermissions: RequiredPermission[],
    userId: string,
  ): string | null {
    const explicitUserId = this.readString(
      request.params?.userId,
      request.body?.userId,
      request.query?.userId,
      request.body?.assignedUserId,
      request.query?.assignedUserId,
    );

    if (explicitUserId) {
      return explicitUserId;
    }

    const isUserRoute =
      requiredPermissions.some((permission) => permission.resource === 'user') ||
      request.route?.path === 'me';

    if (isUserRoute) {
      return this.readString(request.params?.id) ?? userId;
    }

    return null;
  }

  private async resolveBranchIdFromResource(
    orgId: string,
    resourceId: string,
    requiredPermissions: RequiredPermission[],
  ): Promise<string | null> {
    for (const permission of requiredPermissions) {
      switch (permission.resource) {
        case 'branch': {
          const branch = await this.prisma.withTenant(orgId, (tx) =>
            tx.branch.findFirst({
              where: { id: resourceId, orgId },
              select: { id: true },
            }),
          );
          if (branch) {
            return branch.id;
          }
          break;
        }
        case 'queue': {
          const queue = await this.prisma.withTenant(orgId, (tx) =>
            tx.queue.findFirst({
              where: { id: resourceId, orgId },
              select: { branchId: true },
            }),
          );
          if (queue) {
            return queue.branchId;
          }
          const template = await this.prisma.withTenant(orgId, (tx) =>
            tx.branchFlowTemplate.findFirst({
              where: { id: resourceId, orgId },
              select: { branchId: true },
            }),
          );
          if (template) {
            return template.branchId;
          }
          break;
        }
        case 'ticket': {
          const ticket = await this.prisma.withTenant(orgId, (tx) =>
            tx.ticket.findFirst({
              where: { id: resourceId, orgId },
              select: { branchId: true },
            }),
          );
          if (ticket) {
            return ticket.branchId;
          }
          break;
        }
        case 'appointment': {
          const appointment = await this.prisma.withTenant(orgId, (tx) =>
            tx.appointment.findFirst({
              where: { id: resourceId, orgId },
              select: { branchId: true },
            }),
          );
          if (appointment) {
            return appointment.branchId;
          }
          break;
        }
        case 'desk': {
          const desk = await this.prisma.withTenant(orgId, (tx) =>
            tx.desk.findFirst({
              where: { id: resourceId, orgId },
              select: { branchId: true },
            }),
          );
          if (desk) {
            return desk.branchId;
          }
          break;
        }
        case 'display': {
          const displayDevice = await this.prisma.withTenant(orgId, (tx) =>
            tx.displayDevice.findFirst({
              where: { id: resourceId, orgId },
              select: { branchId: true },
            }),
          );
          if (displayDevice) {
            return displayDevice.branchId ?? null;
          }
          break;
        }
        case 'announcement': {
          const announcement = await this.prisma.withTenant(orgId, (tx) =>
            tx.announcement.findFirst({
              where: { id: resourceId, orgId },
              select: { branchId: true },
            }),
          );
          if (announcement) {
            return announcement.branchId ?? null;
          }
          break;
        }
        default:
          break;
      }
    }

    return null;
  }

  /**
   * Org-wide assignments (branchId null) apply to any branch context.
   * Branch-scoped assignments must match the request branch, or intersect service branch links.
   */
  private isAssignmentApplicable(
    assignmentBranchId: string | null,
    requestBranchId: string | null,
    resourceBranchIds: string[] | null,
  ): boolean {
    if (!assignmentBranchId) {
      return true;
    }

    if (resourceBranchIds && resourceBranchIds.length > 0) {
      return Array.isArray(resourceBranchIds) && resourceBranchIds.includes(assignmentBranchId);
    }

    if (requestBranchId) {
      return requestBranchId === assignmentBranchId;
    }

    // No explicit branch on the request and no multi-branch resource link (e.g. org-wide
    // announcement). Branch assignments still participate; services and detail resolvers
    // enforce which rows are visible.
    return true;
  }

  private isPermissionScopeSatisfied(
    scope: PermissionScope,
    context: AuthorizationContext,
    currentUserId: string,
    assignmentBranchId: string | null,
    requiredPermission: RequiredPermission,
    allowBranchScopedListRead: boolean,
  ): boolean {
    switch (scope) {
      case 'org':
        if (assignmentBranchId !== null) {
          const branchScopedResources = [
            'branch',
            'service',
            'queue',
            'ticket',
            'appointment',
            'desk',
            'announcement',
            'display',
            'review',
            'customer',
            'station_profile',
          ];
          return branchScopedResources.includes(requiredPermission.resource);
        }
        return true;
      case 'branch': {
        if (context.branchId) {
          return true;
        }
        if (context.resourceBranchIds && context.resourceBranchIds.length > 0) {
          return true;
        }
        if (
          allowBranchScopedListRead &&
          requiredPermission.action === 'read' &&
          assignmentBranchId !== null
        ) {
          return true;
        }
        return false;
      }
      case 'own':
        return Boolean(context.targetUserId) && context.targetUserId === currentUserId;
      default:
        return false;
    }
  }

  private readString(...values: Array<unknown>): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return null;
  }
}
