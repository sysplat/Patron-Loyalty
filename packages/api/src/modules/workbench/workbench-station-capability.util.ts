import type { StationCapability } from '@queueplatform/shared';

export function parseWorkbenchCapabilities(raw: unknown): StationCapability[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is StationCapability => typeof c === 'string');
}
