import type { Prisma } from '@prisma/client';

export interface CustomerContact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

/** Match tickets/visits by customer id or denormalized contact fields. */
export function ticketContactOr(customer: CustomerContact): Prisma.TicketWhereInput[] {
  const or: Prisma.TicketWhereInput[] = [{ customerId: customer.id }];
  if (customer.phone) {
    or.push({ customerPhone: customer.phone });
  }
  if (customer.email) {
    or.push({ customerEmail: { equals: customer.email, mode: 'insensitive' } });
  }
  return or;
}

export function visitContactOr(customer: CustomerContact): Prisma.VisitWhereInput[] {
  const or: Prisma.VisitWhereInput[] = [];
  if (customer.phone) {
    or.push({ customerPhone: customer.phone });
  }
  if (customer.email) {
    or.push({ customerEmail: { equals: customer.email, mode: 'insensitive' } });
  }
  if (or.length === 0) {
    or.push({ id: '00000000-0000-0000-0000-000000000000' });
  }
  return or;
}

export function appointmentContactOr(customer: CustomerContact): Prisma.AppointmentWhereInput[] {
  const or: Prisma.AppointmentWhereInput[] = [];
  if (customer.phone) {
    or.push({ customerPhone: customer.phone });
  }
  if (customer.email) {
    or.push({ customerEmail: { equals: customer.email, mode: 'insensitive' } });
  }
  if (or.length === 0) {
    or.push({ id: '00000000-0000-0000-0000-000000000000' });
  }
  return or;
}

export function reviewContactOr(customer: CustomerContact): Prisma.ReviewWhereInput[] {
  const or: Prisma.ReviewWhereInput[] = [
    { customerName: { equals: customer.name, mode: 'insensitive' } },
  ];
  if (customer.email) {
    or.push({ customerEmail: { equals: customer.email, mode: 'insensitive' } });
  }
  return or;
}

export function parseCustomerMetadata(metadata: unknown): {
  tags: string[];
  notes: string;
  externalId?: string;
} {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { tags: [], notes: '' };
  }
  const record = metadata as Record<string, unknown>;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : [];
  const notes = typeof record.notes === 'string' ? record.notes : '';
  const externalId = typeof record.externalId === 'string' ? record.externalId : undefined;
  return { tags, notes, externalId };
}

export function mergeCustomerMetadata(
  existing: unknown,
  patch: { tags?: string[]; notes?: string; externalId?: string },
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (patch.tags !== undefined) {
    base.tags = patch.tags;
  }
  if (patch.notes !== undefined) {
    base.notes = patch.notes;
  }
  if (patch.externalId !== undefined) {
    base.externalId = patch.externalId;
  }
  return base;
}

/** Phone OR clauses for customer lookup (exact + last-10-digit contains). */
export function customerPhoneOr(phone: string): { phone: string | { contains: string } }[] {
  const trimmed = phone.trim();
  if (!trimmed) return [];
  const normalized = trimmed.replace(/\D/g, '');
  const or: { phone: string | { contains: string } }[] = [{ phone: trimmed }];
  if (normalized.length >= 10) {
    or.push({ phone: { contains: normalized.slice(-10) } });
  }
  return or;
}
