import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { ConfigModule } from '@nestjs/config';

const integrationDbUrl = process.env.INTEGRATION_DATABASE_URL ?? process.env.TEST_DATABASE_URL;

describe.skipIf(!integrationDbUrl)('Tenant Isolation & RLS (Integration)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDbUrl!;

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();

    await prisma.cleanDatabase().catch(() => {});
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  it('should isolate tickets between two organizations', async () => {
    const suffix = Date.now().toString();
    const orgA = await prisma.organization.create({
      data: { name: 'Org A', slug: 'org-a-' + suffix },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Org B', slug: 'org-b-' + suffix },
    });

    const branchA = await prisma.withTenant(orgA.id, (tx) =>
      tx.branch.create({
        data: {
          organization: { connect: { id: orgA.id } },
          name: 'Branch A',
          slug: 'branch-a-' + suffix,
          timezone: 'UTC',
        },
      }),
    );
    const branchB = await prisma.withTenant(orgB.id, (tx) =>
      tx.branch.create({
        data: {
          organization: { connect: { id: orgB.id } },
          name: 'Branch B',
          slug: 'branch-b-' + suffix,
          timezone: 'UTC',
        },
      }),
    );

    const serviceA = await prisma.withTenant(orgA.id, (tx) =>
      tx.service.create({
        data: {
          organization: { connect: { id: orgA.id } },
          name: 'Service A',
          slug: 'service-a-' + suffix,
          durationMinutes: 15,
        },
      }),
    );
    const serviceB = await prisma.withTenant(orgB.id, (tx) =>
      tx.service.create({
        data: {
          organization: { connect: { id: orgB.id } },
          name: 'Service B',
          slug: 'service-b-' + suffix,
          durationMinutes: 15,
        },
      }),
    );

    const visitA = await prisma.withTenant(orgA.id, (tx) =>
      tx.visit.create({
        data: {
          organization: { connect: { id: orgA.id } },
          branch: { connect: { id: branchA.id } },
          status: 'active',
          source: 'online',
          customerName: 'Visitor A',
        },
      }),
    );
    const visitB = await prisma.withTenant(orgB.id, (tx) =>
      tx.visit.create({
        data: {
          organization: { connect: { id: orgB.id } },
          branch: { connect: { id: branchB.id } },
          status: 'active',
          source: 'online',
          customerName: 'Visitor B',
        },
      }),
    );

    const deskA = await prisma.withTenant(orgA.id, (tx) =>
      tx.desk.create({
        data: {
          organization: { connect: { id: orgA.id } },
          branch: { connect: { id: branchA.id } },
          name: 'Desk A',
          number: 'A-1',
          status: 'open',
        },
      }),
    );
    const deskB = await prisma.withTenant(orgB.id, (tx) =>
      tx.desk.create({
        data: {
          organization: { connect: { id: orgB.id } },
          branch: { connect: { id: branchB.id } },
          name: 'Desk B',
          number: 'B-1',
          status: 'open',
        },
      }),
    );

    const userA = await prisma.withTenant(orgA.id, (tx) =>
      tx.user.create({
        data: {
          organization: { connect: { id: orgA.id } },
          email: `tenant-a-${suffix}@example.test`,
          passwordHash: '$2b$10$rbB/Xr1hkKv5tuag2mzVR.3Mil5E0d86mByVzEzl2zfx0F5DmbfjO',
        },
      }),
    );
    const userB = await prisma.withTenant(orgB.id, (tx) =>
      tx.user.create({
        data: {
          organization: { connect: { id: orgB.id } },
          email: `tenant-b-${suffix}@example.test`,
          passwordHash: '$2b$10$rbB/Xr1hkKv5tuag2mzVR.3Mil5E0d86mByVzEzl2zfx0F5DmbfjO',
        },
      }),
    );
    const roleA = await prisma.withTenant(orgA.id, (tx) =>
      tx.role.create({
        data: {
          organization: { connect: { id: orgA.id } },
          name: `staff-a-${suffix}`,
        },
      }),
    );
    const roleB = await prisma.withTenant(orgB.id, (tx) =>
      tx.role.create({
        data: {
          organization: { connect: { id: orgB.id } },
          name: `staff-b-${suffix}`,
        },
      }),
    );
    const roleAssignmentA = await prisma.withTenant(orgA.id, (tx) =>
      tx.roleAssignment.create({
        data: {
          user: { connect: { id: userA.id } },
          role: { connect: { id: roleA.id } },
          branch: { connect: { id: branchA.id } },
        },
      }),
    );
    const roleAssignmentB = await prisma.withTenant(orgB.id, (tx) =>
      tx.roleAssignment.create({
        data: {
          user: { connect: { id: userB.id } },
          role: { connect: { id: roleB.id } },
          branch: { connect: { id: branchB.id } },
        },
      }),
    );

    const queueA = await prisma.withTenant(orgA.id, (tx) =>
      tx.queue.create({
        data: {
          organization: { connect: { id: orgA.id } },
          branch: { connect: { id: branchA.id } },
          service: { connect: { id: serviceA.id } },
          name: 'Q-A',
          prefix: 'A',
        },
      }),
    );
    const queueB = await prisma.withTenant(orgB.id, (tx) =>
      tx.queue.create({
        data: {
          organization: { connect: { id: orgB.id } },
          branch: { connect: { id: branchB.id } },
          service: { connect: { id: serviceB.id } },
          name: 'Q-B',
          prefix: 'B',
        },
      }),
    );

    const ticketA = await prisma.withTenant(orgA.id, (tx) =>
      tx.ticket.create({
        data: {
          organization: { connect: { id: orgA.id } },
          branch: { connect: { id: branchA.id } },
          service: { connect: { id: serviceA.id } },
          queue: { connect: { id: queueA.id } },
          displayNumber: 'A-001',
        },
      }),
    );
    const ticketB = await prisma.withTenant(orgB.id, (tx) =>
      tx.ticket.create({
        data: {
          organization: { connect: { id: orgB.id } },
          branch: { connect: { id: branchB.id } },
          service: { connect: { id: serviceB.id } },
          queue: { connect: { id: queueB.id } },
          displayNumber: 'B-001',
        },
      }),
    );

    const ticketsA = await prisma.withTenant(orgA.id, (tx) => tx.ticket.findMany());
    expect(ticketsA).toHaveLength(1);
    expect(ticketsA[0].id).toBe(ticketA.id);

    const ticketsB = await prisma.withTenant(orgB.id, (tx) => tx.ticket.findMany());
    expect(ticketsB).toHaveLength(1);
    expect(ticketsB[0].id).toBe(ticketB.id);

    const queuesA = await prisma.withTenant(orgA.id, (tx) => tx.queue.findMany());
    expect(queuesA).toHaveLength(1);
    expect(queuesA[0].id).toBe(queueA.id);

    const queuesB = await prisma.withTenant(orgB.id, (tx) => tx.queue.findMany());
    expect(queuesB).toHaveLength(1);
    expect(queuesB[0].id).toBe(queueB.id);

    const servicesA = await prisma.withTenant(orgA.id, (tx) => tx.service.findMany());
    expect(servicesA).toHaveLength(1);
    expect(servicesA[0].id).toBe(serviceA.id);

    const servicesB = await prisma.withTenant(orgB.id, (tx) => tx.service.findMany());
    expect(servicesB).toHaveLength(1);
    expect(servicesB[0].id).toBe(serviceB.id);

    const desksA = await prisma.withTenant(orgA.id, (tx) => tx.desk.findMany());
    expect(desksA).toHaveLength(1);
    expect(desksA[0].id).toBe(deskA.id);

    const desksB = await prisma.withTenant(orgB.id, (tx) => tx.desk.findMany());
    expect(desksB).toHaveLength(1);
    expect(desksB[0].id).toBe(deskB.id);

    const visitsA = await prisma.withTenant(orgA.id, (tx) => tx.visit.findMany());
    expect(visitsA).toHaveLength(1);
    expect(visitsA[0].id).toBe(visitA.id);

    const visitsB = await prisma.withTenant(orgB.id, (tx) => tx.visit.findMany());
    expect(visitsB).toHaveLength(1);
    expect(visitsB[0].id).toBe(visitB.id);

    const roleAssignmentsA = await prisma.withTenant(orgA.id, (tx) => tx.roleAssignment.findMany());
    expect(roleAssignmentsA).toHaveLength(1);
    expect(roleAssignmentsA[0].id).toBe(roleAssignmentA.id);

    const roleAssignmentsB = await prisma.withTenant(orgB.id, (tx) => tx.roleAssignment.findMany());
    expect(roleAssignmentsB).toHaveLength(1);
    expect(roleAssignmentsB[0].id).toBe(roleAssignmentB.id);

    const scheduledAt = new Date(Date.now() + 86_400_000);
    const appointmentA = await prisma.withTenant(orgA.id, (tx) =>
      tx.appointment.create({
        data: {
          organization: { connect: { id: orgA.id } },
          branch: { connect: { id: branchA.id } },
          service: { connect: { id: serviceA.id } },
          customerName: 'Appt A',
          scheduledAt,
          durationMinutes: 15,
        },
      }),
    );
    const appointmentB = await prisma.withTenant(orgB.id, (tx) =>
      tx.appointment.create({
        data: {
          organization: { connect: { id: orgB.id } },
          branch: { connect: { id: branchB.id } },
          service: { connect: { id: serviceB.id } },
          customerName: 'Appt B',
          scheduledAt,
          durationMinutes: 15,
        },
      }),
    );

    const notificationA = await prisma.withTenant(orgA.id, (tx) =>
      tx.notification.create({
        data: {
          orgId: orgA.id,
          channel: 'email',
          recipientType: 'customer',
          payload: { to: 'a@example.test' },
          status: 'pending',
        },
      }),
    );
    const notificationB = await prisma.withTenant(orgB.id, (tx) =>
      tx.notification.create({
        data: {
          orgId: orgB.id,
          channel: 'email',
          recipientType: 'customer',
          payload: { to: 'b@example.test' },
          status: 'pending',
        },
      }),
    );

    const reviewA = await prisma.withTenant(orgA.id, (tx) =>
      tx.review.create({
        data: {
          orgId: orgA.id,
          branchId: branchA.id,
          customerName: 'Reviewer A',
          rating: 5,
          status: 'pending',
        },
      }),
    );
    const reviewB = await prisma.withTenant(orgB.id, (tx) =>
      tx.review.create({
        data: {
          orgId: orgB.id,
          branchId: branchB.id,
          customerName: 'Reviewer B',
          rating: 4,
          status: 'pending',
        },
      }),
    );

    const templateA = await prisma.withTenant(orgA.id, (tx) =>
      tx.notificationTemplate.create({
        data: {
          orgId: orgA.id,
          type: 'ticket_called',
          channel: 'sms',
          body: 'Your turn',
        },
      }),
    );
    const templateB = await prisma.withTenant(orgB.id, (tx) =>
      tx.notificationTemplate.create({
        data: {
          orgId: orgB.id,
          type: 'ticket_called',
          channel: 'sms',
          body: 'Your turn',
        },
      }),
    );

    const activityA = await prisma.withTenant(orgA.id, (tx) =>
      tx.activityLog.create({
        data: {
          orgId: orgA.id,
          action: 'test.activity.a',
          resourceType: 'isolation_spec',
        },
      }),
    );
    const activityB = await prisma.withTenant(orgB.id, (tx) =>
      tx.activityLog.create({
        data: {
          orgId: orgB.id,
          action: 'test.activity.b',
          resourceType: 'isolation_spec',
        },
      }),
    );

    const appointmentsA = await prisma.withTenant(orgA.id, (tx) => tx.appointment.findMany());
    expect(appointmentsA).toHaveLength(1);
    expect(appointmentsA[0].id).toBe(appointmentA.id);

    const appointmentsB = await prisma.withTenant(orgB.id, (tx) => tx.appointment.findMany());
    expect(appointmentsB).toHaveLength(1);
    expect(appointmentsB[0].id).toBe(appointmentB.id);

    const notificationsA = await prisma.withTenant(orgA.id, (tx) => tx.notification.findMany());
    expect(notificationsA).toHaveLength(1);
    expect(notificationsA[0].id).toBe(notificationA.id);

    const notificationsB = await prisma.withTenant(orgB.id, (tx) => tx.notification.findMany());
    expect(notificationsB).toHaveLength(1);
    expect(notificationsB[0].id).toBe(notificationB.id);

    const reviewsA = await prisma.withTenant(orgA.id, (tx) => tx.review.findMany());
    expect(reviewsA).toHaveLength(1);
    expect(reviewsA[0].id).toBe(reviewA.id);

    const reviewsB = await prisma.withTenant(orgB.id, (tx) => tx.review.findMany());
    expect(reviewsB).toHaveLength(1);
    expect(reviewsB[0].id).toBe(reviewB.id);

    const templatesA = await prisma.withTenant(orgA.id, (tx) => tx.notificationTemplate.findMany());
    expect(templatesA).toHaveLength(1);
    expect(templatesA[0].id).toBe(templateA.id);

    const templatesB = await prisma.withTenant(orgB.id, (tx) => tx.notificationTemplate.findMany());
    expect(templatesB).toHaveLength(1);
    expect(templatesB[0].id).toBe(templateB.id);

    const activityLogsA = await prisma.withTenant(orgA.id, (tx) => tx.activityLog.findMany());
    expect(activityLogsA).toHaveLength(1);
    expect(activityLogsA[0].id).toBe(activityA.id);

    const activityLogsB = await prisma.withTenant(orgB.id, (tx) => tx.activityLog.findMany());
    expect(activityLogsB).toHaveLength(1);
    expect(activityLogsB[0].id).toBe(activityB.id);

    const ticketsAll = await prisma.withBypassRls((tx) => tx.ticket.findMany());
    expect(ticketsAll.length).toBeGreaterThanOrEqual(2);

    await prisma.withBypassRls(async (tx) => {
      await tx.activityLog.deleteMany({ where: { id: { in: [activityA.id, activityB.id] } } });
      await tx.notificationTemplate.deleteMany({
        where: { id: { in: [templateA.id, templateB.id] } },
      });
      await tx.review.deleteMany({ where: { id: { in: [reviewA.id, reviewB.id] } } });
      await tx.notification.deleteMany({
        where: { id: { in: [notificationA.id, notificationB.id] } },
      });
      await tx.appointment.deleteMany({
        where: { id: { in: [appointmentA.id, appointmentB.id] } },
      });
      await tx.roleAssignment.deleteMany({
        where: { id: { in: [roleAssignmentA.id, roleAssignmentB.id] } },
      });
      await tx.ticket.deleteMany({ where: { id: { in: [ticketA.id, ticketB.id] } } });
      await tx.queue.deleteMany({ where: { id: { in: [queueA.id, queueB.id] } } });
      await tx.visit.deleteMany({ where: { id: { in: [visitA.id, visitB.id] } } });
      await tx.desk.deleteMany({ where: { id: { in: [deskA.id, deskB.id] } } });
      await tx.service.deleteMany({ where: { id: { in: [serviceA.id, serviceB.id] } } });
      await tx.role.deleteMany({ where: { id: { in: [roleA.id, roleB.id] } } });
      await tx.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
      await tx.branch.deleteMany({ where: { id: { in: [branchA.id, branchB.id] } } });
      await tx.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    });
  }, 30000);

  it('should isolate wave 3 org structure models between organizations', async () => {
    const suffix = Date.now().toString();
    const orgA = await prisma.organization.create({
      data: { name: 'Wave3 Org A', slug: 'wave3-org-a-' + suffix },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Wave3 Org B', slug: 'wave3-org-b-' + suffix },
    });

    const branchA = await prisma.withTenant(orgA.id, (tx) =>
      tx.branch.create({
        data: {
          orgId: orgA.id,
          name: 'Wave3 Branch A',
          slug: 'wave3-branch-a-' + suffix,
          timezone: 'UTC',
        },
      }),
    );
    const branchB = await prisma.withTenant(orgB.id, (tx) =>
      tx.branch.create({
        data: {
          orgId: orgB.id,
          name: 'Wave3 Branch B',
          slug: 'wave3-branch-b-' + suffix,
          timezone: 'UTC',
        },
      }),
    );

    const userA = await prisma.withTenant(orgA.id, (tx) =>
      tx.user.create({
        data: {
          orgId: orgA.id,
          email: `wave3-a-${suffix}@example.test`,
          passwordHash: '$2b$10$rbB/Xr1hkKv5tuag2mzVR.3Mil5E0d86mByVzEzl2zfx0F5DmbfjO',
        },
      }),
    );
    const userB = await prisma.withTenant(orgB.id, (tx) =>
      tx.user.create({
        data: {
          orgId: orgB.id,
          email: `wave3-b-${suffix}@example.test`,
          passwordHash: '$2b$10$rbB/Xr1hkKv5tuag2mzVR.3Mil5E0d86mByVzEzl2zfx0F5DmbfjO',
        },
      }),
    );

    const roleA = await prisma.withTenant(orgA.id, (tx) =>
      tx.role.create({
        data: { orgId: orgA.id, name: `wave3-role-a-${suffix}` },
      }),
    );
    const roleB = await prisma.withTenant(orgB.id, (tx) =>
      tx.role.create({
        data: { orgId: orgB.id, name: `wave3-role-b-${suffix}` },
      }),
    );

    const settingA = await prisma.withTenant(orgA.id, (tx) =>
      tx.setting.create({
        data: { orgId: orgA.id, key: `wave3-key-a-${suffix}`, value: { enabled: true } },
      }),
    );
    const settingB = await prisma.withTenant(orgB.id, (tx) =>
      tx.setting.create({
        data: { orgId: orgB.id, key: `wave3-key-b-${suffix}`, value: { enabled: true } },
      }),
    );

    const displayA = await prisma.withTenant(orgA.id, (tx) =>
      tx.displayDevice.create({
        data: {
          orgId: orgA.id,
          branchId: branchA.id,
          name: 'Display A',
          type: 'lobby',
        },
      }),
    );
    const displayB = await prisma.withTenant(orgB.id, (tx) =>
      tx.displayDevice.create({
        data: {
          orgId: orgB.id,
          branchId: branchB.id,
          name: 'Display B',
          type: 'lobby',
        },
      }),
    );

    const branchesA = await prisma.withTenant(orgA.id, (tx) => tx.branch.findMany());
    expect(branchesA.some((b) => b.id === branchA.id)).toBe(true);
    expect(branchesA.some((b) => b.id === branchB.id)).toBe(false);

    const branchesB = await prisma.withTenant(orgB.id, (tx) => tx.branch.findMany());
    expect(branchesB.some((b) => b.id === branchB.id)).toBe(true);
    expect(branchesB.some((b) => b.id === branchA.id)).toBe(false);

    const usersA = await prisma.withTenant(orgA.id, (tx) => tx.user.findMany());
    expect(usersA.some((u) => u.id === userA.id)).toBe(true);
    expect(usersA.some((u) => u.id === userB.id)).toBe(false);

    const usersB = await prisma.withTenant(orgB.id, (tx) => tx.user.findMany());
    expect(usersB.some((u) => u.id === userB.id)).toBe(true);
    expect(usersB.some((u) => u.id === userA.id)).toBe(false);

    const rolesA = await prisma.withTenant(orgA.id, (tx) => tx.role.findMany());
    expect(rolesA.some((r) => r.id === roleA.id)).toBe(true);
    expect(rolesA.some((r) => r.id === roleB.id)).toBe(false);

    const rolesB = await prisma.withTenant(orgB.id, (tx) => tx.role.findMany());
    expect(rolesB.some((r) => r.id === roleB.id)).toBe(true);
    expect(rolesB.some((r) => r.id === roleA.id)).toBe(false);

    const settingsA = await prisma.withTenant(orgA.id, (tx) => tx.setting.findMany());
    expect(settingsA.some((s) => s.id === settingA.id)).toBe(true);
    expect(settingsA.some((s) => s.id === settingB.id)).toBe(false);

    const settingsB = await prisma.withTenant(orgB.id, (tx) => tx.setting.findMany());
    expect(settingsB.some((s) => s.id === settingB.id)).toBe(true);
    expect(settingsB.some((s) => s.id === settingA.id)).toBe(false);

    const displaysA = await prisma.withTenant(orgA.id, (tx) => tx.displayDevice.findMany());
    expect(displaysA.some((d) => d.id === displayA.id)).toBe(true);
    expect(displaysA.some((d) => d.id === displayB.id)).toBe(false);

    const displaysB = await prisma.withTenant(orgB.id, (tx) => tx.displayDevice.findMany());
    expect(displaysB.some((d) => d.id === displayB.id)).toBe(true);
    expect(displaysB.some((d) => d.id === displayA.id)).toBe(false);

    await prisma.withBypassRls(async (tx) => {
      await tx.displayDevice.deleteMany({ where: { id: { in: [displayA.id, displayB.id] } } });
      await tx.setting.deleteMany({ where: { id: { in: [settingA.id, settingB.id] } } });
      await tx.role.deleteMany({ where: { id: { in: [roleA.id, roleB.id] } } });
      await tx.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
      await tx.branch.deleteMany({ where: { id: { in: [branchA.id, branchB.id] } } });
      await tx.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    });
  }, 30000);

  it('should isolate wave 4 ops and integration models between organizations', async () => {
    const suffix = Date.now().toString();
    const orgA = await prisma.organization.create({
      data: { name: 'Wave4 Org A', slug: 'wave4-org-a-' + suffix },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Wave4 Org B', slug: 'wave4-org-b-' + suffix },
    });

    const announcementA = await prisma.withTenant(orgA.id, (tx) =>
      tx.announcement.create({
        data: {
          orgId: orgA.id,
          message: 'Announcement A',
          type: 'info',
        },
      }),
    );
    const announcementB = await prisma.withTenant(orgB.id, (tx) =>
      tx.announcement.create({
        data: {
          orgId: orgB.id,
          message: 'Announcement B',
          type: 'info',
        },
      }),
    );

    const integrationA = await prisma.withTenant(orgA.id, (tx) =>
      tx.integration.create({
        data: {
          orgId: orgA.id,
          type: 'webhook',
          config: { url: 'https://example-a.test/hook' },
        },
      }),
    );
    const integrationB = await prisma.withTenant(orgB.id, (tx) =>
      tx.integration.create({
        data: {
          orgId: orgB.id,
          type: 'webhook',
          config: { url: 'https://example-b.test/hook' },
        },
      }),
    );

    const announcementsA = await prisma.withTenant(orgA.id, (tx) => tx.announcement.findMany());
    expect(announcementsA.some((a) => a.id === announcementA.id)).toBe(true);
    expect(announcementsA.some((a) => a.id === announcementB.id)).toBe(false);

    const announcementsB = await prisma.withTenant(orgB.id, (tx) => tx.announcement.findMany());
    expect(announcementsB.some((a) => a.id === announcementB.id)).toBe(true);
    expect(announcementsB.some((a) => a.id === announcementA.id)).toBe(false);

    const integrationsA = await prisma.withTenant(orgA.id, (tx) => tx.integration.findMany());
    expect(integrationsA.some((i) => i.id === integrationA.id)).toBe(true);
    expect(integrationsA.some((i) => i.id === integrationB.id)).toBe(false);

    const integrationsB = await prisma.withTenant(orgB.id, (tx) => tx.integration.findMany());
    expect(integrationsB.some((i) => i.id === integrationB.id)).toBe(true);
    expect(integrationsB.some((i) => i.id === integrationA.id)).toBe(false);

    await prisma.withBypassRls(async (tx) => {
      await tx.integration.deleteMany({
        where: { id: { in: [integrationA.id, integrationB.id] } },
      });
      await tx.announcement.deleteMany({
        where: { id: { in: [announcementA.id, announcementB.id] } },
      });
      await tx.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    });
  }, 30000);

  it('should isolate wave 5 junction models between organizations', async () => {
    const suffix = Date.now().toString();
    const orgA = await prisma.organization.create({
      data: { name: 'Wave5 Org A', slug: 'wave5-org-a-' + suffix },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Wave5 Org B', slug: 'wave5-org-b-' + suffix },
    });

    const branchA = await prisma.withTenant(orgA.id, (tx) =>
      tx.branch.create({
        data: {
          organization: { connect: { id: orgA.id } },
          name: 'Branch A',
          slug: 'wave5-branch-a-' + suffix,
          timezone: 'UTC',
        },
      }),
    );
    const branchB = await prisma.withTenant(orgB.id, (tx) =>
      tx.branch.create({
        data: {
          organization: { connect: { id: orgB.id } },
          name: 'Branch B',
          slug: 'wave5-branch-b-' + suffix,
          timezone: 'UTC',
        },
      }),
    );

    const serviceA = await prisma.withTenant(orgA.id, (tx) =>
      tx.service.create({
        data: {
          organization: { connect: { id: orgA.id } },
          name: 'Service A',
          slug: 'wave5-service-a-' + suffix,
          durationMinutes: 15,
        },
      }),
    );
    const serviceB = await prisma.withTenant(orgB.id, (tx) =>
      tx.service.create({
        data: {
          organization: { connect: { id: orgB.id } },
          name: 'Service B',
          slug: 'wave5-service-b-' + suffix,
          durationMinutes: 15,
        },
      }),
    );

    const hoursA = await prisma.withTenant(orgA.id, (tx) =>
      tx.workingHours.create({
        data: {
          branchId: branchA.id,
          dayOfWeek: 0,
          openTime: '09:00',
          closeTime: '17:00',
          isClosed: false,
        },
      }),
    );
    const hoursB = await prisma.withTenant(orgB.id, (tx) =>
      tx.workingHours.create({
        data: {
          branchId: branchB.id,
          dayOfWeek: 0,
          openTime: '09:00',
          closeTime: '17:00',
          isClosed: false,
        },
      }),
    );

    const branchServiceA = await prisma.withTenant(orgA.id, (tx) =>
      tx.branchService.create({
        data: { branchId: branchA.id, serviceId: serviceA.id, isActive: true },
      }),
    );
    const branchServiceB = await prisma.withTenant(orgB.id, (tx) =>
      tx.branchService.create({
        data: { branchId: branchB.id, serviceId: serviceB.id, isActive: true },
      }),
    );

    const hoursVisibleA = await prisma.withTenant(orgA.id, (tx) => tx.workingHours.findMany());
    expect(hoursVisibleA.some((h) => h.id === hoursA.id)).toBe(true);
    expect(hoursVisibleA.some((h) => h.id === hoursB.id)).toBe(false);

    const branchServicesA = await prisma.withTenant(orgA.id, (tx) => tx.branchService.findMany());
    expect(branchServicesA.some((r) => r.id === branchServiceA.id)).toBe(true);
    expect(branchServicesA.some((r) => r.id === branchServiceB.id)).toBe(false);

    await prisma.withBypassRls(async (tx) => {
      await tx.branchService.deleteMany({
        where: { id: { in: [branchServiceA.id, branchServiceB.id] } },
      });
      await tx.workingHours.deleteMany({ where: { id: { in: [hoursA.id, hoursB.id] } } });
      await tx.service.deleteMany({ where: { id: { in: [serviceA.id, serviceB.id] } } });
      await tx.branch.deleteMany({ where: { id: { in: [branchA.id, branchB.id] } } });
      await tx.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    });
  }, 30000);
});
