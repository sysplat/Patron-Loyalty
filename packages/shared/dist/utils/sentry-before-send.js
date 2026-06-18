"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySentryPiiScrub = applySentryPiiScrub;
const sentry_pii_1 = require("./sentry-pii");
/** Redact credentials and PII before events leave the process. */
function applySentryPiiScrub(event) {
    if (event.request?.headers) {
        const headers = { ...event.request.headers };
        for (const key of Object.keys(headers)) {
            if (/authorization|cookie|x-api-key/i.test(key)) {
                headers[key] = '[Redacted]';
            }
        }
        event.request.headers = headers;
    }
    if (event.user?.email) {
        const rest = { ...event.user };
        delete rest.email;
        event.user = rest;
    }
    if (event.extra) {
        event.extra = (0, sentry_pii_1.scrubSensitiveRecord)(event.extra);
    }
    if (event.contexts) {
        event.contexts = (0, sentry_pii_1.scrubSensitiveRecord)(event.contexts);
    }
    return event;
}
//# sourceMappingURL=sentry-before-send.js.map