/** BullMQ queue that backs all platform-wide scheduled (cron) work. */
export const SCHEDULED_JOBS_QUEUE = 'scheduled-jobs';

/**
 * Job names on the {@link SCHEDULED_JOBS_QUEUE}.
 *
 * `*.dispatch` jobs are the cron-triggered fan-out producers: a single instance
 * fires per schedule (BullMQ job-scheduler dedups across replicas), enumerates
 * tenants, and enqueues one `*.org` job per tenant. The `*.org` jobs are the
 * tenant-sharded units of work that any worker on any replica can process in
 * parallel. Plain jobs (no suffix) are global single-shot tasks.
 */
export const SCHEDULED_JOB = {
  AppointmentRemindersDispatch: 'appointment-reminders.dispatch',
  AppointmentRemindersOrg: 'appointment-reminders.org',
  HealthRollupDispatch: 'health-rollup.dispatch',
  HealthRollupOrg: 'health-rollup.org',
  PriorSessionCleanupDispatch: 'prior-session-cleanup.dispatch',
  PriorSessionCleanupOrg: 'prior-session-cleanup.org',
  ExpireStaleTickets: 'expire-stale-tickets',
  AnonymizePii: 'anonymize-pii',
  LoyaltyPointsExpiryDispatch: 'loyalty-points-expiry.dispatch',
  LoyaltyPointsExpiryOrg: 'loyalty-points-expiry.org',
  LoyaltyCampaignAutomationDispatch: 'loyalty-campaign-automation.dispatch',
  LoyaltyCampaignAutomationOrg: 'loyalty-campaign-automation.org',
  LoyaltyScheduledCampaignsDispatch: 'loyalty-scheduled-campaigns.dispatch',
  LoyaltyScheduledCampaignsOrg: 'loyalty-scheduled-campaigns.org',
} as const;

export type ScheduledJobName = (typeof SCHEDULED_JOB)[keyof typeof SCHEDULED_JOB];

/** Cron patterns for the repeatable dispatcher/global jobs (UTC). */
export const SCHEDULED_JOB_CRON = {
  appointmentReminders: '*/15 * * * *',
  healthRollup: '*/30 * * * *',
  priorSessionCleanup: '30 3 * * *',
  expireStaleTickets: '0 * * * *',
  anonymizePii: '0 2 * * *',
  loyaltyPointsExpiry: '0 4 * * *',
  loyaltyCampaignAutomation: '0 9 * * *',
  loyaltyScheduledCampaigns: '*/15 * * * *',
} as const;

/** Payload carried by tenant-sharded `*.org` jobs. */
export interface OrgScopedJobData {
  orgId: string;
}
