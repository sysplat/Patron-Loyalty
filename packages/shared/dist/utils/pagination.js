"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPaginationArgs = buildPaginationArgs;
exports.buildPaginationMeta = buildPaginationMeta;
/** Maximum rows returned per page. Prevents runaway memory usage. */
const MAX_PAGE_SIZE = 100;
/**
 * Resolves raw pagination inputs into validated Prisma `skip`/`take` arguments.
 * Clamps `limit` to [1, 100]; defaults `page` to 1.
 */
function buildPaginationArgs(input) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(Math.max(1, input.limit ?? 20), MAX_PAGE_SIZE);
    return { page, limit, skip: (page - 1) * limit, take: limit };
}
/**
 * Builds the consistent pagination envelope attached to every list response.
 */
function buildPaginationMeta(opts) {
    return {
        page: opts.page,
        limit: opts.limit,
        total: opts.total,
        totalPages: Math.ceil(opts.total / opts.limit),
    };
}
//# sourceMappingURL=pagination.js.map