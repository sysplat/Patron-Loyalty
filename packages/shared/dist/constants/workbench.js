"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_COMBINED_JOURNEY_STATION_PROFILE_NAME = exports.COMBINED_JOURNEY_STATION_PROFILE_NAME = exports.DEFAULT_COMBINED_CAPABILITIES = exports.DEFAULT_PICKUP_CAPABILITIES = exports.DEFAULT_SERVICE_CAPABILITIES = exports.ALL_STATION_CAPABILITIES = exports.STATION_CAPABILITIES = void 0;
exports.isReadyGatedCallingPolicy = isReadyGatedCallingPolicy;
exports.capabilitiesForJourneyFlowStep = capabilitiesForJourneyFlowStep;
exports.journeyProfileSupportsMarkReady = journeyProfileSupportsMarkReady;
exports.journeyStepAcceptsExternalRef = journeyStepAcceptsExternalRef;
/** Actions a station may perform on tickets in a given queue lane. */
exports.STATION_CAPABILITIES = {
    CALL: 'call',
    SERVE: 'serve',
    COMPLETE: 'complete',
    MARK_READY: 'mark_ready',
    NO_SHOW: 'no_show',
    CANCEL: 'cancel',
    TRANSFER: 'transfer',
};
exports.ALL_STATION_CAPABILITIES = Object.values(exports.STATION_CAPABILITIES);
exports.DEFAULT_SERVICE_CAPABILITIES = [
    exports.STATION_CAPABILITIES.CALL,
    exports.STATION_CAPABILITIES.SERVE,
    exports.STATION_CAPABILITIES.COMPLETE,
    exports.STATION_CAPABILITIES.NO_SHOW,
    exports.STATION_CAPABILITIES.CANCEL,
    exports.STATION_CAPABILITIES.TRANSFER,
];
exports.DEFAULT_PICKUP_CAPABILITIES = [
    exports.STATION_CAPABILITIES.MARK_READY,
    exports.STATION_CAPABILITIES.CALL,
    exports.STATION_CAPABILITIES.SERVE,
    exports.STATION_CAPABILITIES.COMPLETE,
    exports.STATION_CAPABILITIES.NO_SHOW,
    exports.STATION_CAPABILITIES.CANCEL,
];
exports.DEFAULT_COMBINED_CAPABILITIES = [
    ...exports.DEFAULT_SERVICE_CAPABILITIES,
    exports.STATION_CAPABILITIES.MARK_READY,
];
function isReadyGatedCallingPolicy(policy) {
    return policy === 'ready_then_manual' || policy === 'ready_then_fifo';
}
/** Display name for the default multi-step workbench station profile. */
exports.COMBINED_JOURNEY_STATION_PROFILE_NAME = 'Combined desk';
/** Legacy name — keep for lookups when migrating existing orgs. */
exports.LEGACY_COMBINED_JOURNEY_STATION_PROFILE_NAME = 'Combined counter';
/** Capabilities every queue on the combined journey station profile should have. */
function capabilitiesForJourneyFlowStep(stepRole) {
    return stepRole === 'pickup' ? exports.DEFAULT_PICKUP_CAPABILITIES : exports.DEFAULT_COMBINED_CAPABILITIES;
}
function journeyProfileSupportsMarkReady(visibilityOnly, capabilities) {
    if (visibilityOnly)
        return false;
    if (!Array.isArray(capabilities))
        return false;
    return capabilities.includes(exports.STATION_CAPABILITIES.MARK_READY);
}
/** Journey transaction refs are required from step 1 onward. */
function journeyStepAcceptsExternalRef(stepIndex, stepRole) {
    if (stepRole === 'service' || stepRole === 'pickup')
        return true;
    if (stepIndex != null && stepIndex >= 1)
        return true;
    return false;
}
//# sourceMappingURL=workbench.js.map