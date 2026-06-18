// ─── Core API Types ──────────────────────────────
// Shared between frontend and backend

import type {
  UserStatus,
  BranchStatus,
  ServiceStatus,
  QueueStatus,
  TicketStatus,
  TicketSource,
  DisplayDeviceType,
  DisplayDeviceStatus,
  OnboardingStep,
  SubscriptionStatus,
  NotificationChannel,
  DayOfWeek,
} from './enums';

// ─── Base ────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Auth ────────────────────────────────────────

export interface RegisterInput {
  businessName: string;
  email: string;
  password: string;
  phone?: string;
  acceptLegal: true;
}

export interface LoginInput {
  email: string;
  password: string;
  orgId?: string;
  /** When true, second factor is Admin Dashboard TOTP (not organization app 2FA). */
  platformAdmin?: boolean;
}

export interface LoginResponse {
  requiresOrgSelection?: boolean;
  organizations?: Array<{ id: string; name: string; slug: string }>;
  requiresTwoFactor?: boolean;
  /** Present when `platformAdmin` login requires the separate admin authenticator entry. */
  adminDashboardTwoFactor?: boolean;
  twoFactorToken?: string;
  user?: UserDto & { orgId: string; twoFactorEnabled: boolean; role?: string };
  organization?: OrganizationDto;
  tokens?: { accessToken: string; refreshToken: string };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface VerifyEmailInput {
  token: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

// ─── User ────────────────────────────────────────

export interface UserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface InviteUserInput {
  email: string;
  roleId: string;
  branchIds?: string[];
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}

// ─── Organization ────────────────────────────────

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  industry: string | null;
  timezone: string;
  country: string | null;
  logoUrl: string | null;
  onboardingStep: OnboardingStep;
  createdAt: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  website?: string;
  industry?: string;
  timezone?: string;
  country?: string;
  logoUrl?: string;
}

// ─── Branch ──────────────────────────────────────

export interface BranchDto {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string;
  phone: string | null;
  email: string | null;
  status: BranchStatus;
  createdAt: string;
}

export interface CreateBranchInput {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  timezone: string;
  phone?: string;
  email?: string;
}

export interface UpdateBranchInput extends Partial<CreateBranchInput> {
  status?: BranchStatus;
}

// ─── Working Hours ───────────────────────────────

export interface WorkingHoursDto {
  id: string;
  branchId: string;
  dayOfWeek: DayOfWeek;
  openTime: string; // "09:00"
  closeTime: string; // "17:00"
  isClosed: boolean;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface SetWorkingHoursInput {
  hours: Array<{
    dayOfWeek: DayOfWeek;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
    breakStart?: string;
    breakEnd?: string;
  }>;
}

// ─── Service ─────────────────────────────────────

export interface ServiceDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number | null;
  categoryId: string | null;
  status: ServiceStatus;
  sortOrder: number;
  createdAt: string;
}

export interface CreateServiceInput {
  name: string;
  description?: string;
  durationMinutes?: number;
  categoryId?: string;
  branchIds?: string[];
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
  status?: ServiceStatus;
  sortOrder?: number;
}

export interface ServiceCategoryDto {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
}

// ─── Queue ───────────────────────────────────────

export interface QueueDto {
  id: string;
  branchId: string;
  serviceId: string;
  name: string;
  prefix: string;
  status: QueueStatus;
  currentNumber: number;
  maxCapacity: number | null;
  journeyModeOverride?: string | null;
  stepRole?: 'service' | 'pickup' | null;
  callingPolicy?: 'fifo' | 'manual_only' | 'ready_then_manual' | 'ready_then_fifo';
  flowTemplateId?: string | null;
  createdAt: string;
  // Computed live stats
  waitingCount?: number;
  servingCount?: number;
  avgWaitMinutes?: number;
}

export interface CreateQueueInput {
  branchId: string;
  serviceId: string;
  name: string;
  prefix: string;
  maxCapacity?: number;
  journeyModeOverride?: 'single_ticket' | 'visit_multi_step' | null;
  stepRole?: 'service' | 'pickup' | null;
  callingPolicy?: 'fifo' | 'manual_only' | 'ready_then_manual' | 'ready_then_fifo';
  flowTemplateId?: string | null;
}

export interface UpdateQueueInput {
  name?: string;
  prefix?: string;
  maxCapacity?: number;
  journeyModeOverride?: 'single_ticket' | 'visit_multi_step' | null;
  stepRole?: 'service' | 'pickup' | null;
  callingPolicy?: 'fifo' | 'manual_only' | 'ready_then_manual' | 'ready_then_fifo';
  flowTemplateId?: string | null;
}

// ─── Ticket ──────────────────────────────────────

export interface TicketDto {
  id: string;
  queueId: string;
  branchId: string;
  serviceId: string;
  ticketNumber: string;
  displayNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  status: TicketStatus;
  priority: number;
  position: number | null;
  estimatedWaitMinutes: number | null;
  deskNumber: string | null;
  servedByUserId: string | null;
  source: TicketSource;
  bookedAt: string;
  calledAt: string | null;
  servedAt: string | null;
  completedAt: string | null;
}

export interface BookTicketInput {
  queueId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  source?: TicketSource;
  priority?: number;
}

export interface CallTicketInput {
  queueId: string;
  deskNumber?: string;
  staffUserId: string;
}

export interface TransferTicketInput {
  targetQueueId: string;
  targetDeskNumber?: string;
}

// ─── Display ─────────────────────────────────────

export interface DisplayDeviceDto {
  id: string;
  branchId: string;
  name: string;
  type: DisplayDeviceType;
  status: DisplayDeviceStatus;
  lastSeenAt: string | null;
  config: Record<string, unknown>;
}

export interface DisplaySessionDto {
  sessionToken: string;
  device: DisplayDeviceDto;
  theme: DisplayThemeDto;
  branch: BranchDto;
  services: ServiceDto[];
}

export interface DisplayThemeDto {
  id: string;
  name: string;
  type: DisplayDeviceType;
  config: DisplayThemeConfig;
}

export interface DisplayThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontSize: 'normal' | 'large' | 'xlarge';
  logoUrl: string | null;
  layout: 'grid' | 'list' | 'ticker';
  voiceEnabled: boolean;
  voiceLanguage: string;
  voiceVolume: number;
  showEstimatedWait: boolean;
  announcementText: string | null;
}

