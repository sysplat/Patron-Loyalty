export type AppointmentLifecycleStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentLifecycleStatus,
  AppointmentLifecycleStatus[]
> = {
  pending: ['confirmed', 'cancelled', 'completed', 'no_show'],
  confirmed: ['pending', 'cancelled', 'completed', 'no_show'],
  cancelled: ['pending', 'confirmed'],
  completed: ['confirmed'],
  no_show: ['pending', 'confirmed', 'cancelled'],
};

export interface AppointmentFilters {
  branchId?: string;
  serviceId?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
  allowedBranchIds?: string[] | null;
}

export interface AppointmentBookingInput {
  branchId: string;
  serviceId: string;
  subServiceId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  scheduledAt: string;
  notes?: string;
  transactionalSmsAllowed?: boolean;
  marketingSmsConsent?: boolean;
  marketingEmailConsent?: boolean;
}

export interface ServiceBookingConfig {
  id: string;
  name: string;
  durationMinutes: number | null;
  queueEnabled: boolean;
  serviceEstimateLowMinutes: number | null;
  serviceEstimateHighMinutes: number | null;
  appointmentEnabled: boolean;
  appointmentSlotInterval: number | null;
  appointmentLeadTimeMinutes: number;
  appointmentMaxAdvanceDays: number;
  appointmentBufferMinutes: number;
  appointmentRequiresEmail: boolean;
}

export interface WorkingHoursWindow {
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  breakStart: string | null;
  breakEnd: string | null;
}
