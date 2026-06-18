import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { LOYALTY_ORG_ID_REQUEST_KEY } from '../guards/loyalty-api-key.guard';

export const LoyaltyOrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request[LOYALTY_ORG_ID_REQUEST_KEY] as string;
  },
);
