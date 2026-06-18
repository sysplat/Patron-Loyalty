import { z } from 'zod';

/** Admin links a TV-shown code to a branch (reverse pairing). */
export const linkDisplayScreenSchema = z.object({
  code: z.string().min(1).max(20),
  branchId: z.string().uuid(),
  name: z.string().min(1).max(100).trim().optional(),
  deviceId: z.string().uuid().optional(),
  deviceType: z.string().min(1).max(50).optional(),
});

export const claimReversePairingSchema = z.object({
  sessionId: z.string().uuid(),
  deviceFingerprint: z.string().min(1).max(200),
});

export const refreshDisplayTokenSchema = z.object({
  apiKey: z.string().min(1),
  deviceFingerprint: z.string().max(200).optional(),
});

export const createDisplayThemeSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  config: z.record(z.string(), z.unknown()),
});

export const updateDisplayDeviceSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    themeId: z.string().uuid().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const updateDisplayThemeSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
