import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { RequestContextService } from '../request-context/request-context.service';
import { captureServerException } from '../observability/sentry';

// Minimal type guard for Prisma errors — avoids importing the full PrismaClient
function isPrismaError(
  err: unknown,
): err is { code: string; meta?: Record<string, unknown>; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string' &&
    String((err as Record<string, unknown>).code).startsWith('P')
  );
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly requestContext: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      (request.headers['x-request-id'] as string) ??
      response.getHeader('X-Request-ID')?.toString() ??
      '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        code = (resp.code as string) || (resp.error as string) || code;
        if (resp.details && typeof resp.details === 'object' && !Array.isArray(resp.details)) {
          details = resp.details as Record<string, unknown>;
        }
        if (Array.isArray(resp.message)) {
          details = { validationErrors: resp.message };
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
        } else if (Array.isArray(resp.errors)) {
          details = {
            validationErrors: resp.errors.map((e: any) => {
              if (typeof e === 'string') return e;
              const path = Array.isArray(e.path) ? e.path.join('.') : e.path;
              return path ? `${path}: ${e.message || 'Invalid'}` : e.message || JSON.stringify(e);
            }),
          };
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
        }
      }
    } else if (isPrismaError(exception)) {
      // Map Prisma known request errors to appropriate HTTP codes
      switch (exception.code) {
        case 'P2002': // Unique constraint failed
          status = HttpStatus.CONFLICT;
          code = 'CONFLICT';
          message = 'A record with these details already exists';
          if (exception.meta?.target) details = { fields: exception.meta.target };
          break;
        case 'P2025': // Record not found (update/delete on missing)
          status = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'Record not found';
          break;
        case 'P2003': // Foreign key constraint failed
          status = HttpStatus.BAD_REQUEST;
          code = 'BAD_REQUEST';
          message = 'Invalid reference — the related record does not exist';
          if (exception.meta?.field_name) details = { field: exception.meta.field_name };
          break;
        case 'P2014': // Relation violation
          status = HttpStatus.BAD_REQUEST;
          code = 'BAD_REQUEST';
          message = 'Relation constraint violation';
          break;
        case 'P2022': // Column missing / schema drift (common when migrations were not applied)
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          code = 'DATABASE_SCHEMA_MISMATCH';
          message =
            'The database is missing columns expected by this version of the app. Apply pending migrations (for example: prisma migrate deploy), then retry.';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          code = 'DATABASE_ERROR';
          message = `A database error occurred (${exception.code}: ${exception.message})`;
          this.logger.error(
            JSON.stringify({
              requestId,
              type: 'prisma',
              code: exception.code,
              message: exception.message,
              method: request.method,
              url: request.url,
            }),
          );
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        JSON.stringify({
          requestId,
          type: 'unhandled',
          message: exception.message,
          stack: exception.stack,
          method: request.method,
          url: request.url,
        }),
      );
    }

    const reqUser = (
      request as Request & { user?: { userId?: string; id?: string; email?: string } }
    ).user;
    const contextStore = this.requestContext.getContext();

    captureServerException(exception, {
      status,
      code,
      requestId,
      method: request.method,
      url: request.url,
      details,
      context: {
        ...contextStore,
        requestId: contextStore?.requestId ?? requestId,
        userId: contextStore?.userId ?? reqUser?.userId ?? reqUser?.id,
        email: reqUser?.email,
      },
    });

    // Convert HTTP status to error code
    if (status === HttpStatus.UNAUTHORIZED) code = 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) code = 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) code = 'NOT_FOUND';
    if (status === HttpStatus.CONFLICT) code = 'CONFLICT';
    if (status === HttpStatus.BAD_REQUEST && code === 'INTERNAL_ERROR') code = 'BAD_REQUEST';
    if (status === HttpStatus.UNPROCESSABLE_ENTITY) code = 'UNPROCESSABLE_ENTITY';
    if (status === HttpStatus.SERVICE_UNAVAILABLE) code = 'SERVICE_UNAVAILABLE';
    if (status === HttpStatus.TOO_MANY_REQUESTS) code = 'RATE_LIMITED';

    const body: Record<string, unknown> = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    };
    if (requestId) body.requestId = requestId;

    response
      .status(status)
      .set('X-Request-ID', requestId || 'none')
      .json(body);
  }
}
