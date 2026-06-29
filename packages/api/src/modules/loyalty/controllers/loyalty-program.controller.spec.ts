import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyProgramController } from './loyalty-program.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyProgramController', () => {
  const program = {
    getOrCreateProgram: vi.fn(),
    updateProgram: vi.fn(),
    createTier: vi.fn(),
    createEarnRule: vi.fn(),
    updateEarnRule: vi.fn(),
  };
  let controller: LoyaltyProgramController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyProgramController(program as never);
  });

  it('gets or bootstraps program for org', async () => {
    program.getOrCreateProgram.mockResolvedValue({ id: 'prog-1' });
    await expect(controller.getProgram(USER)).resolves.toEqual({ id: 'prog-1' });
    expect(program.getOrCreateProgram).toHaveBeenCalledWith(ORG_ID);
  });

  it('updates program settings', async () => {
    const body = { pointsCurrencyName: 'Stars' };
    program.updateProgram.mockResolvedValue(body);
    await controller.updateProgram(USER, body as never);
    expect(program.updateProgram).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('creates tier', async () => {
    const body = { name: 'Gold', minPoints: 500 };
    program.createTier.mockResolvedValue({ id: 'tier-1' });
    await controller.createTier(USER, body as never);
    expect(program.createTier).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('creates earn rule', async () => {
    const body = { eventType: 'MANUAL', points: 10 };
    program.createEarnRule.mockResolvedValue({ id: 'rule-1' });
    await controller.createEarnRule(USER, body as never);
    expect(program.createEarnRule).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('updates earn rule by id', async () => {
    const body = { points: 25 };
    program.updateEarnRule.mockResolvedValue({ id: 'rule-1', points: 25 });
    await controller.updateEarnRule(USER, 'rule-1', body as never);
    expect(program.updateEarnRule).toHaveBeenCalledWith(ORG_ID, 'rule-1', body);
  });
});
