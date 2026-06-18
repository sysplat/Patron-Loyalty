"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const queue_stop_1 = require("./queue-stop");
(0, vitest_1.describe)('canStopQueue', () => {
    (0, vitest_1.describe)('with user context (backend)', () => {
        (0, vitest_1.it)('allows owner regardless of waiting count', () => {
            const ownerCtx = {
                isOwner: true,
                isAdmin: false,
                canStopEmptyQueue: false,
            };
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(ownerCtx, 0)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(ownerCtx, 5)).toBe(true);
        });
        (0, vitest_1.it)('allows admin regardless of waiting count', () => {
            const adminCtx = {
                isOwner: false,
                isAdmin: true,
                canStopEmptyQueue: true,
            };
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(adminCtx, 0)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(adminCtx, 3)).toBe(true);
        });
        (0, vitest_1.it)('allows manager and staff only when queue is empty', () => {
            const managerCtx = {
                isOwner: false,
                isAdmin: false,
                canStopEmptyQueue: true,
            };
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(managerCtx, 0)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(managerCtx, 1)).toBe(false);
            const staffCtx = {
                isOwner: false,
                isAdmin: false,
                canStopEmptyQueue: true,
            };
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(staffCtx, 0)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(staffCtx, 2)).toBe(false);
        });
        (0, vitest_1.it)('denies viewer and users without queue operate permission', () => {
            const viewerCtx = {
                isOwner: false,
                isAdmin: false,
                canStopEmptyQueue: false,
            };
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(viewerCtx, 0)).toBe(false);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(viewerCtx, 3)).toBe(false);
            const otherCtx = {
                isOwner: false,
                isAdmin: false,
                canStopEmptyQueue: false,
            };
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)(otherCtx, 0)).toBe(false);
        });
    });
    (0, vitest_1.describe)('with role string fallback (frontend)', () => {
        (0, vitest_1.it)('allows owner and admin regardless of waiting count', () => {
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('owner', 0)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('owner', 5)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('admin', 0)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('admin', 1)).toBe(true);
        });
        (0, vitest_1.it)('allows manager and staff only when queue is empty', () => {
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('manager', 0)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('manager', 3)).toBe(false);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('staff', 0)).toBe(true);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('staff', 1)).toBe(false);
        });
        (0, vitest_1.it)('denies viewer in all cases', () => {
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('viewer', 0)).toBe(false);
            (0, vitest_1.expect)((0, queue_stop_1.canStopQueue)('viewer', 3)).toBe(false);
        });
    });
});
//# sourceMappingURL=queue-stop.spec.js.map