import { describe, expect, it } from 'vitest';
import {
  formatUserFacingApiError,
  getApiRequestId,
  newClientRequestId,
  resolveApiRequestId,
} from './api-errors';

describe('api-errors', () => {
  it('extracts requestId from error body', () => {
    expect(getApiRequestId({ requestId: 'abc-123-def' })).toBe('abc-123-def');
    expect(getApiRequestId({})).toBeUndefined();
  });

  it('creates client request ids', () => {
    const id = newClientRequestId();
    expect(id.length).toBeGreaterThan(8);
  });

  it('resolves requestId preferring body then header then client', () => {
    expect(
      resolveApiRequestId({
        body: { requestId: 'from-body' },
        responseHeaders: { 'x-request-id': 'from-header' },
        clientRequestId: 'from-client',
      }),
    ).toBe('from-body');
    expect(
      resolveApiRequestId({
        body: {},
        responseHeaders: { 'x-request-id': 'from-header' },
        clientRequestId: 'from-client',
      }),
    ).toBe('from-header');
    expect(resolveApiRequestId({ clientRequestId: 'from-client' })).toBe('from-client');
  });

  it('formats 5xx with reference', () => {
    const msg = formatUserFacingApiError({
      status: 500,
      message: 'Database error',
      requestId: 'req-abcdef12-3456',
    });
    expect(msg).toContain('Database error');
    expect(msg).toContain('Reference: req-abcd');
  });

  it('formats 404 with hint only for generic not found', () => {
    const generic = formatUserFacingApiError({
      status: 404,
      message: '',
      code: 'NOT_FOUND',
    });
    expect(generic).toContain('That resource was not found.');
    expect(generic).toContain('app and API versions');

    const specific = formatUserFacingApiError({
      status: 404,
      message: 'Queue not found',
      code: 'NOT_FOUND',
    });
    expect(specific).toBe('Queue not found');
  });
});
