type SentryEventLike = {
    request?: {
        headers?: Record<string, string | string[] | undefined>;
    };
    extra?: Record<string, unknown>;
    contexts?: Record<string, unknown>;
    user?: {
        email?: string;
        [key: string]: unknown;
    };
};
/** Redact credentials and PII before events leave the process. */
export declare function applySentryPiiScrub<T extends SentryEventLike>(event: T): T;
export {};
//# sourceMappingURL=sentry-before-send.d.ts.map