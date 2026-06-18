"use strict";
// ─── Enums ────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueRuleType = exports.DayOfWeek = exports.OnboardingStep = exports.ReviewStatus = exports.DisplayDeviceStatus = exports.DisplayDeviceType = exports.InvoiceStatus = exports.SubscriptionStatus = exports.NotificationStatus = exports.NotificationChannel = exports.AppointmentStatus = exports.TicketSource = exports.TicketStatus = exports.QueueStatus = exports.ServiceStatus = exports.BranchStatus = exports.UserStatus = void 0;
/** Status of a user account */
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
    UserStatus["SUSPENDED"] = "suspended";
    UserStatus["PENDING_VERIFICATION"] = "pending_verification";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
/** Status of a branch */
var BranchStatus;
(function (BranchStatus) {
    BranchStatus["ACTIVE"] = "active";
    BranchStatus["INACTIVE"] = "inactive";
    BranchStatus["TEMPORARILY_CLOSED"] = "temporarily_closed";
})(BranchStatus || (exports.BranchStatus = BranchStatus = {}));
/** Status of a service */
var ServiceStatus;
(function (ServiceStatus) {
    ServiceStatus["ACTIVE"] = "active";
    ServiceStatus["INACTIVE"] = "inactive";
})(ServiceStatus || (exports.ServiceStatus = ServiceStatus = {}));
/** Queue operational status */
var QueueStatus;
(function (QueueStatus) {
    QueueStatus["OPEN"] = "open";
    QueueStatus["PAUSED"] = "paused";
    QueueStatus["CLOSED"] = "closed";
})(QueueStatus || (exports.QueueStatus = QueueStatus = {}));
/** Ticket lifecycle status */
var TicketStatus;
(function (TicketStatus) {
    TicketStatus["WAITING"] = "waiting";
    TicketStatus["CALLED"] = "called";
    TicketStatus["SERVING"] = "serving";
    TicketStatus["SERVED"] = "served";
    TicketStatus["COMPLETED"] = "completed";
    TicketStatus["CANCELLED"] = "cancelled";
    TicketStatus["NO_SHOW"] = "no_show";
})(TicketStatus || (exports.TicketStatus = TicketStatus = {}));
/** How the ticket was booked */
var TicketSource;
(function (TicketSource) {
    TicketSource["WALK_IN"] = "walk_in";
    TicketSource["ONLINE"] = "online";
    TicketSource["KIOSK"] = "kiosk";
    TicketSource["STAFF"] = "staff";
})(TicketSource || (exports.TicketSource = TicketSource = {}));
/** Appointment lifecycle status (Phase 2) */
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "pending";
    AppointmentStatus["CONFIRMED"] = "confirmed";
    AppointmentStatus["CANCELLED"] = "cancelled";
    AppointmentStatus["COMPLETED"] = "completed";
    AppointmentStatus["NO_SHOW"] = "no_show";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
/** Notification delivery channel */
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["EMAIL"] = "email";
    NotificationChannel["SMS"] = "sms";
    NotificationChannel["PUSH"] = "push";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
/** Notification delivery status */
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "pending";
    NotificationStatus["SENT"] = "sent";
    NotificationStatus["DELIVERED"] = "delivered";
    NotificationStatus["FAILED"] = "failed";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
/** Subscription plan status */
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["TRIALING"] = "trialing";
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["PAST_DUE"] = "past_due";
    SubscriptionStatus["CANCELLED"] = "cancelled";
    SubscriptionStatus["EXPIRED"] = "expired";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
/** Invoice status */
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "draft";
    InvoiceStatus["PAID"] = "paid";
    InvoiceStatus["OVERDUE"] = "overdue";
    InvoiceStatus["VOID"] = "void";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
/** Display device type */
var DisplayDeviceType;
(function (DisplayDeviceType) {
    DisplayDeviceType["TV"] = "tv";
    DisplayDeviceType["TABLET"] = "tablet";
    DisplayDeviceType["DESK"] = "desk";
})(DisplayDeviceType || (exports.DisplayDeviceType = DisplayDeviceType = {}));
/** Display device pairing status */
var DisplayDeviceStatus;
(function (DisplayDeviceStatus) {
    DisplayDeviceStatus["UNPAIRED"] = "unpaired";
    DisplayDeviceStatus["PAIRED"] = "paired";
    DisplayDeviceStatus["OFFLINE"] = "offline";
})(DisplayDeviceStatus || (exports.DisplayDeviceStatus = DisplayDeviceStatus = {}));
/** Review moderation status */
var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING"] = "pending";
    ReviewStatus["APPROVED"] = "approved";
    ReviewStatus["REJECTED"] = "rejected";
})(ReviewStatus || (exports.ReviewStatus = ReviewStatus = {}));
/** Onboarding wizard steps */
var OnboardingStep;
(function (OnboardingStep) {
    OnboardingStep["EMAIL_VERIFICATION"] = "email_verification";
    OnboardingStep["SERVICE_SELECTION"] = "service_selection";
    OnboardingStep["COMPANY_PROFILE"] = "company_profile";
    OnboardingStep["LOCATION_SETUP"] = "location_setup";
    OnboardingStep["REVIEW_SETUP"] = "review_setup";
    OnboardingStep["COMPLETED"] = "completed";
})(OnboardingStep || (exports.OnboardingStep = OnboardingStep = {}));
/** Days of the week */
var DayOfWeek;
(function (DayOfWeek) {
    DayOfWeek[DayOfWeek["MONDAY"] = 0] = "MONDAY";
    DayOfWeek[DayOfWeek["TUESDAY"] = 1] = "TUESDAY";
    DayOfWeek[DayOfWeek["WEDNESDAY"] = 2] = "WEDNESDAY";
    DayOfWeek[DayOfWeek["THURSDAY"] = 3] = "THURSDAY";
    DayOfWeek[DayOfWeek["FRIDAY"] = 4] = "FRIDAY";
    DayOfWeek[DayOfWeek["SATURDAY"] = 5] = "SATURDAY";
    DayOfWeek[DayOfWeek["SUNDAY"] = 6] = "SUNDAY";
})(DayOfWeek || (exports.DayOfWeek = DayOfWeek = {}));
/** Queue rule types */
var QueueRuleType;
(function (QueueRuleType) {
    QueueRuleType["MAX_WAIT_MINUTES"] = "max_wait_minutes";
    QueueRuleType["AUTO_CLOSE_TIME"] = "auto_close_time";
    QueueRuleType["MAX_CAPACITY"] = "max_capacity";
    QueueRuleType["PRIORITY"] = "priority";
    QueueRuleType["VIP"] = "vip";
})(QueueRuleType || (exports.QueueRuleType = QueueRuleType = {}));
//# sourceMappingURL=enums.js.map