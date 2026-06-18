import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { sha256 } from './auth-token.util';

@Injectable()
export class AuthVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyEmail(token: string) {
    const tokenHash = sha256(token);
    const matched = await this.prisma.withBypassRls(async (tx) => {
      return tx.emailVerification.findFirst({
        where: { tokenHash, verifiedAt: null, expiresAt: { gt: new Date() } },
        include: { user: { include: { organization: true, account: true } } },
      });
    });

    if (!matched) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.withBypassRls(
      async (tx) => {
        await tx.emailVerification.update({
          where: { id: matched.id },
          data: { verifiedAt: new Date() },
        });
        await tx.user.update({
          where: { id: matched.userId },
          data: { emailVerified: true, status: 'active' },
        });
        if (matched.user.accountId) {
          await tx.account.update({
            where: { id: matched.user.accountId },
            data: { emailVerified: true },
          });
        }
        await tx.organization.update({
          where: { id: matched.user.orgId },
          data: { onboardingStep: 'service_selection' },
        });
      },
      { orgId: matched.user.orgId },
    );

    return { message: 'Email verified successfully' };
  }
}
