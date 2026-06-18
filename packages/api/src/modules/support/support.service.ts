import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_SUPPORT_EMAIL, SYSTEM_ROLES } from '@queueplatform/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SUPPORT_EVENTS,
  SupportTicketCreatedEvent,
  SupportTicketTenantRepliedEvent,
  SupportTicketOperatorRepliedEvent,
} from './support.events';
import { isPlatformOperator } from '../../common/platform-operator.util';

type SupportPriority = 'low' | 'normal' | 'high';
type SupportStatus = 'open' | 'in_progress' | 'resolved';

const VALID_PRIORITIES: SupportPriority[] = ['low', 'normal', 'high'];
const VALID_STATUSES: SupportStatus[] = ['open', 'in_progress', 'resolved'];

/**
 * Service for handling tenant support requests and platform operator responses.
 * Manages ticket creation, replies, status updates, and email notifications.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  /**
   * Validates and normalizes the given priority string.
   * @throws BadRequestException if the priority is invalid.
   */
  private normalizePriority(priority?: string): SupportPriority {
    const p = String(priority ?? 'normal').toLowerCase() as SupportPriority;
    if (!VALID_PRIORITIES.includes(p)) {
      throw new BadRequestException('Invalid support priority');
    }
    return p;
  }

  /**
   * Validates and normalizes the given status string.
   * @throws BadRequestException if the status is invalid.
   */
  private normalizeStatus(status?: string): SupportStatus {
    const s = String(status ?? '').toLowerCase() as SupportStatus;
    if (!VALID_STATUSES.includes(s)) {
      throw new BadRequestException('Invalid support status');
    }
    return s;
  }

  private async canManageSupportTickets(orgId: string, userId: string): Promise<boolean> {
    const assignments = await this.prisma.withTenant(orgId, (tx) =>
      tx.roleAssignment.findMany({
        where: { userId, role: { orgId } },
        include: { role: true },
      }),
    );
    return assignments.some(
      (a) =>
        a.role.isSystemRole &&
        [SYSTEM_ROLES.OWNER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.MANAGER].includes(a.role.name as any),
    );
  }

  /** Owner/admin may reassign the org contact and close any ticket. */
  private async canAdminOrgSupport(orgId: string, userId: string): Promise<boolean> {
    const assignments = await this.prisma.withTenant(orgId, (tx) =>
      tx.roleAssignment.findMany({
        where: { userId, role: { orgId } },
        include: { role: true },
      }),
    );
    return assignments.some(
      (a) =>
        a.role.isSystemRole &&
        [SYSTEM_ROLES.OWNER, SYSTEM_ROLES.ADMIN].includes(a.role.name as any),
    );
  }

  private canViewOrgSupportRequest(
    request: { createdByUserId: string; contactUserId: string },
    userId: string,
    canManage: boolean,
  ): boolean {
    if (canManage) return true;
    return request.createdByUserId === userId || request.contactUserId === userId;
  }

  private buildOrgPermissions(
    request: { contactUserId: string; createdByUserId: string; status: string },
    userId: string,
    canManage: boolean,
    canAdmin: boolean,
  ) {
    const isContact = request.contactUserId === userId;
    const canView = canManage || isContact || request.createdByUserId === userId;
    return {
      isContact,
      canReplyToPlatform: isContact && request.status !== 'resolved',
      canAddInternalNote: canView && request.status !== 'resolved',
      canClose: (isContact || canAdmin) && request.status !== 'resolved',
      canReassignContact: canAdmin && request.status !== 'resolved',
    };
  }

  private messageAuthorSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    organization: { select: { slug: true } },
  } as const;

  private messageFromPlatformSupport(author: {
    id: string;
    email: string;
    organization?: { slug: string } | null;
  }): boolean {
    return isPlatformOperator(author.id, author.email, author.organization?.slug ?? '');
  }

  private serializeTenantMessage(message: {
    id: string;
    body: string;
    isInternal: boolean;
    isOrgInternal: boolean;
    createdAt: Date;
    author: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      organization?: { slug: string } | null;
    };
  }) {
    const fromPlatformSupport = this.messageFromPlatformSupport(message.author);
    return {
      id: message.id,
      body: message.body,
      isInternal: message.isInternal,
      isOrgInternal: message.isOrgInternal,
      fromPlatformSupport,
      createdAt: message.createdAt,
      author: {
        id: message.author.id,
        email: message.author.email,
        firstName: message.author.firstName,
        lastName: message.author.lastName,
      },
    };
  }

  /**
   * Centralized Prisma `include` shape for support requests.
   * Tenant: public + org-internal messages (no platform-internal).
   * Platform: public + platform-internal messages (no org-internal).
   */
  private includeShape(audience: 'tenant' | 'platform' = 'tenant') {
    const messageWhere = audience === 'tenant' ? { isInternal: false } : { isOrgInternal: false };
    return {
      organization: {
        select: { id: true, name: true, slug: true, timezone: true },
      },
      createdBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      contact: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      assignedTo: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      messages: {
        where: messageWhere,
        orderBy: { createdAt: 'asc' as const },
        include: {
          author: { select: this.messageAuthorSelect },
        },
      },
    };
  }

  /**
   * Submits a new support request from a tenant user.
   * Sends an email notification to the platform support team.
   */
  async submit(
    orgId: string,
    actor: { userId: string; email: string; firstName?: string | null; lastName?: string | null },
    data: {
      subject: string;
      message: string;
      priority?: 'low' | 'normal' | 'high';
      category?: string;
    },
  ) {
    const to = (process.env.SUPPORT_CONTACT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim();
    const fullName =
      [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim() || actor.email;
    const priority = this.normalizePriority(data.priority);
    const category = data.category ?? 'general';
    const subject = String(data.subject ?? '').trim();
    const message = String(data.message ?? '').trim();

    if (!subject || !message) {
      throw new BadRequestException('Subject and message are required');
    }

    const request = await this.prisma.withTenant(orgId, (tx) =>
      tx.supportRequest.create({
        data: {
          orgId,
          createdByUserId: actor.userId,
          contactUserId: actor.userId,
          subject,
          priority,
          category,
          status: 'open',
          hasUnreadTenantReply: true,
          messages: {
            create: {
              orgId,
              authorUserId: actor.userId,
              body: message,
              isInternal: false,
            },
          },
        },
        include: this.includeShape('tenant'),
      }),
    );

    await this.eventEmitter.emitAsync(
      SUPPORT_EVENTS.TICKET_CREATED,
      new SupportTicketCreatedEvent(orgId, request.id, subject, priority, category, message, actor),
    );

    await this.audit.logActivity({
      orgId,
      userId: actor.userId,
      action: 'support.request.submit',
      resourceType: 'support',
      resourceId: request.id,
      metadata: { subject, priority, category },
    });

    await this.audit.logAudit({
      orgId,
      userId: actor.userId,
      action: 'create',
      tableName: 'support_requests',
      recordId: request.id,
      newValues: { subject, priority, category, status: 'open' },
    });

    return request;
  }

  /**
   * Retrieves a list of support requests for a specific tenant organization.
   * Includes only the most recent public message for preview.
   */
  async listForOrg(orgId: string, userId: string) {
    const canManage = await this.canManageSupportTickets(orgId, userId);
    return this.prisma.withBypassRls((tx) =>
      tx.supportRequest.findMany({
        where: {
          orgId,
          ...(canManage
            ? {}
            : {
                OR: [{ createdByUserId: userId }, { contactUserId: userId }],
              }),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          messages: {
            where: { isInternal: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              author: { select: this.messageAuthorSelect },
            },
          },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      }),
    );
  }

  /**
   * Retrieves full details of a specific support request for a tenant.
   * Marks any unread platform replies as read.
   */
  async getForOrg(orgId: string, userId: string, requestId: string) {
    const [canManage, canAdmin] = await Promise.all([
      this.canManageSupportTickets(orgId, userId),
      this.canAdminOrgSupport(orgId, userId),
    ]);

    const request = await this.prisma.withBypassRls((tx) =>
      tx.supportRequest.findFirst({
        where: { id: requestId, orgId },
        include: this.includeShape('tenant'),
      }),
    );

    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    if (!this.canViewOrgSupportRequest(request, userId, canManage)) {
      throw new ForbiddenException('You do not have permission to view this support request');
    }

    if (request.hasUnreadPlatformReply) {
      await this.prisma.withTenant(orgId, (tx) =>
        tx.supportRequest.update({
          where: { id: requestId },
          data: { hasUnreadPlatformReply: false },
        }),
      );
    }

    const permissions = this.buildOrgPermissions(request, userId, canManage, canAdmin);

    return {
      ...request,
      hasUnreadPlatformReply: false,
      messages: request.messages.map((m) => this.serializeTenantMessage(m)),
      permissions,
    };
  }

  /**
   * Closes/Resolves a support request from the tenant dashboard.
   */
  async closeRequest(orgId: string, actor: { userId: string }, requestId: string) {
    const [canAdmin] = await Promise.all([this.canAdminOrgSupport(orgId, actor.userId)]);

    const request = await this.prisma.withTenant(orgId, (tx) =>
      tx.supportRequest.findFirst({
        where: { id: requestId, orgId },
        select: { id: true, status: true, contactUserId: true },
      }),
    );
    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    const isContact = request.contactUserId === actor.userId;
    if (!isContact && !canAdmin) {
      throw new ForbiddenException('You do not have permission to close this support request');
    }

    if (request.status === 'resolved') {
      return request;
    }

    const updated = await this.prisma.withTenant(orgId, (tx) =>
      tx.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          hasUnreadPlatformReply: false,
        },
      }),
    );

    await this.audit.logActivity({
      orgId,
      userId: actor.userId,
      action: 'support.request.resolve',
      resourceType: 'support',
      resourceId: request.id,
      metadata: { status: 'resolved' },
    });

    await this.audit.logAudit({
      orgId,
      userId: actor.userId,
      action: 'update',
      tableName: 'support_requests',
      recordId: request.id,
      newValues: { status: 'resolved', resolvedAt: updated.resolvedAt },
    });

    return updated;
  }

  /**
   * Adds a reply from a tenant user to an existing support request.
   * Public replies go to QlessQ (contact only). Org-internal notes stay in-org.
   */
  async addOrgReply(
    orgId: string,
    actor: { userId: string },
    requestId: string,
    body: { message: string; isOrgInternal?: boolean },
  ) {
    const message = String(body.message ?? '').trim();
    if (!message) {
      throw new BadRequestException('Reply message is required');
    }

    const isOrgInternal = Boolean(body.isOrgInternal);
    const [canManage] = await Promise.all([this.canManageSupportTickets(orgId, actor.userId)]);

    const request = await this.prisma.withTenant(orgId, (tx) =>
      tx.supportRequest.findFirst({
        where: { id: requestId, orgId },
        select: {
          id: true,
          status: true,
          createdByUserId: true,
          contactUserId: true,
        },
      }),
    );
    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    if (!this.canViewOrgSupportRequest(request, actor.userId, canManage)) {
      throw new ForbiddenException('You do not have permission to view this support request');
    }

    if (isOrgInternal) {
      const created = await this.prisma.withTenant(orgId, (tx) =>
        tx.supportMessage.create({
          data: {
            orgId,
            supportRequestId: requestId,
            authorUserId: actor.userId,
            body: message,
            isInternal: false,
            isOrgInternal: true,
          },
          include: {
            author: { select: this.messageAuthorSelect },
          },
        }),
      );

      await this.audit.logActivity({
        orgId,
        userId: actor.userId,
        action: 'support.request.reply',
        resourceType: 'support',
        resourceId: requestId,
        metadata: { source: 'tenant', isOrgInternal: true },
      });

      return this.serializeTenantMessage(created);
    }

    if (request.contactUserId !== actor.userId) {
      throw new ForbiddenException(
        'Only the assigned contact can reply to QlessQ support on this ticket',
      );
    }

    if (request.status === 'resolved') {
      await this.prisma.withTenant(orgId, (tx) =>
        tx.supportRequest.update({
          where: { id: requestId },
          data: {
            status: 'open',
            resolvedAt: null,
            hasUnreadTenantReply: true,
            hasUnreadPlatformReply: false,
          },
        }),
      );
    } else {
      await this.prisma.withTenant(orgId, (tx) =>
        tx.supportRequest.update({
          where: { id: requestId },
          data: { hasUnreadTenantReply: true, hasUnreadPlatformReply: false },
        }),
      );
    }

    const created = await this.prisma.withTenant(orgId, (tx) =>
      tx.supportMessage.create({
        data: {
          orgId,
          supportRequestId: requestId,
          authorUserId: actor.userId,
          body: message,
          isInternal: false,
          isOrgInternal: false,
        },
        include: {
          author: { select: this.messageAuthorSelect },
        },
      }),
    );

    await this.audit.logActivity({
      orgId,
      userId: actor.userId,
      action: 'support.request.reply',
      resourceType: 'support',
      resourceId: requestId,
      metadata: { source: 'tenant', isOrgInternal: false },
    });

    await this.eventEmitter.emitAsync(
      SUPPORT_EVENTS.TENANT_REPLIED,
      new SupportTicketTenantRepliedEvent(orgId, requestId, message, {
        email: created.author.email,
        firstName: created.author.firstName,
        lastName: created.author.lastName,
      }),
    );

    return this.serializeTenantMessage(created);
  }

  /**
   * Reassigns the org contact who may reply to QlessQ on this ticket.
   * Restricted to owner/admin.
   */
  async reassignContact(
    orgId: string,
    actor: { userId: string },
    requestId: string,
    contactUserId: string,
  ) {
    const canAdmin = await this.canAdminOrgSupport(orgId, actor.userId);
    if (!canAdmin) {
      throw new ForbiddenException(
        'Only organization owners and admins can reassign support contacts',
      );
    }

    const request = await this.prisma.withTenant(orgId, (tx) =>
      tx.supportRequest.findFirst({
        where: { id: requestId, orgId },
        select: { id: true, contactUserId: true },
      }),
    );
    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    const nextContact = await this.prisma.withTenant(orgId, (tx) =>
      tx.user.findFirst({
        where: { id: contactUserId, orgId, status: 'active' },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    );
    if (!nextContact) {
      throw new BadRequestException('Contact user not found in this organization');
    }

    if (nextContact.id === request.contactUserId) {
      return nextContact;
    }

    await this.prisma.withTenant(orgId, (tx) =>
      tx.supportRequest.update({
        where: { id: requestId },
        data: { contactUserId: nextContact.id },
      }),
    );

    await this.audit.logActivity({
      orgId,
      userId: actor.userId,
      action: 'support.request.reassign_contact',
      resourceType: 'support',
      resourceId: requestId,
      metadata: {
        previousContactUserId: request.contactUserId,
        contactUserId: nextContact.id,
      },
    });

    await this.audit.logAudit({
      orgId,
      userId: actor.userId,
      action: 'update',
      tableName: 'support_requests',
      recordId: requestId,
      newValues: { contactUserId: nextContact.id },
    });

    return nextContact;
  }

  /**
   * Helper to ensure a support request exists before a platform operator acts on it.
   */
  private async ensurePlatformVisible(requestId: string) {
    const request = await this.prisma.withBypassRls((tx) =>
      tx.supportRequest.findUnique({
        where: { id: requestId },
        select: { id: true, orgId: true, status: true },
      }),
    );
    if (!request) {
      throw new NotFoundException('Support request not found');
    }
    return request;
  }

  /**
   * Retrieves a paginated list of support requests across all organizations
   * for platform operators. Supports filtering and searching.
   */
  async listForPlatform(filters: {
    status?: string;
    priority?: string;
    category?: string;
    orgId?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const take = Math.min(200, Math.max(1, filters.take ?? 50));
    const skip = Math.max(0, filters.skip ?? 0);
    const where: Prisma.SupportRequestWhereInput = {};
    if (filters.orgId) where.orgId = filters.orgId;
    if (filters.status) where.status = this.normalizeStatus(filters.status);
    if (filters.priority) where.priority = this.normalizePriority(filters.priority);
    if (filters.category) where.category = filters.category;
    const search = String(filters.search ?? '').trim();
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { organization: { name: { contains: search, mode: 'insensitive' } } },
        { createdBy: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.withBypassRls((tx) =>
      Promise.all([
        tx.supportRequest.findMany({
          where,
          include: {
            organization: { select: { id: true, name: true, slug: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
            messages: {
              where: { isOrgInternal: false },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                author: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          skip,
          take,
        }),
        tx.supportRequest.count({ where }),
      ]),
    );

    const mappedItems = items.map((item) => ({
      ...item,
      user: item.createdBy,
    }));

    return {
      items: mappedItems,
      total,
    };
  }

  /**
   * Counts the number of support requests that have unread replies from tenants.
   * Used for platform operator dashboard notification badges.
   */
  async countUnreadForPlatform() {
    return this.prisma.withBypassRls((tx) =>
      tx.supportRequest.count({
        where: { hasUnreadTenantReply: true },
      }),
    );
  }

  /**
   * Retrieves full details of a support request for a platform operator.
   * Includes organization context (plan, user count, recent activity).
   */
  async getForPlatform(requestId: string) {
    const request = await this.prisma.withBypassRls((tx) =>
      tx.supportRequest.findUnique({
        where: { id: requestId },
        include: this.includeShape('platform'),
      }),
    );

    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    if (request.hasUnreadTenantReply) {
      await this.prisma.withBypassRls((tx) =>
        tx.supportRequest.update({
          where: { id: requestId },
          data: { hasUnreadTenantReply: false },
        }),
      );
    }

    const [activeSubscription, branchCount, userCount, recentActivity] = await Promise.all([
      this.prisma.withBypassRls((tx) =>
        tx.subscription.findFirst({
          where: { orgId: request.orgId },
          orderBy: { createdAt: 'desc' },
          include: { plan: { select: { id: true, name: true, slug: true } } },
        }),
      ),
      this.prisma.withTenant(request.orgId, (tx) =>
        tx.branch.count({ where: { orgId: request.orgId } }),
      ),
      this.prisma.withTenant(request.orgId, (tx) =>
        tx.user.count({ where: { orgId: request.orgId } }),
      ),
      this.prisma.withBypassRls((tx) =>
        tx.activityLog.findMany({
          where: { orgId: request.orgId },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: { id: true, action: true, resourceType: true, metadata: true, createdAt: true },
        }),
      ),
    ]);

    return {
      ...request,
      hasUnreadTenantReply: false,
      user: request.createdBy,
      correlation: {
        plan: activeSubscription?.plan?.name ?? null,
        subscriptionStatus: activeSubscription?.status ?? null,
        branchCount,
        userCount,
        recentActivity,
      },
    };
  }

  /**
   * Adds a reply from a platform operator.
   * Can be an internal note or a public response sent to the tenant via email.
   */
  async addPlatformReply(
    operator: { userId: string },
    requestId: string,
    body: { message: string; isInternal?: boolean },
  ) {
    const message = String(body.message ?? '').trim();
    if (!message) {
      throw new BadRequestException('Reply message is required');
    }

    const request = await this.ensurePlatformVisible(requestId);

    if (request.status === 'resolved') {
      if (!body.isInternal) {
        await this.prisma.withBypassRls((tx) =>
          tx.supportRequest.update({
            where: { id: requestId },
            data: { status: 'in_progress', resolvedAt: null, hasUnreadPlatformReply: true },
          }),
        );
      }
    } else if (!body.isInternal) {
      await this.prisma.withBypassRls((tx) =>
        tx.supportRequest.update({
          where: { id: requestId },
          data: { hasUnreadPlatformReply: true },
        }),
      );
    }

    const created = await this.prisma.withBypassRls((tx) =>
      tx.supportMessage.create({
        data: {
          orgId: request.orgId,
          supportRequestId: requestId,
          authorUserId: operator.userId,
          body: message,
          isInternal: Boolean(body.isInternal),
        },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    );

    await this.audit.logActivity({
      orgId: request.orgId,
      userId: operator.userId,
      action: 'support.request.reply',
      resourceType: 'support',
      resourceId: requestId,
      metadata: { source: 'platform', isInternal: Boolean(body.isInternal) },
    });

    if (!body.isInternal) {
      await this.eventEmitter.emitAsync(
        SUPPORT_EVENTS.OPERATOR_REPLIED,
        new SupportTicketOperatorRepliedEvent(request.orgId, requestId, message, {
          email: created.author.email,
          firstName: created.author.firstName,
          lastName: created.author.lastName,
        }),
      );
    }

    return created;
  }

  /**
   * Updates the status, priority, category, or assignee of a support request.
   * Restricted to platform operators.
   */
  async updatePlatformRequest(
    operator: { userId: string },
    requestId: string,
    input: {
      status?: string;
      priority?: string;
      category?: string;
      assignedToUserId?: string | null;
    },
  ) {
    const request = await this.ensurePlatformVisible(requestId);
    const patch: Record<string, unknown> = {};
    if (input.status !== undefined) {
      const status = this.normalizeStatus(input.status);
      patch.status = status;
      patch.resolvedAt = status === 'resolved' ? new Date() : null;
      if (status === 'resolved' && request.status !== 'resolved') {
        patch.hasUnreadPlatformReply = true;
      }
    }
    if (input.priority !== undefined) {
      patch.priority = this.normalizePriority(input.priority);
    }
    if (input.category !== undefined) {
      patch.category = String(input.category ?? 'general').trim() || 'general';
    }
    if (input.assignedToUserId !== undefined) {
      const assigneeId = input.assignedToUserId;
      if (assigneeId) {
        const assignee = await this.prisma.withBypassRls((tx) =>
          tx.user.findFirst({
            where: { id: assigneeId },
            select: { id: true, email: true, organization: { select: { slug: true } } },
          }),
        );
        if (!assignee) {
          throw new BadRequestException('Assigned user not found');
        }
        const resolvedEmail = String(assignee.email ?? '').trim();
        const resolvedSlug = String(assignee.organization?.slug ?? '').trim();
        if (!isPlatformOperator(assignee.id, resolvedEmail, resolvedSlug)) {
          throw new BadRequestException('Assigned user is not a platform operator');
        }
        patch.assignedToUserId = assigneeId;
      } else {
        patch.assignedToUserId = null;
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No support request fields provided for update');
    }

    const updated = await this.prisma.withBypassRls((tx) =>
      tx.supportRequest.update({
        where: { id: requestId },
        data: patch,
        include: this.includeShape('platform'),
      }),
    );

    const auditPatch = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value,
      ]),
    ) as Record<string, string | null | boolean>;

    await this.audit.logActivity({
      orgId: request.orgId,
      userId: operator.userId,
      action: 'support.request.update',
      resourceType: 'support',
      resourceId: requestId,
      metadata: auditPatch,
    });

    await this.audit.logAudit({
      orgId: request.orgId,
      userId: operator.userId,
      action: 'update',
      tableName: 'support_requests',
      recordId: requestId,
      newValues: auditPatch,
    });

    return updated;
  }

  /**
   * Validates that the acting user has access to the target organization's support requests.
   */
  ensureActorCanAccessOrg(actor: { orgId: string }, targetOrgId: string) {
    if (actor.orgId !== targetOrgId) {
      throw new ForbiddenException('Cross-tenant access is not allowed for tenant support routes');
    }
  }
}
