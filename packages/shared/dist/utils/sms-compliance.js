"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasLegacySmsComplianceSuffix = hasLegacySmsComplianceSuffix;
exports.stripLegacySmsComplianceSuffix = stripLegacySmsComplianceSuffix;
exports.decorateTransactionalSmsBody = decorateTransactionalSmsBody;
const TXN_SMS_COMPLIANCE_FOOTER = (_organizationName) => ` Reply STOP to cancel.`;
function hasLegacySmsComplianceSuffix(body) {
    const upper = body.toUpperCase();
    return (upper.includes('REPLY STOP') ||
        upper.includes('MSG&DATA RATES') ||
        upper.includes('QUEUEPLATFORM ALERTS') ||
        upper.includes('ALERTS VIA QUEUEPLATFORM') ||
        upper.includes('QLESSQ ALERTS') ||
        upper.includes('ALERTS VIA QLESSQ') ||
        // Legacy brand spelling — keep detecting templates stored before the rename.
        upper.includes('QLEESQ ALERTS') ||
        upper.includes('ALERTS VIA QLEESQ'));
}
function stripLegacySmsComplianceSuffix(body) {
    let result = body.trim();
    if (!result || !hasLegacySmsComplianceSuffix(result))
        return result;
    result = result.replace(/\s*alerts via (?:QueuePlatform|QlessQ|QleesQ)\.?\s*/gi, ' ');
    result = result.replace(/\s*(?:QueuePlatform|QlessQ|QleesQ) alerts\.?\s*/gi, ' ');
    result = result.replace(/\s*Msg&data rates may apply\.?\s*/gi, ' ');
    result = result.replace(/\s*Reply STOP to opt out(?:,\s*HELP for help)?\.?\s*$/gi, '');
    return result.trim();
}
function decorateTransactionalSmsBody(body, organizationName) {
    const normalizedBody = body.trim();
    if (!normalizedBody)
        return normalizedBody;
    if (hasLegacySmsComplianceSuffix(normalizedBody)) {
        return normalizedBody;
    }
    return `${normalizedBody}${TXN_SMS_COMPLIANCE_FOOTER(organizationName)}`;
}
//# sourceMappingURL=sms-compliance.js.map