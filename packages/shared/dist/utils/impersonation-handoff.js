"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMPERSONATION_HANDOFF_HASH_KEY = void 0;
exports.encodeImpersonationHandoff = encodeImpersonationHandoff;
exports.decodeImpersonationHandoff = decodeImpersonationHandoff;
exports.impersonationHandoffToSession = impersonationHandoffToSession;
exports.buildImpersonationLaunchUrl = buildImpersonationLaunchUrl;
exports.parseImpersonationHandoffFromHash = parseImpersonationHandoffFromHash;
/** URL hash key for cross-origin platform-operator impersonation launch. */
exports.IMPERSONATION_HANDOFF_HASH_KEY = 'qp-imp';
function toBase64Url(value) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(value, 'utf8').toString('base64url');
    }
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(padded, 'base64').toString('utf8');
    }
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
function encodeImpersonationHandoff(payload) {
    return toBase64Url(JSON.stringify(payload));
}
function decodeImpersonationHandoff(encoded) {
    try {
        const parsed = JSON.parse(fromBase64Url(encoded));
        if (typeof parsed?.accessToken !== 'string' ||
            typeof parsed?.orgId !== 'string' ||
            typeof parsed?.orgName !== 'string' ||
            typeof parsed?.operatorOrgSlug !== 'string' ||
            typeof parsed?.role !== 'string' ||
            typeof parsed?.operator?.id !== 'string' ||
            typeof parsed?.operator?.email !== 'string') {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
function impersonationHandoffToSession(payload) {
    return {
        accessToken: payload.accessToken,
        user: {
            id: payload.operator.id,
            email: payload.operator.email,
            firstName: payload.operator.firstName?.trim() || 'Platform',
            lastName: payload.operator.lastName?.trim() || 'Operator',
            orgId: payload.orgId,
            orgName: payload.orgName,
            orgSlug: payload.operatorOrgSlug,
            role: payload.role,
            twoFactorEnabled: true,
            impersonation: true,
            roleSimulation: payload.roleSimulation,
            simulatedBranchId: payload.simulatedBranchId,
            simulatedBranchName: payload.simulatedBranchName,
            platformOperator: true,
        },
    };
}
/** Build tenant app URL with hash handoff (admin → web/loyalty on another origin). */
function buildImpersonationLaunchUrl(appBaseUrl, path, payload) {
    const base = appBaseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const encoded = encodeImpersonationHandoff(payload);
    return `${base}${normalizedPath}#${exports.IMPERSONATION_HANDOFF_HASH_KEY}=${encoded}`;
}
function parseImpersonationHandoffFromHash(hash) {
    const prefix = `#${exports.IMPERSONATION_HANDOFF_HASH_KEY}=`;
    if (!hash.startsWith(prefix))
        return null;
    return decodeImpersonationHandoff(hash.slice(prefix.length));
}
//# sourceMappingURL=impersonation-handoff.js.map