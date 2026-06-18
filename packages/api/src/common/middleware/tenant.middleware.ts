import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface JwtUser {
  userId: string;
  orgId: string;
  email: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request & { user?: JwtUser }, _res: Response, next: NextFunction) {
    // Request-scoped tenant context is enforced via PrismaService.withTenant()
    // transaction wrappers at query call sites. Avoid setting session-level
    // context here because pooled connections can leak state across requests.
    void req.user?.orgId;

    next();
  }
}
