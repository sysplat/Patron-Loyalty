"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDisplayThemeSchema = exports.updateDisplayDeviceSchema = exports.createDisplayThemeSchema = exports.refreshDisplayTokenSchema = exports.claimReversePairingSchema = exports.linkDisplayScreenSchema = void 0;
const zod_1 = require("zod");
/** Admin links a TV-shown code to a branch (reverse pairing). */
exports.linkDisplayScreenSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(20),
    branchId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    deviceId: zod_1.z.string().uuid().optional(),
    deviceType: zod_1.z.string().min(1).max(50).optional(),
});
exports.claimReversePairingSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
    deviceFingerprint: zod_1.z.string().min(1).max(200),
});
exports.refreshDisplayTokenSchema = zod_1.z.object({
    apiKey: zod_1.z.string().min(1),
    deviceFingerprint: zod_1.z.string().max(200).optional(),
});
exports.createDisplayThemeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim(),
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
exports.updateDisplayDeviceSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    themeId: zod_1.z.string().uuid().optional(),
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
})
    .strict();
exports.updateDisplayThemeSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
})
    .strict();
//# sourceMappingURL=display.validators.js.map