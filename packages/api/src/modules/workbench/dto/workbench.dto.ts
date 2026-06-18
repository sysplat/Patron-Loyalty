import { createZodDto } from 'nestjs-zod';
import {
  agentSessionHeartbeatSchema,
  createStationProfileSchema,
  startAgentSessionSchema,
  updateStationProfileSchema,
  workbenchCallNextSchema,
  workbenchCallSpecificSchema,
  workbenchCancelSchema,
  workbenchCompleteSchema,
  workbenchSessionSchema,
  workbenchTicketActionSchema,
} from '@queueplatform/shared';

export class CreateStationProfileDto extends createZodDto(createStationProfileSchema) {}
export class UpdateStationProfileDto extends createZodDto(updateStationProfileSchema) {}
export class StartAgentSessionDto extends createZodDto(startAgentSessionSchema) {}
export class AgentSessionHeartbeatDto extends createZodDto(agentSessionHeartbeatSchema) {}
export class WorkbenchSessionDto extends createZodDto(workbenchSessionSchema) {}
export class WorkbenchCallNextDto extends createZodDto(workbenchCallNextSchema) {}
export class WorkbenchCallSpecificDto extends createZodDto(workbenchCallSpecificSchema) {}
export class WorkbenchTicketActionDto extends createZodDto(workbenchTicketActionSchema) {}
export class WorkbenchCompleteDto extends createZodDto(workbenchCompleteSchema) {}
export class WorkbenchCancelDto extends createZodDto(workbenchCancelSchema) {}
