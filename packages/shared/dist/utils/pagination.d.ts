/**
 * Shared pagination utilities for Prisma-based list queries.
 *
 * These helpers enforce a consistent `page`/`limit`/`total`/`totalPages`
 * response shape across every paginated endpoint in the API.
 * Use `buildPaginationArgs` to derive `skip` and `take` before the DB call,
 * then pass the results through `buildPaginationMeta` to build the envelope.
 *
 * @example
 * const { skip, take, page, limit } = buildPaginationArgs({ page: 2, limit: 20 });
 * const [data, total] = await Promise.all([
 *   prisma.ticket.findMany({ where, skip, take }),
 *   prisma.ticket.count({ where }),
 * ]);
 * return { data, meta: buildPaginationMeta({ page, limit, total }) };
 */
export interface PaginationInput {
    /** 1-based page number. Defaults to 1. */
    page?: number;
    /** Rows per page. Clamped to [1, MAX_PAGE_SIZE]. Defaults to 20. */
    limit?: number;
}
export interface PaginationArgs {
    /** Resolved 1-based page number. */
    page: number;
    /** Resolved rows per page. */
    limit: number;
    /** Prisma `skip` value — rows to skip before this page. */
    skip: number;
    /** Prisma `take` value — rows to return on this page. */
    take: number;
}
/**
 * The consistent pagination envelope returned by all list endpoints.
 * Uses `limit` (not `perPage`) to match current API service conventions.
 */
export interface ServicePaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
/** Paginated list body returned by services (`data` + `meta`). */
export interface PaginatedListResponse<T> {
    data: T[];
    meta: ServicePaginationMeta;
}
/** HTTP success envelope for paginated list endpoints. */
export type ApiSuccessPaginatedListResponse<T> = {
    success: true;
} & PaginatedListResponse<T>;
/**
 * Resolves raw pagination inputs into validated Prisma `skip`/`take` arguments.
 * Clamps `limit` to [1, 100]; defaults `page` to 1.
 */
export declare function buildPaginationArgs(input: PaginationInput): PaginationArgs;
/**
 * Builds the consistent pagination envelope attached to every list response.
 */
export declare function buildPaginationMeta(opts: {
    page: number;
    limit: number;
    total: number;
}): ServicePaginationMeta;
//# sourceMappingURL=pagination.d.ts.map