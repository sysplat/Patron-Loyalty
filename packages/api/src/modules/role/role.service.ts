import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  assertActorMayAssignRoleId,
  assertActorMayManageTargetUser,
} from '../../common/rbac/role-assignment-authorization';
import { SYSTEM_ROLES, isOwnerOrAdminSystemRole } from '@queueplatform/shared';

/**
 * Manages custom roles and permission sets within an organization.
 * Handles role creation, permission assignment, and user role mapping.
 */
@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  async list(orgId: string) {
    return this.withOrg(orgId, (tx) =>
      tx.role.findMany({
        where: { orgId },
        include: {
          rolePermissions: { include: { permission: true } },
          _count: { select: { roleAssignments: true } },
        },
        orderBy: { isSystemRole: 'desc' },
      }),
    );
  }

  async getById(orgId: string, roleId: string) {
    const role = await this.withOrg(orgId, (tx) =>
      tx.role.findFirst({
        where: { id: roleId, orgId },
        include: {
          rolePermissions: { include: { permission: true } },
          roleAssignments: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
              branch: { select: { id: true, name: true } },
            },
          },
        },
      }),
    );
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(
    orgId: string,
    actorUserId: string,
    data: { name: string; description?: string; permissionIds: string[] },
  ) {
    const existing = await this.withOrg(orgId, (tx) =>
      tx.role.findFirst({ where: { orgId, name: data.name } }),
    );
    if (existing) throw new ConflictException('Role with this name already exists');

    const created = await this.withOrg(orgId, (tx) =>
      tx.role.create({
        data: {
          orgId,
          name: data.name,
          description: data.description,
          isSystemRole: false,
          rolePermissions: {
            create: data.permissionIds.map((pid) => ({ permissionId: pid })),
          },
        },
        include: { rolePermissions: { include: { permission: true } } },
      }),
    );

    const newValues: Prisma.InputJsonObject = {
      name: created.name,
      description: created.description,
      permissionIds: created.rolePermissions.map((rolePermission) => rolePermission.permissionId),
    };

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'role.create',
      resourceType: 'role',
      resourceId: created.id,
      metadata: newValues,
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'create',
      tableName: 'roles',
      recordId: created.id,
      newValues,
    });

    return created;
  }

  async update(
    orgId: string,
    roleId: string,
    actorUserId: string,
    data: { name?: string; description?: string },
  ) {
    const role = await this.getById(orgId, roleId);
    if (role.isSystemRole) throw new BadRequestException('Cannot modify system roles');

    const updated = await this.withOrg(orgId, (tx) =>
      tx.role.update({ where: { id: roleId }, data }),
    );

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'role.update',
      resourceType: 'role',
      resourceId: roleId,
      metadata: data as Prisma.InputJsonObject,
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'update',
      tableName: 'roles',
      recordId: roleId,
      oldValues: { name: role.name, description: role.description ?? null },
      newValues: { name: updated.name, description: updated.description ?? null },
    });

    return updated;
  }

  async updatePermissions(
    orgId: string,
    roleId: string,
    actorUserId: string,
    permissionIds: string[],
  ) {
    const role = await this.getById(orgId, roleId);
    if (role.isSystemRole) throw new BadRequestException('Cannot modify system role permissions');

    const previousPermissionIds = role.rolePermissions.map(
      (rolePermission) => rolePermission.permissionId,
    );

    await this.withOrg(orgId, async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      for (const pid of permissionIds) {
        await tx.rolePermission.create({ data: { roleId, permissionId: pid } });
      }
    });

    const updatedRole = await this.getById(orgId, roleId);

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'role.permissions.update',
      resourceType: 'role',
      resourceId: roleId,
      metadata: {
        previousPermissionIds,
        permissionIds,
      },
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'update',
      tableName: 'role_permissions',
      recordId: roleId,
      oldValues: { permissionIds: previousPermissionIds },
      newValues: { permissionIds },
    });

    return updatedRole;
  }

  async assignToUser(
    orgId: string,
    actorUserId: string,
    data: { userId: string; roleId: string; branchId?: string },
  ) {
    await assertActorMayManageTargetUser(this.prisma, orgId, actorUserId, data.userId);
    await assertActorMayAssignRoleId(this.prisma, orgId, actorUserId, data.roleId);

    return this.withOrg(orgId, async (tx) => {
      const targetRole = await tx.role.findFirst({ where: { id: data.roleId, orgId } });
      if (!targetRole) throw new NotFoundException('Role not found');

      if (targetRole.isSystemRole) {
        if (isOwnerOrAdminSystemRole(targetRole.name)) {
          if (data.branchId) {
            throw new BadRequestException(
              'Organization-scoped roles (Owner, Admin) cannot be assigned to a specific branch.',
            );
          }
        } else {
          if (!data.branchId) {
            throw new BadRequestException(
              'Branch-scoped roles (Manager, Staff, Viewer) must have a branch specified.',
            );
          }
        }
      }

      const existing = await tx.roleAssignment.findFirst({
        where: { userId: data.userId, roleId: data.roleId, branchId: data.branchId ?? null },
      });
      if (existing) throw new ConflictException('User already has this role assignment');

      const assignment = await tx.roleAssignment.create({
        data: { userId: data.userId, roleId: data.roleId, branchId: data.branchId },
        include: {
          role: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
          branch: { select: { id: true, name: true } },
        },
      });

      await this.audit.logActivity({
        orgId,
        userId: actorUserId,
        action: 'role.assignment.create',
        resourceType: 'role_assignment',
        resourceId: assignment.id,
        metadata: {
          assignedUserId: assignment.user.id,
          roleId: assignment.role.id,
          branchId: assignment.branch?.id ?? null,
        },
      });

      return assignment;
    });
  }

  async removeAssignment(orgId: string, assignmentId: string, actorUserId: string) {
    await this.withOrg(orgId, async (tx) => {
      const assignment = await tx.roleAssignment.findFirst({
        where: { id: assignmentId, role: { orgId } },
        include: {
          role: { select: { id: true, name: true, isSystemRole: true } },
          user: { select: { id: true, email: true } },
        },
      });
      if (!assignment) throw new NotFoundException('Role assignment not found');
      await assertActorMayManageTargetUser(this.prisma, orgId, actorUserId, assignment.user.id);

      if (assignment.role.isSystemRole && assignment.role.name === SYSTEM_ROLES.OWNER) {
        const ownerCount = await tx.roleAssignment.count({
          where: { role: { orgId, name: SYSTEM_ROLES.OWNER, isSystemRole: true } },
        });
        if (ownerCount <= 1) {
          throw new BadRequestException(
            'Cannot remove the last organization owner. Transfer ownership first.',
          );
        }
      }

      await tx.roleAssignment.delete({ where: { id: assignmentId } });

      await this.audit.logActivity({
        orgId,
        userId: actorUserId,
        action: 'role.assignment.delete',
        resourceType: 'role_assignment',
        resourceId: assignmentId,
        metadata: {
          removedUserId: assignment.user.id,
          roleId: assignment.role.id,
        },
      });
    });
  }

  async delete(orgId: string, roleId: string, actorUserId: string) {
    const role = await this.getById(orgId, roleId);
    if (role.isSystemRole) throw new BadRequestException('Cannot delete system roles');
    if (role.roleAssignments.length > 0)
      throw new BadRequestException('Cannot delete role with active assignments');

    await this.withOrg(orgId, async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });
    });

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'role.delete',
      resourceType: 'role',
      resourceId: roleId,
      metadata: { name: role.name },
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'delete',
      tableName: 'roles',
      recordId: roleId,
      oldValues: { name: role.name, description: role.description ?? null },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }
}
