"use strict";

/**
 * src/utils/paginate.js
 *
 * Platform-level pagination utilities.
 * Pure functions — no dependencies, no side effects.
 * Used by: service layer, middleware.
 *
 * Design contract:
 *   Repositories return   → { rows: [...], total: number }
 *   Services call         → buildPaginationMeta()
 *   Services return       → { data: [...], pagination: {...} }
 *   Controllers read      → req.pagination (set by paginationMiddleware)
 */

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const PAGINATION_DEFAULTS = {
  page:       1,
  limit:      20,
  sortOrder:  "desc",
};

const PAGINATION_LIMITS = {
  minPage:    1,
  minLimit:   1,
  maxLimit:   100,
};

/* ─────────────────────────────────────────────
   buildPaginationMeta
   Called by service layer after receiving
   { rows, total } from a repository.

   Returns the standard pagination envelope
   attached to every paginated API response.
───────────────────────────────────────────── */

/**
 * @param {{ page: number, limit: number, total: number }} opts
 * @returns {{
 *   page:        number,
 *   limit:       number,
 *   totalItems:  number,
 *   totalPages:  number,
 *   hasNext:     boolean,
 *   hasPrevious: boolean
 * }}
 */
function buildPaginationMeta({ page, limit, total }) {
  const totalPages   = Math.max(1, Math.ceil(total / limit));
  const safePage     = Math.min(page, totalPages);

  return {
    page:        safePage,
    limit,
    totalItems:  total,
    totalPages,
    hasNext:     safePage < totalPages,
    hasPrevious: safePage > 1,
  };
}

/* ─────────────────────────────────────────────
   parsePaginationQuery
   Normalises and validates raw query-string
   params into a safe pagination options object.

   Called by paginationMiddleware — not directly
   by controllers or services.
───────────────────────────────────────────── */

/**
 * @param {object} query   — req.query from Express
 * @returns {{
 *   page:      number,
 *   limit:     number,
 *   offset:    number,
 *   sortOrder: 'asc' | 'desc',
 *   search:    string,
 *   sortBy:    string | undefined
 * }}
 */
function parsePaginationQuery(query = {}) {
  const page  = clampInt(query.page,  PAGINATION_LIMITS.minPage,  Infinity,       PAGINATION_DEFAULTS.page);
  const limit = clampInt(query.limit, PAGINATION_LIMITS.minLimit, PAGINATION_LIMITS.maxLimit, PAGINATION_DEFAULTS.limit);

  const sortOrder = ["asc", "desc"].includes(
    String(query.sortOrder || "").toLowerCase()
  )
    ? String(query.sortOrder).toLowerCase()
    : PAGINATION_DEFAULTS.sortOrder;

  const search = typeof query.search === "string"
    ? query.search.trim()
    : "";

  // sortBy is passed through as a raw string.
  // Whitelisting happens in the repository layer
  // against a per-entity allowed-columns map.
  const sortBy = typeof query.sortBy === "string" && query.sortBy.trim()
    ? query.sortBy.trim()
    : undefined;

  const offset = (page - 1) * limit;

  return { page, limit, offset, sortOrder, search, sortBy };
}

/* ─────────────────────────────────────────────
   INTERNAL HELPERS
───────────────────────────────────────────── */

/**
 * Parse a value to integer and clamp within [min, max].
 * Falls back to defaultValue if parsing fails.
 */
function clampInt(value, min, max, defaultValue) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return defaultValue;
  return Math.min(Math.max(n, min), max);
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  buildPaginationMeta,
  parsePaginationQuery,
  PAGINATION_DEFAULTS,
  PAGINATION_LIMITS,
};