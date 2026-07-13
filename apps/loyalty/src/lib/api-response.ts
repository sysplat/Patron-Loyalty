import { api } from '@/lib/api';
import { getApiBase } from '@queueplatform/shared';

/** Unwrap `{ success: true, data }` envelopes; pass through raw API payloads. */
export function unwrapApiData<T>(payload: unknown): T {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'success' in payload &&
    (payload as { success: boolean }).success === true &&
    'data' in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

/**
 * Loyalty module endpoints return raw JSON; org/customer endpoints use `{ success, data }`.
 * Always unwrap so React Query receives the payload regardless of shape.
 */
export function loyaltyGet<T>(path: string, token: string): Promise<T> {
  return api.get(path, { token }).then((payload) => unwrapApiData<T>(payload));
}

export function loyaltyPost<T>(path: string, token: string, body?: unknown): Promise<T> {
  return api.post(path, body, { token }).then((payload) => unwrapApiData<T>(payload));
}

export function loyaltyPatch<T>(path: string, token: string, body?: unknown): Promise<T> {
  return api.patch(path, body, { token }).then((payload) => unwrapApiData<T>(payload));
}

export function loyaltyDelete(path: string, token: string): Promise<void> {
  return api.delete(path, { token }) as Promise<void>;
}

/** Customer list endpoints: `{ success, data, meta }` or paginated raw shape. */
export type PaginatedResponse<T> = {
  data: T[];
  meta: { total: number; totalPages: number; page?: number; limit?: number };
};

export function fetchPaginated<T>(path: string, token: string): Promise<PaginatedResponse<T>> {
  return api.get(path, { token }).then((payload) => {
    const unwrapped = unwrapApiData<PaginatedResponse<T> | T[]>(payload);
    if (Array.isArray(unwrapped)) {
      return {
        data: unwrapped,
        meta: { total: unwrapped.length, totalPages: 1 },
      };
    }
    return unwrapped;
  });
}

/** Download a CSV export from a loyalty report endpoint. */
export async function loyaltyDownloadCsv(path: string, token: string, filename: string) {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
