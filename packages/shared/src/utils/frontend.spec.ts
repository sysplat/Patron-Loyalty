import { describe, it, expect } from 'vitest';
import {
  extractErrorMessage,
  getApiErrorCode,
  getApiErrorDetails,
  getApiBase,
  normalizeApiV1Base,
} from './frontend';
import { TICKET_ERROR_CODES } from '../constants/ticket-errors';

describe('normalizeApiV1Base', () => {
  it('appends /api/v1 when host URL omits version prefix', () => {
    expect(normalizeApiV1Base('https://qms-api-production.up.railway.app')).toBe(
      'https://qms-api-production.up.railway.app/api/v1',
    );
  });

  it('leaves URLs that already include /api/v1 unchanged', () => {
    expect(normalizeApiV1Base('http://localhost:4000/api/v1')).toBe('http://localhost:4000/api/v1');
  });

  it('normalizes relative dev proxy bases', () => {
    expect(normalizeApiV1Base('/api/v1')).toBe('/api/v1');
  });
});

describe('getApiBase', () => {
  it('normalizes NEXT_PUBLIC_API_URL at read time', () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    try {
      expect(getApiBase()).toBe('https://api.example.com/api/v1');
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_API_URL;
      else process.env.NEXT_PUBLIC_API_URL = prev;
    }
  });
});

describe('getApiErrorCode', () => {
  it('reads code from GlobalExceptionFilter error envelope', () => {
    const data = {
      success: false,
      error: {
        code: TICKET_ERROR_CODES.INVALID_TRANSITION,
        message: 'Ticket is in completed state, expected called or serving',
      },
    };
    expect(getApiErrorCode(data)).toBe(TICKET_ERROR_CODES.INVALID_TRANSITION);
  });

  it('returns undefined for plain string errors', () => {
    expect(getApiErrorCode({ message: 'oops' })).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(getApiErrorCode(null)).toBeUndefined();
  });
});

describe('getApiErrorDetails', () => {
  it('reads details from error envelope', () => {
    const data = {
      success: false,
      error: {
        code: TICKET_ERROR_CODES.INVALID_TRANSITION,
        message: 'transition failed',
        details: {
          currentStatus: 'completed',
          allowedStatuses: ['called', 'serving'],
          targetStatus: 'completed',
        },
      },
    };
    expect(getApiErrorDetails(data)).toEqual({
      currentStatus: 'completed',
      allowedStatuses: ['called', 'serving'],
      targetStatus: 'completed',
    });
  });

  it('returns undefined when details missing', () => {
    expect(getApiErrorDetails({ error: { code: 'X', message: 'y' } })).toBeUndefined();
  });
});

describe('extractErrorMessage', () => {
  it('prefers nested error.message from filter envelope', () => {
    const data = {
      success: false,
      error: {
        code: TICKET_ERROR_CODES.INVALID_TRANSITION,
        message: 'Structured ticket message',
      },
    };
    expect(extractErrorMessage(data, 'Bad Request')).toBe('Structured ticket message');
  });
});
