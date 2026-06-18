import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  normalizeSmsRecipient,
  normalizeTimeZone,
  CURRENT_PRIVACY_VERSION,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { AppointmentSlotService } from './appointment-slot.service';
import type { AppointmentBookingInput } from './appointment.types';

@Injectable()
export class AppointmentBookingService {
  private readonly logger = new Logger(AppointmentBookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
    private readonly slots: AppointmentSlotService,
  ) {}

  private getConsentCaptureContext(): Prisma.InputJsonObject {
    const ctx = this.requestContext.getContext();
    return {
      ...(ctx?.ip ? { consentCaptureIp: ctx.ip } : {}),
      ...(ctx?.userAgent ? { consentCaptureUserAgent: ctx.userAgent } : {}),
    };
  }

  async book(data: AppointmentBookingInput) {
    const branch = await this.prisma.withBypassRls((tx) =>
      tx.branch.findUnique({
        where: { id: data.branchId },
        select: { orgId: true, id: true, name: true, address: true, phone: true, timezone: true },
      }),
    );
    if (!branch) throw new NotFoundException('Branch not found');
    const branchTimeZone = normalizeTimeZone(branch.timezone);

    const [service, branchService] = await Promise.all([
      this.slots.getBookableService(branch.orgId, data.serviceId),
      this.prisma.withTenant(branch.orgId, (tx) =>
        tx.branchService.findUnique({
          where: { branchId_serviceId: { branchId: data.branchId, serviceId: data.serviceId } },
          select: {
            isActive: true,
            customServiceEstimateLowMinutes: true,
            customServiceEstimateHighMinutes: true,
          },
        }),
      ),
    ]);

    if (!branchService || !branchService.isActive) {
      throw new BadRequestException(
        'This appointment service is not available at the selected branch',
      );
    }

    if (!data.customerEmail) {
      throw new BadRequestException('Email is required for appointments');
    }

    if (!data.customerPhone) {
      throw new BadRequestException('Phone number is required for appointments');
    }

    const subService = data.subServiceId
      ? await this.prisma.withTenant(branch.orgId, (tx) =>
          tx.subService.findFirst({
            where: { id: data.subServiceId, serviceId: data.serviceId, status: 'active' },
            select: { id: true, name: true, durationMinutes: true },
          }),
        )
      : null;

    if (data.subServiceId && !subService) {
      throw new NotFoundException('Sub-service not found');
    }

    const durationMinutes = this.slots.resolveAppointmentDurationMinutes(
      service,
      branchService.customServiceEstimateLowMinutes ?? null,
      branchService.customServiceEstimateHighMinutes ?? null,
      subService?.durationMinutes ?? null,
    );
    const scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid appointment date/time');
    }

    this.slots.validateAdvanceWindow(
      scheduledAt,
      service.appointmentLeadTimeMinutes,
      service.appointmentMaxAdvanceDays,
    );
    await this.slots.ensureSlotWithinWorkingHours(
      branch.orgId,
      data.branchId,
      branchTimeZone,
      scheduledAt,
      durationMinutes,
    );

    const normalizedCustomerPhone = data.customerPhone
      ? normalizeSmsRecipient(data.customerPhone)
      : undefined;
    if (data.transactionalSmsAllowed === true && !normalizedCustomerPhone) {
      throw new BadRequestException(
        'SMS notifications require a valid mobile number in international format (e.g. +15550001234)',
      );
    }
    const transactionalSmsAllowed = data.transactionalSmsAllowed ?? false;

