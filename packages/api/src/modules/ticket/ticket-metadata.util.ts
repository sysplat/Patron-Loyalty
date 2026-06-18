import { Prisma } from '@prisma/client';

/** Set when undoing start-serving → called; triggers a fresh "your turn" SMS on next serve. */
export const METADATA_RESUMMON_SMS_ON_SERVE = 'resummonSmsOnServe';

export function mergeTicketMetadata(
  existing: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    existing !== null &&
    existing !== undefined &&
    typeof existing === 'object' &&
    !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

export function ticketMetadataFlag(
  metadata: Prisma.JsonValue | null | undefined,
  key: string,
): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[key] === true;
}

export function clearTicketMetadataFlag(
  metadata: Prisma.JsonValue | null | undefined,
  key: string,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return Prisma.JsonNull;
  }
  const next = { ...(metadata as Record<string, unknown>) };
  delete next[key];
  return Object.keys(next).length > 0 ? (next as Prisma.InputJsonValue) : Prisma.JsonNull;
}
