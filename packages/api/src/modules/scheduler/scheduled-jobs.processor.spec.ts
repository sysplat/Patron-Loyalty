import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledJobsProcessor } from './scheduled-jobs.processor';
import { SCHEDULED_JOB } from './scheduled-jobs.constants';

const mockQueue = { addBulk: vi.fn().mockResolvedValue([]) };
const mockPrisma = { organization: { findMany: vi.fn() } };
const mockConfig = { get: vi.fn() };
const mockAppointments = { sendDueReminders: vi.fn().mockResolvedValue(0) };
const mockTickets = {
  closePriorSessionWaitingTickets: vi.fn().mockResolvedValue({ closed: 0, dryRun: false }),
  expireStaleTickets: vi.fn().mockResolvedValue(0),
  anonymizeHistoricalPii: vi.fn().mockResolvedValue({ affected: 0, dryRun: false }),
};
const mockHealth = { computeSnapshotForOrg: vi.fn().mockResolvedValue(undefined) };
const mockLoyaltyExpiry = { expireForOrg: vi.fn().mockResolvedValue(0) };
const mockLoyaltyCampaignAutomation = { processDailyTriggers: vi.fn().mockResolvedValue(0) };
const mockLoyaltyCampaigns = { processDueScheduled: vi.fn().mockResolvedValue(0) };

const job = (name: string, data: Record<string, unknown> = {}) => ({ name, data }) as never;

describe('ScheduledJobsProcessor', () => {
  let processor: ScheduledJobsProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.get.mockImplementation((_k: string, d?: unknown) => d);
    processor = new ScheduledJobsProcessor(
      mockQueue as never,
      mockPrisma as never,
      mockConfig as never,
      mockAppointments as never,
      mockTickets as never,
      mockHealth as never,
      mockLoyaltyExpiry as never,
      mockLoyaltyCampaignAutomation as never,
      mockLoyaltyCampaigns as never,
    );
  });

  it('fans out one appointment-reminder job per active org', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);

    await processor.process(job(SCHEDULED_JOB.AppointmentRemindersDispatch));

    expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { not: 'suspended' } } }),
    );
    expect(mockQueue.addBulk).toHaveBeenCalledTimes(1);
    const bulk = mockQueue.addBulk.mock.calls[0][0];
    expect(bulk).toHaveLength(2);
    expect(bulk[0]).toMatchObject({
      name: SCHEDULED_JOB.AppointmentRemindersOrg,
      data: { orgId: 'org-1' },
    });
  });

  it('does not enqueue when there are no active orgs', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([]);

    await processor.process(job(SCHEDULED_JOB.HealthRollupDispatch));

    expect(mockQueue.addBulk).not.toHaveBeenCalled();
  });

  it('skips prior-session dispatch when the feature flag is disabled', async () => {
    mockConfig.get.mockImplementation((key: string, d?: unknown) =>
      key === 'app.queue.closePriorSessionWaiting' ? false : d,
    );

    await processor.process(job(SCHEDULED_JOB.PriorSessionCleanupDispatch));

    expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
    expect(mockQueue.addBulk).not.toHaveBeenCalled();
  });

  it('runs appointment reminders scoped to the job org', async () => {
    await processor.process(job(SCHEDULED_JOB.AppointmentRemindersOrg, { orgId: 'org-9' }));
    expect(mockAppointments.sendDueReminders).toHaveBeenCalledWith('org-9');
  });

  it('runs the health rollup scoped to the job org', async () => {
    await processor.process(job(SCHEDULED_JOB.HealthRollupOrg, { orgId: 'org-9' }));
    expect(mockHealth.computeSnapshotForOrg).toHaveBeenCalledWith('org-9');
  });

  it('runs prior-session cleanup scoped to the job org', async () => {
    await processor.process(job(SCHEDULED_JOB.PriorSessionCleanupOrg, { orgId: 'org-9' }));
    expect(mockTickets.closePriorSessionWaitingTickets).toHaveBeenCalledWith({ orgId: 'org-9' });
  });

  it('runs the global stale-ticket expiry with the configured threshold', async () => {
    mockConfig.get.mockImplementation((key: string, d?: unknown) =>
      key === 'STALE_TICKET_THRESHOLD_MINUTES' ? 90 : d,
    );
    await processor.process(job(SCHEDULED_JOB.ExpireStaleTickets));
    expect(mockTickets.expireStaleTickets).toHaveBeenCalledWith(90);
  });

  it('runs the global PII anonymization with retention/dry-run config', async () => {
    mockConfig.get.mockImplementation((key: string, d?: unknown) => {
      if (key === 'app.privacy.ticketPiiRetentionDays') return 45;
      if (key === 'app.privacy.ticketPiiAnonymizeDryRun') return true;
      return d;
    });
    await processor.process(job(SCHEDULED_JOB.AnonymizePii));
    expect(mockTickets.anonymizeHistoricalPii).toHaveBeenCalledWith(45, true);
  });

  it('ignores unknown job names', async () => {
    await processor.process(job('totally-unknown'));
    expect(mockQueue.addBulk).not.toHaveBeenCalled();
    expect(mockAppointments.sendDueReminders).not.toHaveBeenCalled();
  });
});
