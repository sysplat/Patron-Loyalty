import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyGamificationController } from './loyalty-gamification.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyGamificationController', () => {
  const gamification = {
    listBadges: vi.fn(),
    createBadge: vi.fn(),
    listChallenges: vi.fn(),
    createChallenge: vi.fn(),
  };
  let controller: LoyaltyGamificationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyGamificationController(gamification as never);
  });

  it('lists badges for org', async () => {
    gamification.listBadges.mockResolvedValue([]);
    await controller.listBadges(USER);
    expect(gamification.listBadges).toHaveBeenCalledWith(ORG_ID);
  });

  it('creates badge', async () => {
    const body = { name: 'Regular', description: '10 visits' };
    gamification.createBadge.mockResolvedValue({ id: 'b1' });
    await controller.createBadge(USER, body as never);
    expect(gamification.createBadge).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('lists challenges for org', async () => {
    await controller.listChallenges(USER);
    expect(gamification.listChallenges).toHaveBeenCalledWith(ORG_ID);
  });

  it('creates challenge with parsed schedule', async () => {
    gamification.createChallenge.mockResolvedValue({ id: 'ch-1' });
    await controller.createChallenge(USER, {
      name: 'Summer sprint',
      targetValue: 5,
      startAt: '2026-06-01T00:00:00.000Z',
      endAt: '2026-08-31T23:59:59.000Z',
    } as never);
    expect(gamification.createChallenge).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        name: 'Summer sprint',
        startAt: new Date('2026-06-01T00:00:00.000Z'),
        endAt: new Date('2026-08-31T23:59:59.000Z'),
      }),
    );
  });
});
