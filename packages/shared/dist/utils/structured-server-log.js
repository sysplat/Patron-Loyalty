"use strict";
/**
 * Structured one-line JSON logs for Node server runtimes (API-style fields for Better Stack).
 * Safe to call multiple times; no-ops in test / pretty / browser.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetStructuredServerLogsForTests = resetStructuredServerLogsForTests;
exports.shouldUseStructuredServerLogs = shouldUseStructuredServerLogs;
exports.installStructuredServerLogs = installStructuredServerLogs;
let installedFor = null;
/** Test-only: allow re-install after restoring console. */
function resetStructuredServerLogsForTests() {
    installedFor = null;
}
function shouldUseStructuredServerLogs(env = process.env) {
    if (env.NODE_ENV === 'test')
        return false;
    const format = (env.LOG_FORMAT || '').trim().toLowerCase();
    if (format === 'json')
        return true;
    if (format === 'pretty')
        return false;
    return env.NODE_ENV === 'production';
}
function serializeArg(arg) {
    if (arg instanceof Error) {
        return { message: arg.message, name: arg.name, stack: arg.stack };
    }
    if (typeof arg === 'string') {
        const trimmed = arg.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                return JSON.parse(trimmed);
            }
            catch {
                return arg;
            }
        }
        return arg;
    }
    return arg;
}
function writeLine(service, level, args) {
    const base = { level, service };
    if (args.length === 1) {
        const only = serializeArg(args[0]);
        if (only && typeof only === 'object' && !Array.isArray(only) && !(only instanceof Error)) {
            const obj = only;
            process.stdout.write(`${JSON.stringify({
                ...base,
                ...obj,
                message: typeof obj.message === 'string' ? obj.message : undefined,
            })}\n`);
            return;
        }
        if (typeof only === 'object' && only !== null && 'message' in only) {
            const err = only;
            process.stdout.write(`${JSON.stringify({
                ...base,
                message: err.message,
                errorName: err.name,
                stack: err.stack,
            })}\n`);
            return;
        }
        process.stdout.write(`${JSON.stringify({ ...base, message: only })}\n`);
        return;
    }
    process.stdout.write(`${JSON.stringify({
        ...base,
        message: args.map((a) => (typeof a === 'string' ? a : serializeArg(a))),
    })}\n`);
}
/**
 * Replace console.log/info/warn/error/debug with JSON lines tagged by `service`.
 */
function installStructuredServerLogs(service) {
    if (typeof process === 'undefined' || typeof console === 'undefined')
        return;
    if (!shouldUseStructuredServerLogs())
        return;
    if (installedFor === service)
        return;
    installedFor = service;
    const wrap = (level) => (...args) => {
        writeLine(service, level, args);
    };
    console.log = wrap('info');
    console.info = wrap('info');
    console.warn = wrap('warn');
    console.error = wrap('error');
    console.debug = wrap('debug');
}
//# sourceMappingURL=structured-server-log.js.map