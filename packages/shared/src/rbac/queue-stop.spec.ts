import { describe, expect, it } from 'vitest';
import { canStopQueue, type QueueStopUserContext } from './queue-stop';

describe('canStopQueue', () => {
  describe('with user context (backend)', () => {
    it('allows owner regardless of waiting count', () => {
      const ownerCtx: QueueStopUserContext = {
        isOwner: true,
        isAdmin: false,
        canStopEmptyQueue: false,
      };
      expect(canStopQueue(ownerCtx, 0)).toBe(true);
      expect(canStopQueue(ownerCtx, 5)).toBe(true);
    });

    it('allows admin regardless of waiting count', () => {
      const adminCtx: QueueStopUserContext = {
        isOwner: false,
        isAdmin: true,
        canStopEmptyQueue: true,
      };
      expect(canStopQueue(adminCtx, 0)).toBe(true);
      expect(canStopQueue(adminCtx, 3)).toBe(true);
    });

    it('allows manager and staff only when queue is empty', () => {
      const managerCtx: QueueStopUserContext = {
        isOwner: false,
        isAdmin: false,
        canStopEmptyQueue: true,
      };
      expect(canStopQueue(managerCtx, 0)).toBe(true);
      expect(canStopQueue(managerCtx, 1)).toBe(false);

      const staffCtx: QueueStopUserContext = {
        isOwner: false,
        isAdmin: false,
        canStopEmptyQueue: true,
      };
      expect(canStopQueue(staffCtx, 0)).toBe(true);
      expect(canStopQueue(staffCtx, 2)).toBe(false);
    });

    it('denies viewer and users without queue operate permission', () => {
      const viewerCtx: QueueStopUserContext = {
        isOwner: false,
        isAdmin: false,
        canStopEmptyQueue: false,
      };
      expect(canStopQueue(viewerCtx, 0)).toBe(false);
      expect(canStopQueue(viewerCtx, 3)).toBe(false);

      const otherCtx: QueueStopUserContext = {
        isOwner: false,
        isAdmin: false,
        canStopEmptyQueue: false,
      };
      expect(canStopQueue(otherCtx, 0)).toBe(false);
    });
  });

  describe('with role string fallback (frontend)', () => {
    it('allows owner and admin regardless of waiting count', () => {
      expect(canStopQueue('owner', 0)).toBe(true);
      expect(canStopQueue('owner', 5)).toBe(true);
      expect(canStopQueue('admin', 0)).toBe(true);
      expect(canStopQueue('admin', 1)).toBe(true);
    });

    it('allows manager and staff only when queue is empty', () => {
      expect(canStopQueue('manager', 0)).toBe(true);
      expect(canStopQueue('manager', 3)).toBe(false);
      expect(canStopQueue('staff', 0)).toBe(true);
      expect(canStopQueue('staff', 1)).toBe(false);
    });

    it('denies viewer in all cases', () => {
      expect(canStopQueue('viewer', 0)).toBe(false);
      expect(canStopQueue('viewer', 3)).toBe(false);
    });
  });
});
