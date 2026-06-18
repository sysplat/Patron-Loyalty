import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, PrismaClient } from '@prisma/client';
import { LOYALTY_EVENTS } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { LoyaltyReviewSubmittedEvent } from '../loyalty/loyalty.events';

/**
 * Manages customer satisfaction reviews submitted after service.
 * Handles review submission, listing, and moderation.
 */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  async list(
    orgId: string,
    filters: {
      branchId?: string;
      rating?: number;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
      allowedBranchIds?: string[] | null;
    },
  ) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const where: Prisma.ReviewWhereInput = { orgId };
    if (filters.branchId) {
      where.branchId = filters.branchId;
    } else if (Array.isArray(filters.allowedBranchIds) && filters.allowedBranchIds.length === 0) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    } else if (filters.allowedBranchIds && filters.allowedBranchIds.length > 0) {
      where.branchId = { in: filters.allowedBranchIds };
    }
    if (filters.rating) where.rating = filters.rating;
    if (filters.status) where.status = filters.status;

    const search = filters.search?.trim();
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerEmail: { contains: search, mode: 'insensitive' } },
            { comment: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.withOrg(orgId, async (tx) => {
      const [data, total] = await Promise.all([
        tx.review.findMany({
          where,
          include: {
            branch: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.review.count({ where }),
      ]);

      return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });
  }

  async listForPrincipal(
    orgId: string,
    userId: string,
    filters: {
      branchId?: string;
      rating?: number;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (filters.branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(filters.branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
      return this.list(orgId, { ...filters, allowedBranchIds: undefined });
    }
    return this.list(orgId, { ...filters, allowedBranchIds: allowed });
  }

  async create(
    orgId: string,
    data: {
      branchId?: string;
      customerName: string;
      customerEmail?: string;
      rating: number;
      comment?: string;
    },
  ) {
    return this.withOrg(orgId, (tx) =>
      tx.review.create({
        data: {
          orgId,
          branchId: data.branchId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          rating: data.rating,
          comment: data.comment,
          status: 'pending',
        },
      }),
    );
  }

  async moderate(orgId: string, reviewId: string, action: 'approve' | 'reject') {
    const updated = await this.withOrg(orgId, async (tx) => {
      const review = await tx.review.findFirst({ where: { id: reviewId, orgId } });
      if (!review) throw new NotFoundException('Review not found');
      return tx.review.update({
        where: { id: reviewId },
        data: { status: action === 'approve' ? 'approved' : 'rejected' },
      });
    });

    if (action === 'approve') {
      const customer = updated.customerEmail
        ? await this.withOrg(orgId, (tx) =>
            tx.customer.findFirst({
              where: { orgId, email: updated.customerEmail! },
              select: { id: true },
            }),
          )
        : null;
      this.eventEmitter.emit(
        LOYALTY_EVENTS.REVIEW_SUBMITTED,
        new LoyaltyReviewSubmittedEvent(orgId, reviewId, customer?.id ?? null, updated.rating),
      );
    }

    return updated;
  }

  async delete(orgId: string, reviewId: string) {
    return this.withOrg(orgId, async (tx) => {
      const review = await tx.review.findFirst({ where: { id: reviewId, orgId } });
      if (!review) throw new NotFoundException('Review not found');
      await tx.review.delete({ where: { id: reviewId } });
    });
  }

  async getStats(orgId: string, branchId?: string, allowedBranchIds?: string[] | null) {
    const where: Prisma.ReviewWhereInput = { orgId, status: { not: 'rejected' } };
    if (branchId) {
      where.branchId = branchId;
    } else if (Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
      };
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }

    return this.withOrg(orgId, async (tx) => {
      const stats = await tx.review.aggregate({
        where,
        _avg: { rating: true },
        _count: true,
      });

      const distributionRows = await tx.review.groupBy({
        by: ['rating'],
        where,
        _count: true,
      });

      const distributionMap = Object.fromEntries(distributionRows.map((d) => [d.rating, d._count]));

      return {
        averageRating: Math.round((stats._avg.rating ?? 0) * 10) / 10,
        totalReviews: stats._count,
        distribution: [5, 4, 3, 2, 1].map((rating) => ({
          rating,
          count: distributionMap[rating] ?? 0,
        })),
      };
    });
  }

  async getStatsForPrincipal(orgId: string, userId: string, branchId?: string) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
      return this.getStats(orgId, branchId, undefined);
    }
    return this.getStats(orgId, undefined, allowed);
  }
}
