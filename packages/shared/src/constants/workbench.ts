/** Actions a station may perform on tickets in a given queue lane. */
export const STATION_CAPABILITIES = {
  CALL: 'call',
  SERVE: 'serve',
  COMPLETE: 'complete',
  MARK_READY: 'mark_ready',
  NO_SHOW: 'no_show',
  CANCEL: 'cancel',
  TRANSFER: 'transfer',
} as const;

export type StationCapability = (typeof STATION_CAPABILITIES)[keyof typeof STATION_CAPABILITIES];

export const ALL_STATION_CAPABILITIES: StationCapability[] = Object.values(STATION_CAPABILITIES);

export const DEFAULT_SERVICE_CAPABILITIES: StationCapability[] = [
  STATION_CAPABILITIES.CALL,
  STATION_CAPABILITIES.SERVE,
  STATION_CAPABILITIES.COMPLETE,
  STATION_CAPABILITIES.NO_SHOW,
  STATION_CAPABILITIES.CANCEL,
  STATION_CAPABILITIES.TRANSFER,
];

export const DEFAULT_PICKUP_CAPABILITIES: StationCapability[] = [
  STATION_CAPABILITIES.MARK_READY,
  STATION_CAPABILITIES.CALL,
  STATION_CAPABILITIES.SERVE,
  STATION_CAPABILITIES.COMPLETE,
  STATION_CAPABILITIES.NO_SHOW,
  STATION_CAPABILITIES.CANCEL,
];

export const DEFAULT_COMBINED_CAPABILITIES: StationCapability[] = [
  ...DEFAULT_SERVICE_CAPABILITIES,
  STATION_CAPABILITIES.MARK_READY,
];

export function isReadyGatedCallingPolicy(policy?: string | null): boolean {
  return policy === 'ready_then_manual' || policy === 'ready_then_fifo';
}

/** Display name for the default multi-step workbench station profile. */
export const COMBINED_JOURNEY_STATION_PROFILE_NAME = 'Combined desk';

/** Legacy name — keep for lookups when migrating existing orgs. */
export const LEGACY_COMBINED_JOURNEY_STATION_PROFILE_NAME = 'Combined counter';

/** Capabilities every queue on the combined journey station profile should have. */
export function capabilitiesForJourneyFlowStep(stepRole?: string | null): StationCapability[] {
  return stepRole === 'pickup' ? DEFAULT_PICKUP_CAPABILITIES : DEFAULT_COMBINED_CAPABILITIES;
}

export function journeyProfileSupportsMarkReady(
  visibilityOnly: boolean,
  capabilities: unknown,
): boolean {
  if (visibilityOnly) return false;
  if (!Array.isArray(capabilities)) return false;
  return capabilities.includes(STATION_CAPABILITIES.MARK_READY);
}

/** Journey transaction refs are required from step 1 onward. */
export function journeyStepAcceptsExternalRef(
  stepIndex?: number | null,
  stepRole?: string | null,
): boolean {
  if (stepRole === 'service' || stepRole === 'pickup') return true;
  if (stepIndex != null && stepIndex >= 1) return true;
  return false;
}
