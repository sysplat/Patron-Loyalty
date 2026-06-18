import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { actorMayAssignRoles, SYSTEM_ROLES } from '@queueplatform/shared';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { userIsOrganizationSupervisor } from '../../common/rbac/org-owner.util';
import { resolveUserHighestSystemRole } from '../../common/rbac/role-assignment-authorization';
import { PrismaService } from '../../prisma/prisma.service';

export type DeskListOptions = {
  branchId?: string;
  /** When set, non-supervisors with desk assignments only see assigned desks (per-branch “open pool” when none). */
  viewerUserId?: string;
};

/**
 * Manages service desks within branches (physical stations / desk numbers).
 * Desk assignment lists which staff or viewer accounts are limited to serving at those desks.
 */
@Injectable()
export class DeskService {
  constructor(private readonly prisma: PrismaService) {}

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  private noDeskAssignmentMessage(branchId?: string): string {
    return branchId
      ? 'You do not have any desk assignments in this branch. Ask a manager to assign at least one desk before serving customers here.'
      : 'You do not have any desk assignments. Ask a manager to assign at least one desk before serving customers.';
  }

  /**
   * Optional visibility constraint: staff/viewer only see desks they are assigned to in this scope.
   * Supervisors bypass this filter.
   */
  private async deskVisibilityFilter(
    orgId: string,
    viewerUserId: string | undefined,
    branchId: string | undefined,
  ): Promise<Prisma.DeskWhereInput | undefined> {
    if (!viewerUserId) return undefined;
    if (await userIsOrganizationSupervisor(this.prisma, orgId, viewerUserId)) return undefined;

    const assignedRows = await this.withOrg(orgId, (tx) =>
      tx.desk.findMany({
        where: {
          orgId,
          ...(branchId ? { branchId } : {}),
          assignedUsers: { some: { id: viewerUserId } },
        },
        select: { id: true },
      }),
    );
    if (assignedRows.length === 0) {
      throw new ForbiddenException(this.noDeskAssignmentMessage(branchId));
    }

    return { id: { in: assignedRows.map((d) => d.id) } };
  }

  private async assertViewerMayAccessDesk(
    orgId: string,
    viewerUserId: string,
    desk: { id: string; branchId: string },
  ): Promise<void> {
    if (await userIsOrganizationSupervisor(this.prisma, orgId, viewerUserId)) return;

    const assignedInBranch = await this.withOrg(orgId, (tx) =>
      tx.desk.count({
        where: {
          orgId,
          branchId: desk.branchId,
          assignedUsers: { some: { id: viewerUserId } },
        },
      }),
    );
    if (assignedInBranch === 0) {
      throw new ForbiddenException(this.noDeskAssignmentMessage(desk.branchId));
    }

    const atThisDesk = await this.withOrg(orgId, (tx) =>
      tx.desk.count({
        where: { id: desk.id, orgId, assignedUsers: { some: { id: viewerUserId } } },
      }),
    );
    if (atThisDesk === 0) {
      throw new ForbiddenException('You do not have access to this desk.');
    }
  }

