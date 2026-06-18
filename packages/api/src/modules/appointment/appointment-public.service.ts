import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class AppointmentPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPublicById(id: string) {
    const appt = await this.prisma.withBypassRls((tx) =>
      tx.appointment.findUnique({
        where: { id },
        include: {
          branch: { select: { id: true, name: true, address: true, phone: true, timezone: true } },
          service: { select: { id: true, name: true, durationMinutes: true } },
          subService: { select: { id: true, name: true } },
        },
      }),
    );
    if (!appt) throw new NotFoundException('Appointment not found');

    const [waitingCount, inRoomCount, aheadAppointments] = await this.prisma.withTenant(
      appt.orgId,
      async (tx) => {
        return Promise.all([
          tx.ticket.count({
            where: {
              orgId: appt.orgId,
              branchId: appt.branchId,
              status: 'waiting',
              bookedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          }),
          tx.ticket.count({
            where: {
              orgId: appt.orgId,
              branchId: appt.branchId,
              status: { in: ['called', 'serving'] },
              bookedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          }),
          tx.appointment.count({
            where: {
              orgId: appt.orgId,
              branchId: appt.branchId,
              status: { in: ['pending', 'confirmed'] },
              scheduledAt: { lt: appt.scheduledAt },
            },
          }),
        ]);
      },
    );

    const avgMinutesPerCustomer = Math.max(5, appt.service?.durationMinutes ?? 15);
    const estimatedMinutes = Math.max(
      0,
      (waitingCount + aheadAppointments) * avgMinutesPerCustomer,
    );

    const org = await this.prisma.organization.findUnique({
      where: { id: appt.orgId },
      select: { name: true, logoUrl: true },
    });

    const { customerEmail: _email, customerPhone: _phone, notes: _notes, ...safe } = appt as any;
    return {
      ...safe,
      hasEmail: !!appt.customerEmail,
      hasPhone: !!appt.customerPhone,
      organization: {
        name: org?.name ?? 'Organization',
        logoUrl: org?.logoUrl ?? null,
      },
      liveMetrics: {
        queuePosition: aheadAppointments + 1,
        waitingCount,
        inRoomCount,
        estimatedMinutes,
      },
    };
  }

  async cancelPublic(id: string) {
    const appt = await this.prisma.withBypassRls((tx) =>
      tx.appointment.findUnique({ where: { id }, select: { orgId: true, status: true } }),
    );
    if (!appt) throw new NotFoundException('Appointment not found');
    if (!['pending', 'confirmed'].includes(appt.status)) {
      throw new BadRequestException('This appointment cannot be cancelled');
    }
    const updated = await this.prisma.withTenant(appt.orgId, (tx) =>
      tx.appointment.update({
        where: { id },
        data: { status: 'cancelled' },
      }),
    );

    await this.audit.logActivity({
      orgId: appt.orgId,
      action: 'appointment.cancel.public',
      resourceType: 'appointment',
      resourceId: id,
      metadata: {
        branchId: updated.branchId,
        previousStatus: appt.status,
        status: updated.status,
      },
    });
    await this.audit.logAudit({
      orgId: appt.orgId,
      action: 'update',
      tableName: 'appointments',
      recordId: id,
      oldValues: { status: appt.status },
      newValues: { status: updated.status },
    });

    return {
      id: updated.id,
      status: updated.status,
      cancelledAt: updated.updatedAt,
    };
  }

  async customerLookup(branchId: string, email?: string, phone?: string) {
    if (!email && !phone) return [];

    const branch = await this.prisma.withBypassRls((tx) =>
      tx.branch.findUnique({
        where: { id: branchId },
        select: { orgId: true },
      }),
    );
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const where: any = {};
    where.orgId = branch.orgId;
    where.branchId = branchId;
    if (email) where.customerEmail = email.toLowerCase();
    if (phone) where.customerPhone = phone;

    const appointments = await this.prisma.withTenant(branch.orgId, (tx) =>
      tx.appointment.findMany({
        where,
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          durationMinutes: true,
          customerName: true,
          service: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, timezone: true } },
          subService: { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 20,
      }),
    );
    return appointments.map((appointment) => {
      const { customerName: _omitCustomerName, ...publicAppointment } = appointment;
      return {
        ...publicAppointment,
        customerNameMasked: this.maskCustomerName(appointment.customerName),
      };
    });
  }

  private maskCustomerName(name?: string | null): string | null {
    if (!name) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (trimmed.length <= 1) return '*';
    if (trimmed.length === 2) return `${trimmed[0]}*`;
    return `${trimmed[0]}${'*'.repeat(Math.max(1, trimmed.length - 2))}${trimmed.at(-1)}`;
  }
}
