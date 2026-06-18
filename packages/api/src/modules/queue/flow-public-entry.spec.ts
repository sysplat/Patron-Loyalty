import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  assertPublicQueueEntryAllowed,
  assertServicesAssignedToBranch,
  filterPublicKioskQueues,
  getNonEntryQueueIdsFromFlowSteps,
  isServiceAvailableAtBranch,
} from './flow-public-entry';

describe('flow-public-entry', () => {
  describe('getNonEntryQueueIdsFromFlowSteps', () => {
    it('excludes step 2+ queues when flow starts at step 1', () => {
      const excluded = getNonEntryQueueIdsFromFlowSteps([
        { templateId: 't1', stepIndex: 1, queueId: 'q-order' },
        { templateId: 't1', stepIndex: 2, queueId: 'q-prep' },
      ]);
      expect(excluded.has('q-order')).toBe(false);
      expect(excluded.has('q-prep')).toBe(true);
    });

    it('keeps only minimum step index as entry when indices do not start at 1', () => {
      const excluded = getNonEntryQueueIdsFromFlowSteps([
        { templateId: 't1', stepIndex: 5, queueId: 'q-a' },
        { templateId: 't1', stepIndex: 10, queueId: 'q-b' },
      ]);
      expect(excluded.has('q-a')).toBe(false);
      expect(excluded.has('q-b')).toBe(true);
    });

    it('returns empty set when there are no steps', () => {
      expect(getNonEntryQueueIdsFromFlowSteps([]).size).toBe(0);
    });
  });

  describe('isServiceAvailableAtBranch', () => {
    it('allows org-wide services with no branch pivots', () => {
      expect(isServiceAvailableAtBranch({ id: 's1', branchServices: [] }, 'branch-a')).toBe(true);
    });

    it('allows services assigned to the branch', () => {
      expect(
        isServiceAvailableAtBranch(
          { id: 's1', branchServices: [{ branchId: 'branch-a', isActive: true }] },
          'branch-a',
        ),
      ).toBe(true);
    });

    it('rejects services assigned only to another branch', () => {
      expect(
        isServiceAvailableAtBranch(
          { id: 's1', branchServices: [{ branchId: 'branch-b', isActive: true }] },
          'branch-a',
        ),
      ).toBe(false);
    });
  });

  describe('assertServicesAssignedToBranch', () => {
    it('throws when a service is not assigned to the template branch', async () => {
      const tx = {
        service: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'svc-1',
              name: 'Radiology',
              branchServices: [{ branchId: 'other-branch', isActive: true }],
            },
          ]),
        },
      };

      await expect(
        assertServicesAssignedToBranch(tx, 'org-1', 'branch-a', ['svc-1']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('filterPublicKioskQueues', () => {
    const general = { id: 'svc-general', name: 'General Consultation' };
    const pharmacy = { id: 'svc-pharmacy', name: 'Pharmacy' };

    it('drops standalone queues that duplicate the flow entry service', () => {
      const steps = [
        { templateId: 't1', stepIndex: 1, queueId: 'q-reception' },
        { templateId: 't1', stepIndex: 2, queueId: 'q-lab' },
        { templateId: 't1', stepIndex: 3, queueId: 'q-pharmacy-flow' },
      ];
      const queues = [
        { id: 'q-reception', name: 'Phone Demo • Reception', service: general },
        { id: 'q-main', name: 'Main Lounge', service: general },
        { id: 'q-pharmacy', name: 'Pharmacy Window', service: pharmacy },
      ];

      const result = filterPublicKioskQueues(queues, steps);

      expect(result.map((q) => q.id)).toEqual(['q-reception', 'q-pharmacy']);
    });

    it('returns all queues unchanged when there is no multi-step flow', () => {
      const queues = [
        { id: 'q-a', name: 'A', service: general },
        { id: 'q-b', name: 'B', service: general },
      ];

      expect(filterPublicKioskQueues(queues, []).map((q) => q.id)).toEqual(['q-a', 'q-b']);
      expect(
        filterPublicKioskQueues(queues, [{ templateId: 't1', stepIndex: 1, queueId: 'q-a' }]).map(
          (q) => q.id,
        ),
      ).toEqual(['q-a', 'q-b']);
    });
  });

  describe('assertPublicQueueEntryAllowed', () => {
    it('blocks joining a later-step queue on the active flow', async () => {
      const db = {
        queue: {
          findFirst: vi.fn().mockResolvedValue({ stepRole: 'service' }),
        },
        branchFlowTemplate: {
          findMany: vi.fn().mockResolvedValue([
            {
              steps: [
                { templateId: 't1', stepIndex: 1, queueId: 'q-order' },
                { templateId: 't1', stepIndex: 2, queueId: 'q-prep' },
              ],
            },
          ]),
        },
      };

      await expect(
        assertPublicQueueEntryAllowed(db as any, 'org-1', 'branch-a', 'q-prep'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        assertPublicQueueEntryAllowed(db as any, 'org-1', 'branch-a', 'q-order'),
      ).resolves.toBeUndefined();
    });

    it('blocks joining a queue with pickup stepRole directly', async () => {
      const db = {
        queue: {
          findFirst: vi.fn().mockResolvedValue({ stepRole: 'pickup' }),
        },
        branchFlowTemplate: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      await expect(
        assertPublicQueueEntryAllowed(db as any, 'org-1', 'branch-a', 'q-pickup'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
