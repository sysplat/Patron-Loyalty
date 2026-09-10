/**
 * Structured one-line JSON logs for Node server runtimes (API-style fields for Better Stack).
 * Safe to call multiple times; no-ops in test / pretty / browser.
 */
/** Test-only: allow re-install after restoring console. */
export declare function resetStructuredServerLogsForTests(): void;
export declare function shouldUseStructuredServerLogs(env?: NodeJS.ProcessEnv): boolean;
/**
 * Replace console.log/info/warn/error/debug with JSON lines tagged by `service`.
 */
export declare function installStructuredServerLogs(service: string): void;
//# sourceMappingURL=structured-server-log.d.ts.map