// ─── Notification ────────────────────────────────

export interface NotificationTemplateDto {
  id: string;
  type: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  variables: string[];
}

export interface UpdateNotificationTemplateInput {
  subject?: string;
  body: string;
}

// ─── Reports ─────────────────────────────────────

export interface ReportOverviewDto {
  totalTicketsToday: number;
  totalTicketsWeek: number;
  avgWaitTimeMinutes: number;
  avgServiceTimeMinutes: number;
  customerSatisfaction: number | null;
  activeQueues: number;
  ticketsByStatus: Record<string, number>;
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  branchId?: string;
  serviceId?: string;
  groupBy?: 'day' | 'week' | 'month';
}

// ─── Billing / Subscription ─────────────────────

export interface PlanDto {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  features: Record<string, boolean>;
  limits: PlanLimits;
}

export interface PlanLimits {
  maxBranches: number;
  maxUsers: number;
  maxQueuesPerBranch: number;
  maxTicketsPerMonth: number;
  maxDevices: number;
  hasAdvancedReports: boolean;
  hasCustomBranding: boolean;
  hasSmsNotifications: boolean;
  hasApiAccess: boolean;
  hasCrmIntegration: boolean;
  /** Lifetime SMS sends for the org (not monthly; does not reset by calendar). */
  smsCreditsTotal?: number;
  /** @deprecated Use smsCreditsTotal — kept for existing plan JSON in the database. */
  smsCreditsPerMonth?: number;
}

export interface SubscriptionDto {
  id: string;
  planId: string;
  plan: PlanDto;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
}

// ─── Roles & Permissions ─────────────────────────

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  permissions: PermissionDto[];
}

export interface PermissionDto {
  id: string;
  resource: string;
  action: string;
  scope: 'own' | 'branch' | 'org';
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds: string[];
}

// ─── Review ──────────────────────────────────────

export interface ReviewDto {
  id: string;
  branchId: string | null;
  customerName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

// ─── Onboarding ──────────────────────────────────

export interface OnboardingProgressDto {
  step: OnboardingStep;
  completedSteps: OnboardingStep[];
  data: Record<string, unknown>;
}

export interface OnboardingServiceSelectionInput {
  modules: string[];
}

export interface OnboardingCompanyProfileInput {
  name: string;
  website?: string;
  industry: string;
  timezone: string;
  country: string;
  logoUrl?: string;
}

export interface OnboardingLocationInput {
  address: string;
  lat: number;
  lng: number;
}

// ─── Activity Log ────────────────────────────────

export interface ActivityLogDto {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

// ─── WebSocket Events (Real-time) ────────────────

export interface WsTicketEvent {
  type:
    | 'ticket_booked'
    | 'ticket_called'
    | 'ticket_completed'
    | 'ticket_cancelled'
    | 'ticket_no_show'
    | 'ticket_transferred';
  ticket: TicketDto;
  queueId: string;
  branchId: string;
  timestamp: string;
}

export interface WsQueueEvent {
  type: 'queue_opened' | 'queue_paused' | 'queue_closed' | 'queue_stats_updated';
  queueId: string;
  branchId: string;
  stats?: {
    waitingCount: number;
    servingCount: number;
    avgWaitMinutes: number;
  };
  timestamp: string;
}

export interface WsAnnouncementEvent {
  type: 'announcement';
  message: string;
  branchId: string;
  timestamp: string;
}
