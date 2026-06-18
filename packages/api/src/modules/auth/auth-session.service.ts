import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isPlatformOperator } from '../../common/platform-operator.util';

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async logout(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  /**
   * Tenant web: platform operator flag for the current JWT (internal org + optional env allowlist).
   */
  async getSessionProfile(userId: string) {
    const row = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          organization: { select: { slug: true } },
        },
      }),
    );
    if (!row) {
      throw new UnauthorizedException('User not found');
    }
    const slug = row.organization?.slug ?? '';
    return {
      platformOperator: isPlatformOperator(row.id, row.email ?? '', slug),
    };
  }
}
