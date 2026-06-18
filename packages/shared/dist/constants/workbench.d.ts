/** Actions a station may perform on tickets in a given queue lane. */
export declare const STATION_CAPABILITIES: {
    readonly CALL: "call";
    readonly SERVE: "serve";
    readonly COMPLETE: "complete";
    readonly MARK_READY: "mark_ready";
    readonly NO_SHOW: "no_show";
    readonly CANCEL: "cancel";
    readonly TRANSFER: "transfer";
};
export type StationCapability = (typeof STATION_CAPABILITIES)[keyof typeof STATION_CAPABILITIES];
export declare const ALL_STATION_CAPABILITIES: StationCapability[];
export declare const DEFAULT_SERVICE_CAPABILITIES: StationCapability[];
export declare const DEFAULT_PICKUP_CAPABILITIES: StationCapability[];
export declare const DEFAULT_COMBINED_CAPABILITIES: StationCapability[];
export declare function isReadyGatedCallingPolicy(policy?: string | null): boolean;
/** Display name for the default multi-step workbench station profile. */
export declare const COMBINED_JOURNEY_STATION_PROFILE_NAME = "Combined desk";
/** Legacy name — keep for lookups when migrating existing orgs. */
export declare const LEGACY_COMBINED_JOURNEY_STATION_PROFILE_NAME = "Combined counter";
/** Capabilities every queue on the combined journey station profile should have. */
export declare function capabilitiesForJourneyFlowStep(stepRole?: string | null): StationCapability[];
export declare function journeyProfileSupportsMarkReady(visibilityOnly: boolean, capabilities: unknown): boolean;
/** Journey transaction refs are required from step 1 onward. */
export declare function journeyStepAcceptsExternalRef(stepIndex?: number | null, stepRole?: string | null): boolean;
//# sourceMappingURL=workbench.d.ts.map