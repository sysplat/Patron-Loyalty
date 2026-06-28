import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  isLoyaltyOnlyApiDeploy,
  isQueueProductApiPath,
  resolveApiDeployProfile,
} from '@queueplatform/shared';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { QueueProductFeatureService } from '../features/queue-product-feature.service';

@Injectable()
export class QueueProductGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly queueProduct: QueueProductFeatureService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isLoyaltyOnlyApiDeploy(resolveApiDeployProfile())) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ path?: string; url?: string; user?: AuthenticatedUser }>();
    const path = request.path ?? request.url ?? '';
    if (!isQueueProductApiPath(path)) {
      return true;
    }

    if (path.includes('/platform-admin')) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const orgId = request.user?.orgId;
    if (!orgId) {
      return true;
    }

    await this.queueProduct.requireEnabled(orgId);
    return true;
  }
}