    const { appointment: created, consentCustomerId } = await this.prisma.$transaction(
      async (tx) => {
        const overlapping = await this.slots.findOverlappingAppointment(tx, {
          branchId: data.branchId,
          serviceId: data.serviceId,
          scheduledAt,
          durationMinutes,
          bufferMinutes: service.appointmentBufferMinutes,
        });

        if (overlapping) {
          throw new ConflictException('Selected time slot is no longer available');
        }

        let consentCustomerId: string | null = null;

        const marketingSmsVal = data.marketingSmsConsent === true ? 'GRANTED' : undefined;
        const marketingEmailVal = data.marketingEmailConsent === true ? 'GRANTED' : undefined;
        const hasMarketingUpdate = !!marketingSmsVal || !!marketingEmailVal;

        if (normalizedCustomerPhone) {
          const customer = await tx.customer.findFirst({
            where: { orgId: branch.orgId, phone: normalizedCustomerPhone },
          });
          if (customer) {
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                name: data.customerName,
                email: data.customerEmail || customer.email,
                transactionalSmsAllowed,
                ...(marketingSmsVal && { marketingSmsConsent: marketingSmsVal }),
                ...(marketingEmailVal && { marketingEmailConsent: marketingEmailVal }),
                ...(hasMarketingUpdate && {
                  marketingConsentSource: 'appointment_booking',
                  marketingConsentVersion: CURRENT_PRIVACY_VERSION,
                  marketingConsentDate: new Date(),
                }),
              },
            });
            consentCustomerId = customer.id;
          } else {
            const newCustomer = await tx.customer.create({
              data: {
                orgId: branch.orgId,
                name: data.customerName,
                phone: normalizedCustomerPhone,
                email: data.customerEmail || null,
                transactionalSmsAllowed,
                smsConsentSource: 'appointment_booking',
                smsConsentVersion: CURRENT_PRIVACY_VERSION,
                ...(marketingSmsVal && { marketingSmsConsent: marketingSmsVal }),
                ...(marketingEmailVal && { marketingEmailConsent: marketingEmailVal }),
                ...(hasMarketingUpdate && {
                  marketingConsentSource: 'appointment_booking',
                  marketingConsentVersion: CURRENT_PRIVACY_VERSION,
                  marketingConsentDate: new Date(),
                }),
              },
            });
            consentCustomerId = newCustomer.id;
          }
        } else if (data.customerEmail) {
          const customer = await tx.customer.findFirst({
            where: { orgId: branch.orgId, email: data.customerEmail },
          });
          if (customer) {
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                name: data.customerName,
                phone: normalizedCustomerPhone || customer.phone,
                transactionalSmsAllowed,
                ...(marketingSmsVal && { marketingSmsConsent: marketingSmsVal }),
                ...(marketingEmailVal && { marketingEmailConsent: marketingEmailVal }),
                ...(hasMarketingUpdate && {
                  marketingConsentSource: 'appointment_booking',
                  marketingConsentVersion: CURRENT_PRIVACY_VERSION,
                  marketingConsentDate: new Date(),
                }),
              },
            });
            consentCustomerId = customer.id;
          } else {
            const newCustomer = await tx.customer.create({
              data: {
                orgId: branch.orgId,
                name: data.customerName,
                phone: normalizedCustomerPhone || null,
                email: data.customerEmail,
                transactionalSmsAllowed,
                smsConsentSource: 'appointment_booking',
                smsConsentVersion: CURRENT_PRIVACY_VERSION,
                ...(marketingSmsVal && { marketingSmsConsent: marketingSmsVal }),
                ...(marketingEmailVal && { marketingEmailConsent: marketingEmailVal }),
                ...(hasMarketingUpdate && {
                  marketingConsentSource: 'appointment_booking',
                  marketingConsentVersion: CURRENT_PRIVACY_VERSION,
                  marketingConsentDate: new Date(),
                }),
              },
            });
            consentCustomerId = newCustomer.id;
          }
        }

        if (consentCustomerId) {
          const ctx = this.requestContext.getContext();
          if (marketingSmsVal) {
            await tx.consentLedgerEntry.create({
              data: {
                orgId: branch.orgId,
                customerId: consentCustomerId,
                channel: 'sms',
                purpose: 'marketing',
                action: 'GRANTED',
                source: 'appointment_booking',
                legalVersion: CURRENT_PRIVACY_VERSION,
                ipAddress: ctx?.ip ?? null,
                userAgent: ctx?.userAgent ?? null,
              },
            });
          }
          if (marketingEmailVal) {
            await tx.consentLedgerEntry.create({
              data: {
                orgId: branch.orgId,
                customerId: consentCustomerId,
                channel: 'email',
                purpose: 'marketing',
                action: 'GRANTED',
                source: 'appointment_booking',
                legalVersion: CURRENT_PRIVACY_VERSION,
                ipAddress: ctx?.ip ?? null,
                userAgent: ctx?.userAgent ?? null,
              },
            });
          }
        }

        const appointment = await tx.appointment.create({
          data: {
            orgId: branch.orgId,
            branchId: data.branchId,
            serviceId: data.serviceId,
            subServiceId: data.subServiceId ?? null,
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: normalizedCustomerPhone,
            scheduledAt,
            durationMinutes,
            notes: data.notes,
            status: 'confirmed',
          },
        });

        return { appointment, consentCustomerId };
      },
    );

    await this.audit.logActivity({
      orgId: branch.orgId,
      action: 'appointment.book',
      resourceType: 'appointment',
      resourceId: created.id,
      metadata: {
        branchId: data.branchId,
        serviceId: data.serviceId,
        subServiceId: data.subServiceId ?? null,
        scheduledAt: created.scheduledAt.toISOString(),
        status: created.status,
      },
    });
    await this.audit.logActivity({
      orgId: branch.orgId,
      action: 'consent.sms.captured',
      resourceType: 'customer_consent',
      resourceId: consentCustomerId ?? created.id,
      metadata: {
        ...this.getConsentCaptureContext(),
        source: 'appointment_booking',
        policyVersion: CURRENT_PRIVACY_VERSION,
        channel: 'sms',
        purpose: 'transactional_appointment_updates',
        transactionalSmsAllowed,
        customerPhone: normalizedCustomerPhone ?? null,
        appointmentId: created.id,
      },
    });
    await this.audit.logAudit({
      orgId: branch.orgId,
      action: 'create',
      tableName: 'appointments',
      recordId: created.id,
      newValues: {
        branchId: created.branchId,
        serviceId: created.serviceId,
        subServiceId: created.subServiceId ?? null,
        scheduledAt: created.scheduledAt.toISOString(),
        durationMinutes: created.durationMinutes,
        status: created.status,
      },
    });

    if (data.customerEmail) {
      const dateStr = this.slots.formatInTimeZone(scheduledAt, branchTimeZone, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = this.slots.formatInTimeZone(scheduledAt, branchTimeZone, {
        hour: '2-digit',
        minute: '2-digit',
      });
      const trackUrl = `${process.env.APP_URL ?? 'http://localhost:3001'}/track/appointment/${created.id}`;
      const cancelUrl = `${process.env.APP_URL ?? 'http://localhost:3001'}/track/appointment/${created.id}?cancel=1`;
      const subServiceRow = subService?.name
        ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Type</td><td style="padding:8px 0;font-weight:600;text-align:right">${subService.name}</td></tr>`
        : '';

      this.notifications
        .send(branch.orgId, {
          channel: 'email',
          to: data.customerEmail,
          subject: `Appointment Confirmed – ${service.name}`,
          body: `
<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <div style="text-align:center;margin-bottom:32px">
    <div style="display:inline-block;background:#6366f1;color:#fff;font-size:14px;font-weight:800;letter-spacing:1px;padding:8px 16px;border-radius:8px">QlessQ</div>
  </div>
  <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">Your appointment is confirmed ✓</h1>
  <p style="color:#6b7280;margin:0 0 32px">Here's everything you need to know about your upcoming appointment.</p>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:24px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Service</td><td style="padding:8px 0;font-weight:600;text-align:right">${service.name}</td></tr>
            ${subServiceRow}
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Date</td><td style="padding:8px 0;font-weight:600;text-align:right">${dateStr}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Time</td><td style="padding:8px 0;font-weight:600;text-align:right">${timeStr}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Duration</td><td style="padding:8px 0;font-weight:600;text-align:right">${durationMinutes} minutes</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Branch</td><td style="padding:8px 0;font-weight:600;text-align:right">${branch.name ?? 'Selected branch'}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Reference</td><td style="padding:8px 0;font-weight:600;text-align:right;font-family:monospace;font-size:12px">${created.id}</td></tr>
    </table>
  </div>
  <div style="display:flex;gap:12px;margin-bottom:32px">
    <a href="${trackUrl}" style="display:inline-block;flex:1;background:#6366f1;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:600;text-align:center;font-size:14px">View Appointment →</a>
    <a href="${cancelUrl}" style="display:inline-block;flex:1;background:#fff;color:#374151;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:600;text-align:center;font-size:14px;border:1px solid #e5e7eb">Cancel</a>
  </div>
  <p style="font-size:12px;color:#9ca3af;text-align:center">If you didn't book this appointment, you can safely ignore this email.</p>
</div>`,
          metadata: {
            providerHint: 'twilio-sendgrid-ready',
            appointmentId: created.id,
            branchId: data.branchId,
            serviceId: data.serviceId,
          },
        })
        .catch((err) =>
          this.logger.warn(`Could not send booking confirmation email: ${err.message}`),
        );
    }

    let warning: string | undefined;
    if (normalizedCustomerPhone && transactionalSmsAllowed) {
      const org = await this.prisma.organization.findUnique({
        where: { id: branch.orgId },
        select: { name: true, website: true, country: true, industry: true },
      });
      const orgProfileComplete =
        !!org?.name?.trim() && !!org?.website && !!org?.country && !!org?.industry;
      if (!orgProfileComplete) {
        warning = 'Organization profile (website, country, industry) must be complete to send SMS.';
      }
      if (!warning) {
        this.notifications
          .notifyAppointmentBooked(branch.orgId, {
            appointmentId: created.id,
            customerPhone: normalizedCustomerPhone,
            customerName: data.customerName,
            serviceName: service.name,
            scheduledAt,
            branchName: branch.name,
            transactionalSmsAllowed,
          })
          .catch((err) =>
            this.logger.warn(`Could not send booking confirmation SMS: ${err.message}`),
          );
      }
    }

    if (warning) {
      return { ...created, warning };
    }
    return created;
  }
}
