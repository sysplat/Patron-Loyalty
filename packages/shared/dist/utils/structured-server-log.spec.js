"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const structured_server_log_1 = require("./structured-server-log");
(0, vitest_1.describe)('shouldUseStructuredServerLogs', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevFormat = process.env.LOG_FORMAT;
    (0, vitest_1.afterEach)(() => {
        if (prevNodeEnv === undefined)
            delete process.env.NODE_ENV;
        else
            process.env.NODE_ENV = prevNodeEnv;
        if (prevFormat === undefined)
            delete process.env.LOG_FORMAT;
        else
            process.env.LOG_FORMAT = prevFormat;
    });
    (0, vitest_1.it)('defaults on in production', () => {
        (0, vitest_1.expect)((0, structured_server_log_1.shouldUseStructuredServerLogs)({ NODE_ENV: 'production' })).toBe(true);
    });
    (0, vitest_1.it)('respects LOG_FORMAT=pretty', () => {
        (0, vitest_1.expect)((0, structured_server_log_1.shouldUseStructuredServerLogs)({ NODE_ENV: 'production', LOG_FORMAT: 'pretty' })).toBe(false);
    });
});
(0, vitest_1.describe)('installStructuredServerLogs', () => {
    (0, vitest_1.it)('emits JSON for Error and string messages', () => {
        process.env.LOG_FORMAT = 'json';
        process.env.NODE_ENV = 'test'; // shouldUse is false in test…
        // Force install path by temporarily faking production via direct call after patching check:
        // Call with LOG_FORMAT=json and NODE_ENV not test — flip NODE_ENV for this test only.
        process.env.NODE_ENV = 'production';
        const writes = [];
        const originalWrite = process.stdout.write.bind(process.stdout);
        const originalLog = console.log;
        const originalError = console.error;
        process.stdout.write = ((chunk) => {
            writes.push(String(chunk));
            return true;
        });
        try {
            (0, structured_server_log_1.resetStructuredServerLogsForTests)();
            (0, structured_server_log_1.installStructuredServerLogs)('web');
            console.log('hello');
            console.error(new Error('boom'));
        }
        finally {
            process.stdout.write = originalWrite;
            console.log = originalLog;
            console.error = originalError;
            (0, structured_server_log_1.resetStructuredServerLogsForTests)();
            process.env.NODE_ENV = 'test';
            delete process.env.LOG_FORMAT;
        }
        (0, vitest_1.expect)(writes.length).toBeGreaterThanOrEqual(2);
        const info = JSON.parse(writes[0].trim());
        (0, vitest_1.expect)(info.service).toBe('web');
        (0, vitest_1.expect)(info.level).toBe('info');
        (0, vitest_1.expect)(info.message).toBe('hello');
        const err = JSON.parse(writes[1].trim());
        (0, vitest_1.expect)(err.level).toBe('error');
        (0, vitest_1.expect)(err.message).toBe('boom');
    });
});
//# sourceMappingURL=structured-server-log.spec.js.map