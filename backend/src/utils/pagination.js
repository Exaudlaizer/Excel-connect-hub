/**
 * Shared list pagination.
 *
 * Every list endpoint previously returned its whole table. That is fine with a
 * handful of rows and becomes a problem long before it becomes obvious — the
 * query slows, the JSON grows, and the browser renders thousands of nodes.
 *
 * Page numbers are 1-based because they are user-facing. `limit` is clamped so
 * a caller cannot ask for the whole table by passing ?limit=1000000.
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function readPagination(query, { defaultLimit = DEFAULT_LIMIT } = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : defaultLimit;

  return { page, limit, offset: (page - 1) * limit };
}

/** The block every paginated response carries, so clients can rely on one shape. */
function buildMeta({ page, limit, total }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    pages,
    hasMore: page < pages
  };
}

module.exports = { readPagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
