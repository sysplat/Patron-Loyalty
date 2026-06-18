import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TICKET_ERROR_CODES } from '@queueplatform/shared';
import { GlobalExceptionFilter } from './global-exception.filter';
import type { RequestContextService } from '../request-context/request-context.service';

vi.mock('../observability/sentry', () => ({
  captureServerException: vi.fn(),
}));

function mockHost() {
  const json = vi.fn();
  const set = vi.fn(() => ({ json }));
  const status = vi.fn(() => ({ set, json }));
  const response = {
    status,
    set,
    getHeader: vi.fn(() => undefined),
  };
  const request = { method: 'POST', url: '/api/v1/workbench/actions/complete', headers: {} };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
    json,
    status,
    set,
  };
}

describe('GlobalExceptionFilter', () => {
  const requestContext = {
    getContext: vi.fn().mockReturnValue({ requestId: 'req-1', orgId: 'org-1' }),
  } as unknown as RequestContextService;
  const filter = new GlobalExceptionFilter(requestContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializes structured ticket transition errors with code and details', () => {
    const host = mockHost();
    const exception = new BadRequestException({
      code: TICKET_ERROR_CODES.INVALID_TRANSITION,
      message: 'Ticket is in completed state, expected called or serving',
      details: {
        currentStatus: 'completed',
        allowedStatuses: ['called', 'serving'],
        targetStatus: 'completed',
      },
    });

    filter.catch(exception, host as never);

    expect(host.status).toHaveBeenCalledWith(400);
    expect(host.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: TICKET_ERROR_CODES.INVALID_TRANSITION,
          message: expect.stringContaining('completed'),
          details: {
            currentStatus: 'completed',
            allowedStatuses: ['called', 'serving'],
            targetStatus: 'completed',
          },
        }),
      }),
    );
  });
});
