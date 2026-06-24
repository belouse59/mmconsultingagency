"use strict";

/**
 * src/middleware/paginationMiddleware.js
 *
 * Express middleware that validates and normalises
 * pagination query parameters for admin list endpoints.
 *
 * Attaches req.pagination to every request it processes.
 * Controllers read req.pagination — never re-parse query params.
 *
 * Usage (in route files):
 *   const { paginate } = require("../../middleware/paginationMiddleware");
 *
 *   router.get("/customers", paginate, adminGetCustomers);
 *   router.get("/partners",  paginate, adminGetPartners);
 *
 * req.pagination shape:
 *   {
 *     page:      number,    // validated, 1-based
 *     limit:     number,    // validated, clamped 1–100
 *     offset:    number,    // computed: (page - 1) * limit
 *     sortOrder: string,    // 'asc' | 'desc'
 *     sortBy:    string|undefined,
 *     search:    string,    // trimmed, empty string if absent
 *     filters:   object     // entity-specific keys passed through
 *   }
 *
 * Design notes:
 *   - Never throws — always normalises to safe defaults
 *   - Does not validate sortBy against a whitelist here;
 *     whitelist validation happens in the repository layer
 *     (see utils/queryBuilder.js SORT_COLUMNS)
 *   - Entity-specific filter params (status, partnerId, etc.)
 *     are collected into req.pagination.filters as raw strings
 *     for the service/repository to interpret
 */

const { parsePaginationQuery } = require("../utils/paginate");

/* ─────────────────────────────────────────────
   KNOWN FILTER KEYS
   These query params are not pagination params —
   they are passed through as filters.
   Extend this list as new admin modules are added.
───────────────────────────────────────────── */

const KNOWN_FILTER_KEYS = new Set([
  "active",
  "status",
  "partnerId",
  "category",
  "offerId",
  "verified",
  "subscribed",      // newsletters
  "energySource",    // simulator
  "source",          // contacts
]);

/* ─────────────────────────────────────────────
   PAGINATION MIDDLEWARE
───────────────────────────────────────────── */

function paginate(req, res, next) {
  const { page, limit, offset, sortOrder, sortBy, search } =
    parsePaginationQuery(req.query);

  // Collect entity-specific filter params
  const filters = {};
  for (const key of KNOWN_FILTER_KEYS) {
    if (req.query[key] !== undefined) {
      filters[key] = req.query[key];
    }
  }

  req.pagination = {
    page,
    limit,
    offset,
    sortOrder,
    sortBy,
    search,
    filters,
  };

  next();
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = { paginate };