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

/** Maximum rows returned per page. Prevents runaway memory usage. */
const MAX_PAGE_SIZE = 100;

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
export type ApiSuccessPaginatedListResponse<T> = { success: true } & PaginatedListResponse<T>;

/**
 * Resolves raw pagination inputs into validated Prisma `skip`/`take` arguments.
 * Clamps `limit` to [1, 100]; defaults `page` to 1.
 */
export function buildPaginationArgs(input: PaginationInput): PaginationArgs {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(Math.max(1, input.limit ?? 20), MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/**
 * Builds the consistent pagination envelope attached to every list response.
 */
export function buildPaginationMeta(opts: {
  page: number;
  limit: number;
  total: number;
}): ServicePaginationMeta {
  return {
    page: opts.page,
    limit: opts.limit,
    total: opts.total,
    totalPages: Math.ceil(opts.total / opts.limit),
  };
}
