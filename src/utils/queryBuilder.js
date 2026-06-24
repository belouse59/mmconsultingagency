"use strict";

/**
 * src/utils/queryBuilder.js
 *
 * Safe SQL clause builders for paginated queries.
 * All user-supplied column names are validated against
 * per-entity whitelists before interpolation —
 * never trust raw input in SQL identifiers.
 *
 * Used by: repositories/loyalty/*.js
 *
 * Design decisions:
 *   - Returns parameterised WHERE clauses (values pushed onto params array)
 *   - Returns safe ORDER BY strings (column whitelisted, direction escaped)
 *   - Caller owns the params array — builders mutate it in place
 *   - No query string is built here — fragments only
 */

/* ─────────────────────────────────────────────
   ALLOWED SORT COLUMNS
   Whitelist per entity. Only columns in these
   maps may be used in ORDER BY clauses.
   Key   = client-facing sortBy value
   Value = actual SQL column name
───────────────────────────────────────────── */

const SORT_COLUMNS = {

  customers: {
    createdAt:  "created_at",
    full_name:  "full_name",
    identifier: "identifier",
    active:     "active",
  },

  partners: {
    createdAt: "created_at",
    name:      "name",
    category:  "category",
    city:      "city",
    email:     "email",
    active:    "active",
  },

  offers: {
    createdAt: "created_at",
    title:     "title",
    partnerId: "partner_id",
    active:    "active",
  },

  redemptions: {
    redeemedAt: "redeemed_at",
    customerId: "customer_id",
    partnerId:  "partner_id",
    offerId:    "offer_id",
  },

  partnerRequests: {
    createdAt:    "created_at",
    submittedAt:  "submitted_at",
    businessName: "business_name",
    status:       "status",
    category:     "category",
  },

  newsletters: {
    createdAt:    "created_at",
    email:        "email",
    subscribed:   "subscribed",
    verified:     "verified",
    subscribedAt: "subscribed_at",
  },

  simulatorRequests: {
    createdAt:    "sr.created_at",
    energySource: "sr.energy_source",
    provider:     "sr.provider",
    estimatedMonthlySavings: "sr.estimated_monthly_savings",
    annualBill:   "sr.annual_bill",
  },

  contacts: {
    createdAt:  "c.created_at",
    email:      "c.email",
    lastName:   "c.last_name",
    verified:   "c.verified",
  },

};

/* ─────────────────────────────────────────────
   buildOrderClause
   Returns a safe SQL ORDER BY fragment.

   @param {string|undefined} sortBy     — client-supplied column key
   @param {'asc'|'desc'}     sortOrder  — direction
   @param {string}           entity     — key into SORT_COLUMNS
   @returns {string}                    — e.g. "ORDER BY created_at DESC"
───────────────────────────────────────────── */

function buildOrderClause(sortBy, sortOrder, entity) {
  const allowed  = SORT_COLUMNS[entity] || {};
  const column   = allowed[sortBy] || allowed["createdAt"] || "created_at";
  const direction = sortOrder === "asc" ? "ASC" : "DESC";
  return `ORDER BY ${column} ${direction}`;
}

/* ─────────────────────────────────────────────
   buildSearchClause
   Returns a parameterised WHERE fragment for
   a full-text ILIKE search across given columns.

   Pushes the search value onto params and
   returns the fragment + the next param index.

   @param {string}   search      — trimmed search string
   @param {string[]} columns     — SQL column names to search
   @param {any[]}    params      — existing params array (mutated)
   @param {number}   startIdx    — next $N index (1-based)
   @returns {{ clause: string, nextIdx: number }}

   Usage:
     const params = [];
     const { clause, nextIdx } = buildSearchClause(
       search, ['full_name', 'identifier'], params, 1
     );
     // clause = "AND (full_name ILIKE $1 OR identifier ILIKE $1)"
     // params = ['%mario%']
     // nextIdx = 2
───────────────────────────────────────────── */

function buildSearchClause(search, columns, params, startIdx) {
  if (!search || !columns.length) {
    return { clause: "", nextIdx: startIdx };
  }

  const value = `%${search}%`;
  params.push(value);
  const idx = startIdx;

  const conditions = columns
    .map(col => `${col} ILIKE $${idx}`)
    .join(" OR ");

  return {
    clause:  `AND (${conditions})`,
    nextIdx: startIdx + 1,
  };
}

/* ─────────────────────────────────────────────
   buildFilterClause
   Appends simple equality filters to params.

   @param {object} filters   — { active: true, partnerId: 'x' }
   @param {object} columnMap — { active: 'active', partnerId: 'partner_id' }
   @param {any[]}  params    — existing params array (mutated)
   @param {number} startIdx  — next $N index (1-based)
   @returns {{ clause: string, nextIdx: number }}
───────────────────────────────────────────── */

function buildFilterClause(filters, columnMap, params, startIdx) {
  const clauses = [];
  let idx = startIdx;

  for (const [key, value] of Object.entries(filters || {})) {
    const column = columnMap[key];
    if (!column || value === undefined || value === null || value === "") continue;
    params.push(value);
    clauses.push(`${column} = $${idx}`);
    idx++;
  }

  return {
    clause:  clauses.length ? `AND ${clauses.join(" AND ")}` : "",
    nextIdx: idx,
  };
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  buildOrderClause,
  buildSearchClause,
  buildFilterClause,
  SORT_COLUMNS,
};