import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from '../request-context/request-context.service';
import { syncSentryRequestContext } from '../observability/sentry';

type AuthenticatedRequest = {
  user?: { userId?: string; id?: string; orgId?: string; email?: string };
};

@Injectable()
export class SentryContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const ctx = this.requestContext.getContext();
    const userId = request.user?.userId ?? request.user?.id;

    syncSentryRequestContext({
      ...ctx,
      requestId: ctx?.requestId ?? '',
      userId,
      email: request.user?.email,
      orgId: ctx?.orgId ?? request.user?.orgId,
    });

    return next.handle();
  }
}
