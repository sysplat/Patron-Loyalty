import { z } from 'zod';
import { uuidSchema } from './common.validators';

const emptyToUndefined = (value: unknown) =>
  value === '' || value === undefined || value === null ? undefined : value;

const optionalCoercedInt = (min: number, max?: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int()
      .min(min)
      .max(max ?? Number.MAX_SAFE_INTEGER)
      .optional(),
  );

export const paginationQuerySchema = z.object({
  page: optionalCoercedInt(1, 10_000),
  limit: optionalCoercedInt(1, 100),
});

export const optionalUuidQuery = z.preprocess(emptyToUndefined, uuidSchema.optional());

export const optionalSearchQuery = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(200).optional(),
);

export const listTicketsQuerySchema = paginationQuerySchema.extend({
  branchId: optionalUuidQuery,
  queueId: optionalUuidQuery,
  status: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  date: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(32).optional()),
  dateFrom: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(32).optional()),
  dateTo: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(32).optional()),
  search: optionalSearchQuery,
  period: z.preprocess(emptyToUndefined, z.enum(['today', 'week']).optional()),
});

export const listUsersQuerySchema = paginationQuerySchema.extend({
  status: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(50).optional()),
  search: optionalSearchQuery,
});

export const listAppointmentsQuerySchema = paginationQuerySchema.extend({
  branchId: optionalUuidQuery,
  serviceId: optionalUuidQuery,
  status: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(50).optional()),
  from: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(32).optional()),
  to: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(32).optional()),
  search: optionalSearchQuery,
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
