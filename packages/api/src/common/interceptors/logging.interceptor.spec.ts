import { CallHandler, ExecutionContext, Logger, NotFoundException } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoggingInterceptor } from './logging.interceptor';
import type { RequestContextService } from '../request-context/request-context.service';

type RequestContext = ReturnType<RequestContextService['getContext']>;

function makeContext(
  ctxValue: RequestContext,
  { statusCode = 200 }: { statusCode?: number } = {},
): ExecutionContext {
  const request = {
    method: 'POST',
    url: '/api/v1/tickets',
    ip: '203.0.113.7',
    headers: { 'x-request-id': 'req-123' },
    get: (name: string) => (name.toLowerCase() === 'user-agent' ? 'vitest-agent' : undefined),
  };
  const response = { statusCode };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function makeInterceptor(ctxValue: RequestContext) {
  const requestContext = { getContext: () => ctxValue } as unknown as RequestContextService;
  return new LoggingInterceptor(requestContext);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LoggingInterceptor', () => {
  it('emits a single structured JSON log line with request correlation fields on success', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const ctxValue = { orgId: 'org-1', ticketId: 'tic-1', queueId: 'q-1' } as RequestContext;
    const interceptor = makeInterceptor(ctxValue);

    const next: CallHandler = { handle: () => of({ ok: true }) };
    await lastValueFrom(interceptor.intercept(makeContext(ctxValue, { statusCode: 201 }), next));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      requestId: 'req-123',
      orgId: 'org-1',
      ticketId: 'tic-1',
      queueId: 'q-1',
      method: 'POST',
      url: '/api/v1/tickets',
      statusCode: 201,
      ip: '203.0.113.7',
      userAgent: 'vitest-agent',
    });
    expect(typeof payload.durationMs).toBe('number');
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('logs the mapped HttpException status and rethrows the error on failure', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const ctxValue = { orgId: 'org-2' } as RequestContext;
    const interceptor = makeInterceptor(ctxValue);

    const next: CallHandler = { handle: () => throwError(() => new NotFoundException('nope')) };

    await expect(
      lastValueFrom(interceptor.intercept(makeContext(ctxValue), next)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload.statusCode).toBe(404);
    expect(payload.orgId).toBe('org-2');
  });

  it('defaults to 500 for non-HTTP errors', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const ctxValue = {} as RequestContext;
    const interceptor = makeInterceptor(ctxValue);

    const next: CallHandler = { handle: () => throwError(() => new Error('kaboom')) };

    await expect(lastValueFrom(interceptor.intercept(makeContext(ctxValue), next))).rejects.toThrow(
      'kaboom',
    );

    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload.statusCode).toBe(500);
  });
});
