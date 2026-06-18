import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from './loyalty-account.service';

@Injectable()
export class LoyaltyPointsExpiryService {
  private readonly logger = new Logger(LoyaltyPointsExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
  ) {}

  async expireForOrg(orgId: string): Promise<number> {
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return 0;

    const program = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyProgram.findUnique({
        where: { orgId },
        select: { pointsExpiryDays: true, enabled: true },
      }),
    );
    if (!program?.enabled || !program.pointsExpiryDays) return 0;

    const expired = await this.accounts.expireInactivePoints(orgId, program.pointsExpiryDays);
    if (expired > 0) {
      this.logger.log(`Expired points for ${expired} account(s) in org ${orgId}`);
    }
    return expired;
  }
}
