import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { RequestContextService } from '../request-context/request-context.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const requestId = request.headers['x-request-id'] || request.headers['X-Request-ID'];
    const userAgent = request.get('user-agent') || '';
    const now = Date.now();

    const emitLog = (statusCode: number) => {
      const duration = Date.now() - now;
      const ctx = this.requestContext.getContext();

      this.logger.log(
        JSON.stringify({
          requestId,
          orgId: ctx?.orgId,
          ticketId: ctx?.ticketId,
          queueId: ctx?.queueId,
          method,
          url,
          statusCode,
          durationMs: duration,
          ip,
          userAgent,
        }),
      );
    };

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        emitLog(response.statusCode);
      }),
      catchError((err) => {
        const statusCode =
          err instanceof HttpException ? err.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        emitLog(statusCode);
        return throwError(() => err);
      }),
    );
  }
}
