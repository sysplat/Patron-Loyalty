export function captureException(_error: unknown, _context?: Record<string, unknown>): void {}

export function captureApiError(_error: unknown, _context?: Record<string, unknown>): void {}

export function setSentryUser(_user: { id?: string; email?: string } | null): void {}

export function syncSentryAuthContext(_user: { id?: string; email?: string } | null): void {}

export function addSentryBreadcrumb(_breadcrumb: Record<string, unknown>): void {}
