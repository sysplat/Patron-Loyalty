import { z } from 'zod';
import { ALL_STATION_CAPABILITIES } from '../constants/workbench';
import { deskNumberSchema, uuidSchema } from './common.validators';

const stationCapabilitySchema = z.enum(ALL_STATION_CAPABILITIES as [string, ...string[]]);

export const stationProfileQueueSchema = z.object({
  queueId: uuidSchema,
  sortOrder: z.number().int().min(0).optional(),
  visibilityOnly: z.boolean().optional(),
  capabilities: z.array(stationCapabilitySchema).optional(),
});

export const createStationProfileSchema = z.object({
  branchId: uuidSchema,
  name: z.string().min(1).max(100).trim(),
  primaryQueueId: uuidSchema.nullable().optional(),
  flowTemplateId: uuidSchema.nullable().optional(),
  isDefault: z.boolean().optional(),
  queues: z.array(stationProfileQueueSchema).min(1),
});

export const updateStationProfileSchema = createStationProfileSchema.partial();

export const startAgentSessionSchema = z.object({
  branchId: uuidSchema,
  stationProfileId: uuidSchema,
  deskId: uuidSchema.nullable().optional(),
  deskNumber: deskNumberSchema.nullable().optional(),
  surface: z.string().max(30).optional(),
});

export const agentSessionHeartbeatSchema = z.object({
  sessionId: uuidSchema.optional(),
  surface: z.string().max(30).optional(),
});

export const workbenchSessionSchema = z.object({
  branchId: uuidSchema,
  deskNumber: deskNumberSchema,
  stationProfileId: uuidSchema.optional(),
});

const workbenchActionBase = {
  stationProfileId: uuidSchema,
  ticketId: uuidSchema,
};

export const workbenchCallNextSchema = z.object({
  stationProfileId: uuidSchema,
  queueId: uuidSchema,
  deskNumber: deskNumberSchema,
  deskFilterActive: z.boolean().optional(),
});

export const workbenchCallSpecificSchema = z.object({
  ...workbenchActionBase,
  deskNumber: deskNumberSchema,
});

export const workbenchTicketActionSchema = z.object(workbenchActionBase);

export const workbenchCompleteSchema = z.object({
  ...workbenchActionBase,
  externalRef: z.string().max(100).optional(),
});

export const workbenchCancelSchema = z.object({
  ...workbenchActionBase,
  reason: z.string().max(500).optional(),
});