  async list(orgId: string, options?: DeskListOptions) {
    const { branchId, viewerUserId } = options ?? {};
    const visibility = await this.deskVisibilityFilter(orgId, viewerUserId, branchId);
    return this.withOrg(orgId, (tx) =>
      tx.desk.findMany({
        where: {
          orgId,
          ...(branchId ? { branchId } : {}),
          ...(visibility ?? {}),
        },
        include: {
          branch: { select: { id: true, name: true } },
          assignedUsers: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ branchId: 'asc' }, { number: 'asc' }],
      }),
    );
  }

  async getById(orgId: string, deskId: string, viewerUserId?: string) {
    const desk = await this.withOrg(orgId, (tx) =>
      tx.desk.findFirst({
        where: { id: deskId, orgId },
        include: {
          branch: { select: { id: true, name: true } },
          assignedUsers: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    );
    if (!desk) throw new NotFoundException('Desk not found');
    if (viewerUserId) {
      await this.assertViewerMayAccessDesk(orgId, viewerUserId, desk);
    }
    return desk;
  }

  async create(orgId: string, data: { branchId: string; name: string; number: string }) {
    const branch = await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.findFirst({ where: { id: data.branchId, orgId } }),
    );
    if (!branch) throw new NotFoundException('Branch not found');

    const existing = await this.withOrg(orgId, (tx) =>
      tx.desk.findFirst({
        where: { branchId: data.branchId, number: data.number },
      }),
    );
    if (existing)
      throw new ConflictException(`Desk number ${data.number} already exists in this branch`);

    return this.withOrg(orgId, (tx) =>
      tx.desk.create({
        data: {
          orgId,
          branchId: data.branchId,
          name: data.name,
          number: data.number,
          status: 'closed',
        },
      }),
    );
  }

  async update(
    orgId: string,
    deskId: string,
    data: { name?: string; status?: string; defaultStationProfileId?: string | null },
    viewerUserId?: string,
  ) {
    const deskRecord = await this.getById(orgId, deskId, viewerUserId);
    if (viewerUserId && !(await userIsOrganizationSupervisor(this.prisma, orgId, viewerUserId))) {
      const hasRestrictedFields =
        data.name !== undefined || data.defaultStationProfileId !== undefined;
      if (hasRestrictedFields) {
        throw new ForbiddenException(
          'You may only open or close desks assigned to you. Ask a supervisor to change desk settings.',
        );
      }
    }
    if (data.defaultStationProfileId) {
      const profileId = data.defaultStationProfileId;
      const profile = await this.prisma.withTenant(orgId, (tx) =>
        tx.stationProfile.findFirst({
          where: { id: profileId, orgId },
        }),
      );
      if (!profile) throw new NotFoundException('Station profile not found');
    }
    return this.withOrg(orgId, (tx) => tx.desk.update({ where: { id: deskRecord.id }, data }));
  }

  private async assertActorMayManageDeskAssignments(
    orgId: string,
    actorUserId: string,
    deskBranchId: string,
    targetUserIds: string[],
  ): Promise<void> {
    const actorRole = await resolveUserHighestSystemRole(this.prisma, orgId, actorUserId);

    const allowedBranches = await resolveAllowedBranchIds(this.prisma, orgId, actorUserId);
    if (actorRole === SYSTEM_ROLES.MANAGER) {
      const branches = allowedBranches ?? [];
      if (!branches.includes(deskBranchId)) {
        throw new ForbiddenException(
          'Managers can only assign staff on desks within their branches.',
        );
      }
    }

    if (targetUserIds.length === 0) return;

    for (const uid of targetUserIds) {
      const targetRole = await resolveUserHighestSystemRole(this.prisma, orgId, uid);
      if (targetRole !== SYSTEM_ROLES.STAFF && targetRole !== SYSTEM_ROLES.VIEWER) {
        throw new ForbiddenException(
          'Desk assignments apply only to team members with the staff or viewer role.',
        );
      }

      const inBranch = await this.withOrg(orgId, (tx) =>
        tx.roleAssignment.count({
          where: {
            userId: uid,
            branchId: deskBranchId,
            role: { orgId },
          },
        }),
      );
      if (inBranch === 0) {
        throw new ForbiddenException(
          'Assignees must belong to this branch — add a branch role assignment first.',
        );
      }

      if (actorRole === SYSTEM_ROLES.MANAGER) {
        const managed = await this.withOrg(orgId, (tx) =>
          tx.roleAssignment.findFirst({
            where: {
              userId: uid,
              branchId: deskBranchId,
              role: {
                orgId,
                isSystemRole: true,
                name: { in: [SYSTEM_ROLES.STAFF, SYSTEM_ROLES.VIEWER] },
              },
            },
          }),
        );
        if (!managed) {
          throw new ForbiddenException(
            'Managers may only attach desk scope to staff or viewer accounts.',
          );
        }
      }
    }
  }

  async assign(orgId: string, actorUserId: string, deskId: string, userIds: string[]) {
    const actorRoleForAssign = await resolveUserHighestSystemRole(this.prisma, orgId, actorUserId);
    if (!actorMayAssignRoles(actorRoleForAssign)) {
      throw new ForbiddenException('Your role cannot assign agents to desks.');
    }

    const deskRow = await this.withOrg(orgId, (tx) =>
      tx.desk.findFirst({
        where: { id: deskId, orgId },
        select: {
          id: true,
          branchId: true,
          number: true,
          name: true,
          branch: { select: { id: true, name: true } },
          assignedUsers: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    );
    if (!deskRow) throw new NotFoundException('Desk not found');

    await this.assertActorMayManageDeskAssignments(orgId, actorUserId, deskRow.branchId, userIds);

    if (userIds.length > 0) {
      const users = await this.prisma.withTenant(orgId, (tx) =>
        tx.user.findMany({
          where: { id: { in: userIds }, orgId },
        }),
      );
      if (users.length !== userIds.length) {
        throw new NotFoundException('One or more users not found');
      }
    }

    return this.withOrg(orgId, (tx) =>
      tx.desk.update({
        where: { id: deskId },
        data: {
          assignedUsers: {
            set: userIds.map((id) => ({ id })),
          },
        },
        include: {
          branch: { select: { id: true, name: true } },
          assignedUsers: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    );
  }

  async delete(orgId: string, deskId: string) {
    await this.getById(orgId, deskId);
    await this.withOrg(orgId, (tx) => tx.desk.delete({ where: { id: deskId } }));
  }
}
