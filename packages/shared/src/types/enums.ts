// ─── Enums ────────────────────────────────────────

/** Status of a user account */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

/** Status of a branch */
export enum BranchStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TEMPORARILY_CLOSED = 'temporarily_closed',
}

/** Status of a service */
export enum ServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** Queue operational status */
export enum QueueStatus {
  OPEN = 'open',
  PAUSED = 'paused',
  CLOSED = 'closed',
}

/** Ticket lifecycle status */
export enum TicketStatus {
  WAITING = 'waiting',
  CALLED = 'called',
  SERVING = 'serving',
  SERVED = 'served',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

/** How the ticket was booked */
export enum TicketSource {
  WALK_IN = 'walk_in',
  ONLINE = 'online',
  KIOSK = 'kiosk',
  STAFF = 'staff',
}

/** Appointment lifecycle status (Phase 2) */
export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

/** Notification delivery channel */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

/** Notification delivery status */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

/** Subscription plan status */
export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/** Invoice status */
export enum InvoiceStatus {
  DRAFT = 'draft',
  PAID = 'paid',
  OVERDUE = 'overdue',
  VOID = 'void',
}

/** Display device type */
export enum DisplayDeviceType {
  TV = 'tv',
  TABLET = 'tablet',
  DESK = 'desk',
}

/** Display device pairing status */
export enum DisplayDeviceStatus {
  UNPAIRED = 'unpaired',
  PAIRED = 'paired',
  OFFLINE = 'offline',
}

/** Review moderation status */
export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** Onboarding wizard steps */
export enum OnboardingStep {
  EMAIL_VERIFICATION = 'email_verification',
  SERVICE_SELECTION = 'service_selection',
  COMPANY_PROFILE = 'company_profile',
  LOCATION_SETUP = 'location_setup',
  REVIEW_SETUP = 'review_setup',
  COMPLETED = 'completed',
}

/** Days of the week */
export enum DayOfWeek {
  MONDAY = 0,
  TUESDAY = 1,
  WEDNESDAY = 2,
  THURSDAY = 3,
  FRIDAY = 4,
  SATURDAY = 5,
  SUNDAY = 6,
}

/** Queue rule types */
export enum QueueRuleType {
  MAX_WAIT_MINUTES = 'max_wait_minutes',
  AUTO_CLOSE_TIME = 'auto_close_time',
  MAX_CAPACITY = 'max_capacity',
  PRIORITY = 'priority',
  VIP = 'vip',
}
