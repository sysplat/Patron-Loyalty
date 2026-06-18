import { createZodDto } from 'nestjs-zod';
import {
  anonymizeCustomerSchema,
  callNextTicketSchema,
  callWaitingTicketSchema,
  cancelTicketSchema,
  changeDeskTicketSchema,
  completeTicketBodySchema,
  createVisitStepSchema,
  ticketIdsBodySchema,
  issueTicketSchema,
  issueTicketStaffSchema,
  publicJoinQueueSchema,
  ticketIdBodySchema,
  transferTicketBodySchema,
  updateTicketEstimatesSchema,
  updateTicketPreferencesSchema,
} from '@queueplatform/shared';

export class IssueTicketDto extends createZodDto(issueTicketSchema) {}
export class IssueTicketStaffDto extends createZodDto(issueTicketStaffSchema) {}
export class PublicJoinQueueDto extends createZodDto(publicJoinQueueSchema) {}
export class CreateVisitStepDto extends createZodDto(createVisitStepSchema) {}
export class AnonymizeCustomerDto extends createZodDto(anonymizeCustomerSchema) {}
export class DeleteHistoryBulkDto extends createZodDto(ticketIdsBodySchema) {}
export class CallNextTicketDto extends createZodDto(callNextTicketSchema) {}
export class CallWaitingTicketDto extends createZodDto(callWaitingTicketSchema) {}
export class TicketIdBodyDto extends createZodDto(ticketIdBodySchema) {}
export class UpdateTicketEstimatesDto extends createZodDto(updateTicketEstimatesSchema) {}
export class CompleteTicketBodyDto extends createZodDto(completeTicketBodySchema) {}
export class CancelTicketDto extends createZodDto(cancelTicketSchema) {}
export class TransferTicketBodyDto extends createZodDto(transferTicketBodySchema) {}
export class ChangeDeskTicketDto extends createZodDto(changeDeskTicketSchema) {}
export class UpdateTicketPreferencesDto extends createZodDto(updateTicketPreferencesSchema) {}
