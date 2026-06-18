import { describe, expect, it } from 'vitest';
import { formatUserFacingApiError, getApiRequestId } from './api-errors';

describe('api-errors', () => {
  it('extracts requestId from error body', () => {
    expect(getApiRequestId({ requestId: 'abc-123-def' })).toBe('abc-123-def');
    expect(getApiRequestId({})).toBeUndefined();
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
