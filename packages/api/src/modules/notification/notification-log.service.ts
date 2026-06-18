import { Injectable } from '@nestjs/common';
import { buildPaginationArgs, buildPaginationMeta } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async listLogs(
    orgId: string,
    filters: { channel?: string; status?: string; page?: number; limit?: number },
  ) {
    const { skip, take, page, limit } = buildPaginationArgs({
      page: filters.page,
      limit: filters.limit,
    });
    const where: { notification: { orgId: string }; event?: string } = {
      notification: { orgId },
    };
    if (filters.status) where.event = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { notification: true },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta({ page, limit, total }) };
  }
}
