"use strict";

const { query } = require("../../db");
const { makeError } = require("../../utils/errorHandler");

const {
  buildOrderClause,
  buildSearchClause,
  buildFilterClause,
} = require("../../utils/queryBuilder");

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapRedemption(row) {
  return {
    id:          row.id,
    customerId:  row.customer_id,
    partnerId:   row.partner_id,
    offerId:     row.offer_id,
    usedToken:   row.used_token,
    redeemedAt:  row.redeemed_at,
    createdAt:   row.created_at
  };
}

/* ─────────────────────────────────────────────
   FILTER COLUMN MAP
───────────────────────────────────────────── */

const REDEMPTION_FILTER_COLUMNS = {
  partnerId:  "partner_id",
  offerId:    "offer_id",
  customerId: "customer_id",
};

/* ─────────────────────────────────────────────
   CREATE
───────────────────────────────────────────── */

async function createRedemption({
  id,
  customerId,
  partnerId,
  offerId,
  token,
}) {
  try {
    const result = await query(
      `
      INSERT INTO redemptions
      (id, customer_id, partner_id, offer_id, used_token, redeemed_at, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
      `,
      [id, customerId, partnerId, offerId, token]
    );

    return mapRedemption(result.rows[0]);

  } catch (err) {
    if (err.code === "23505") {
      throw makeError("REDEMPTION_ALREADY_EXISTS", 409);
    }
    throw err;
  }
}

/* ─────────────────────────────────────────────
   FIND BY ID
───────────────────────────────────────────── */

async function findRedemptionById(id) {
  const result = await query(
    `SELECT * FROM redemptions WHERE id = $1`,
    [id]
  );

  const row = result.rows[0];
  if (!row) return null;

  return mapRedemption(row);
}

/* ─────────────────────────────────────────────
   FIND CUSTOMER + PARTNER REDEMPTIONS (existing)
───────────────────────────────────────────── */

async function findCustomerPartnerRedemptions(customerId, partnerId) {
  const result = await query(
    `
    SELECT *
    FROM redemptions
    WHERE customer_id = $1
      AND (partner_id = $2 OR partner_id = $3)
    `,
    [customerId, partnerId, "Globale"]
  );

  return result.rows.map(mapRedemption);
}

/* ─────────────────────────────────────────────
   FIND REDEMPTION (existing — for existence checks)
───────────────────────────────────────────── */

async function findCustomerPartnerOfferRedemption(
  customerId,
  partnerId,
  offerId
) {
  const result = await query(
    `
    SELECT *
    FROM redemptions
    WHERE customer_id = $1
      AND partner_id  = $2
      AND offer_id    = $3
    `,
    [customerId, partnerId, offerId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return mapRedemption(row);
}

/* ─────────────────────────────────────────────
   FIND ALL (existing — unchanged)
───────────────────────────────────────────── */

async function findRedemptions() {
  const result = await query(
    `
    SELECT *
    FROM redemptions
    ORDER BY redeemed_at DESC
    `
  );

  return result.rows.map(mapRedemption);
}

/* ─────────────────────────────────────────────
   FIND REDEMPTIONS PAGINATED  ← NEW
   Admin-only. Postgres only.
   Returns { rows, total }.

   Supports filtering by partnerId, offerId,
   customerId. No full-text search (no user-facing
   string columns to search on redemptions).

   @param {{
     offset:    number,
     limit:     number,
     search:    string,       // searches customer_id, partner_id (uuid prefix match)
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { partnerId?: string, offerId?: string, customerId?: string }
   }} opts
───────────────────────────────────────────── */

async function findRedemptionsPaginated({
  offset    = 0,
  limit     = 20,
  search    = "",
  sortBy,
  sortOrder = "desc",
  filters   = {},
} = {}) {
  const params = [];
  let   idx    = 1;

  // Redemptions have no natural text columns.
  // Search is applied as a prefix match on partner_id
  // (useful for filtering by partner slug in admin).
  const { clause: searchClause, nextIdx: afterSearch } =
    buildSearchClause(search, ["partner_id", "offer_id"], params, idx);
  idx = afterSearch;

  const { clause: filterClause, nextIdx: afterFilter } =
    buildFilterClause(filters, REDEMPTION_FILTER_COLUMNS, params, idx);
  idx = afterFilter;

  const orderClause = buildOrderClause(sortBy, sortOrder, "redemptions");

  params.push(limit);
  const limitIdx = idx++;
  params.push(offset);
  const offsetIdx = idx;

  const sql = `
    SELECT
      id,
      customer_id,
      partner_id,
      offer_id,
      used_token,
      redeemed_at,
      created_at,
      COUNT(*) OVER() AS _total
    FROM redemptions
    WHERE 1=1
      ${searchClause}
      ${filterClause}
    ${orderClause}
    LIMIT  $${limitIdx}
    OFFSET $${offsetIdx}
  `;

  const result = await query(sql, params);

  const total = result.rows.length > 0
    ? parseInt(result.rows[0]._total, 10)
    : 0;

  return {
    rows:  result.rows.map(mapRedemption),
    total,
  };
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  createRedemption,
  findRedemptionById,
  findCustomerPartnerRedemptions,
  findCustomerPartnerOfferRedemption,
  findRedemptions,
  findRedemptionsPaginated,     // ← new
};