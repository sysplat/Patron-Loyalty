/** URL hash key for cross-origin platform-operator impersonation launch. */
export declare const IMPERSONATION_HANDOFF_HASH_KEY = "qp-imp";
/** Login path used for admin → loyalty app handoff. */
export declare const IMPERSONATION_HANDOFF_PATH = "/login";
export declare const IMPERSONATION_ENDED_MESSAGE: "qp-impersonation-ended";
export type ImpersonationEndedMessage = {
    type: typeof IMPERSONATION_ENDED_MESSAGE;
};
export type ImpersonationHandoffPayload = {
    accessToken: string;
    orgId: string;
    orgName: string;
    /** Platform operator org slug (e.g. queueplatform-internal) — not the impersonated tenant slug. */
    operatorOrgSlug: string;
    role: string;
    roleSimulation?: boolean;
    simulatedBranchId?: string;
    simulatedBranchName?: string;
    /** Optional admin return URL after ending impersonation. */
    returnUrl?: string;
    operator: {
        id: string;
        email: string;
        firstName?: string | null;
        lastName?: string | null;
    };
};
export type ImpersonationAuthSession = {
    accessToken: string;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        orgId: string;
        orgName: string;
        orgSlug: string;
        role: string;
        twoFactorEnabled: true;
        impersonation: true;
        roleSimulation?: boolean;
        simulatedBranchId?: string;
        simulatedBranchName?: string;
        platformOperator: true;
    };
};
export declare function encodeImpersonationHandoff(payload: ImpersonationHandoffPayload): string;
export declare function decodeImpersonationHandoff(encoded: string): ImpersonationHandoffPayload | null;
export declare function impersonationHandoffToSession(payload: ImpersonationHandoffPayload): ImpersonationAuthSession;
/** Build tenant app URL with hash handoff (admin → web/loyalty on another origin). */
export declare function buildImpersonationLaunchUrl(appBaseUrl: string, path: string, payload: ImpersonationHandoffPayload): string;
export declare function parseImpersonationHandoffFromHash(hash: string): ImpersonationHandoffPayload | null;
//# sourceMappingURL=impersonation-handoff.d.ts.map