import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { LOYALTY_EVENTS } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AppointmentQueryService } from './appointment-query.service';
import {
  APPOINTMENT_STATUS_TRANSITIONS,
  type AppointmentLifecycleStatus,
} from './appointment.types';
import {
  LoyaltyAppointmentCompletedEvent,
  LoyaltyAppointmentNoShowEvent,
} from '../loyalty/loyalty.events';

@Injectable()
export class AppointmentLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly query: AppointmentQueryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async update(
    orgId: string,
    id: string,
    actorUserId: string | undefined,
    data: { status?: string; assignedUserId?: string; notes?: string },
  ) {
    const existing = await this.query.getById(orgId, id);
    const normalizedStatus = data.status
      ? this.validateStatusTransition(existing.status as AppointmentLifecycleStatus, data.status)
      : undefined;
    const updated = await this.prisma.withTenant(orgId, (tx) =>
      tx.appointment.update({ where: { id }, data }),
    );

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: normalizedStatus ? 'appointment.status.update' : 'appointment.update',
      resourceType: 'appointment',
      resourceId: id,
      metadata: {
        ...(data as Prisma.InputJsonObject),
        ...(normalizedStatus
          ? {
              previousStatus: existing.status,
              status: normalizedStatus,
            }
          : {}),
      },
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'update',
      tableName: 'appointments',
      recordId: id,
      oldValues: {
        status: existing.status,
        assignedUserId: existing.assignedUserId ?? null,
        notes: existing.notes ?? null,
      },
      newValues: {
        status: updated.status,
        assignedUserId: updated.assignedUserId ?? null,
        notes: updated.notes ?? null,
      },
    });

    if (normalizedStatus === 'completed') {
      this.eventEmitter.emit(
        LOYALTY_EVENTS.APPOINTMENT_COMPLETED,
        new LoyaltyAppointmentCompletedEvent(
          orgId,
          id,
          null,
          existing.branchId,
          existing.customerPhone,
          existing.customerEmail,
        ),
      );
    }

    if (normalizedStatus === 'no_show') {
      this.eventEmitter.emit(
        LOYALTY_EVENTS.APPOINTMENT_NO_SHOW,
        new LoyaltyAppointmentNoShowEvent(
          orgId,
          id,
          null,
          existing.branchId,
          existing.customerPhone,
          existing.customerEmail,
        ),
      );
    }

    return updated;
  }

  async delete(orgId: string, id: string, actorUserId?: string) {
    const existing = await this.query.getById(orgId, id);
    await this.prisma.withTenant(orgId, (tx) => tx.appointment.delete({ where: { id } }));

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'appointment.delete',
      resourceType: 'appointment',
      resourceId: id,
      metadata: {
        branchId: existing.branchId,
        serviceId: existing.serviceId,
        status: existing.status,
      },
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'delete',
      tableName: 'appointments',
      recordId: id,
      oldValues: {
        branchId: existing.branchId,
        serviceId: existing.serviceId,
        status: existing.status,
        scheduledAt: existing.scheduledAt.toISOString(),
      },
    });
  }

  private validateStatusTransition(
    currentStatus: AppointmentLifecycleStatus,
    nextStatus: string,
  ): AppointmentLifecycleStatus {
    if (!this.isAppointmentStatus(nextStatus)) {
      throw new BadRequestException('Invalid appointment status');
    }

    if (currentStatus === nextStatus) {
      return nextStatus;
    }

    const allowedTransitions = APPOINTMENT_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowedTransitions.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot change appointment status from ${currentStatus} to ${nextStatus}`,
      );
    }

    return nextStatus;
  }

  private isAppointmentStatus(value: string): value is AppointmentLifecycleStatus {
    return value in APPOINTMENT_STATUS_TRANSITIONS;
  }
}
