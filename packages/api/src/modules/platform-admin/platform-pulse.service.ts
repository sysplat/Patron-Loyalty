import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlatformPulseService {
  constructor(private readonly prisma: PrismaService) {}

  private utcDayStart(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  async getPulse() {
    const dayStart = this.utcDayStart();
    const now = new Date();

    const [ticketsToday, waitingNow, servingDistinct] = await this.prisma.withBypassRls(
      async (tx) => {
        return Promise.all([
          tx.ticket.count({
            where: { bookedAt: { gte: dayStart } },
          }),
          tx.ticket.count({
            where: { status: 'waiting' },
          }),
          tx.ticket.findMany({
            where: {
              status: 'serving',
              servedByUserId: { not: null },
            },
            distinct: ['servedByUserId'],
            select: { servedByUserId: true },
          }),
        ]);
      },
    );

    const orgCount = await this.prisma.organization.count();

    return {
      generatedAt: now.toISOString(),
      utcDayStart: dayStart.toISOString(),
      ticketsCreatedToday: ticketsToday,
      waitingCustomersPlatformWide: waitingNow,
      activeServingAgents: servingDistinct.length,
      organizationCount: orgCount,
    };
  }
}
