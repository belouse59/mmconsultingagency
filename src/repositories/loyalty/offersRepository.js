"use strict";

const { query } = require("../../db");
const { makeError } = require("../../utils/errorHandler");
const { appendRow, getSheetValues } = require("../../services/sheetsService");

const {
  buildOrderClause,
  buildSearchClause,
  buildFilterClause,
} = require("../../utils/queryBuilder");

const SHEET = {
  OFFERS: "Offers",
};

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapOffer(row) {
  return {
    id:        row.id,
    title:     row.title,
    description: row.description || "",
    partnerId: row.partner_id,
    active:    row.active,
    createdAt: row.created_at,
  };
}

/* ─────────────────────────────────────────────
   FILTER COLUMN MAP
───────────────────────────────────────────── */

const OFFER_FILTER_COLUMNS = {
  active:    "active",
  partnerId: "partner_id",
};

/* ─────────────────────────────────────────────
   FIND ALL (existing — unchanged)
   Has Sheets fallback for Postgres failure.
───────────────────────────────────────────── */

async function findOffers() {
  try {
    const result = await query(`
      SELECT id, title, description, partner_id, active, created_at
      FROM offers
      ORDER BY created_at DESC
    `);

    return result.rows.map(mapOffer);

  } catch (err) {
    console.error("[offerRepo] Postgres failed, fallback Sheets:", err.message);

    const rows = await getSheetValues(SHEET.OFFERS);
    return rows.slice(1).map(r => ({
      id:          r[0],
      title:       r[1],
      description: r[2],
      partnerId:   r[3],
      active:      r[4] === "true" || r[4] === "TRUE",
      createdAt:   r[5],
    }));
  }
}

/* ─────────────────────────────────────────────
   FIND OFFERS PAGINATED  ← NEW
   Admin-only. Postgres only (no Sheets fallback).
   Returns { rows, total }.

   @param {{
     offset:    number,
     limit:     number,
     search:    string,
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { active?: string, partnerId?: string }
   }} opts
───────────────────────────────────────────── */

async function findOffersPaginated({
  offset    = 0,
  limit     = 20,
  search    = "",
  sortBy,
  sortOrder = "desc",
  filters   = {},
} = {}) {
  const params = [];
  let   idx    = 1;

  const { clause: searchClause, nextIdx: afterSearch } =
    buildSearchClause(search, ["title", "description"], params, idx);
  idx = afterSearch;

  const { clause: filterClause, nextIdx: afterFilter } =
    buildFilterClause(filters, OFFER_FILTER_COLUMNS, params, idx);
  idx = afterFilter;

  const orderClause = buildOrderClause(sortBy, sortOrder, "offers");

  params.push(limit);
  const limitIdx = idx++;
  params.push(offset);
  const offsetIdx = idx;

  const sql = `
    SELECT
      id,
      title,
      description,
      partner_id,
      active,
      created_at,
      COUNT(*) OVER() AS _total
    FROM offers
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
    rows:  result.rows.map(mapOffer),
    total,
  };
}

/* ─────────────────────────────────────────────
   ACTIVE OFFERS (existing — unchanged)
───────────────────────────────────────────── */

async function findActiveOffers() {
  const result = await query(
    `
    SELECT id, title, description, partner_id, active, created_at
    FROM offers
    WHERE active = $1
    ORDER BY created_at DESC
    `,
    [true]
  );

  return result.rows.map(mapOffer);
}

/* ─────────────────────────────────────────────
   ACTIVE OFFERS BY PARTNER (existing — unchanged)
───────────────────────────────────────────── */

async function findActiveOffersByPartner(partnerId) {
  const result = await query(
    `
    SELECT id, title, description, partner_id, active, created_at
    FROM offers
    WHERE (partner_id = $1 OR partner_id = $2)
      AND active = $3
    ORDER BY created_at DESC
    `,
    [partnerId, "Globale", true]
  );

  return result.rows.map(mapOffer);
}

/* ─────────────────────────────────────────────
   FIND ACTIVE OFFER BY ID (existing — unchanged)
───────────────────────────────────────────── */

async function findActiveOfferById(id) {
  const result = await query(
    `
    SELECT id, title, description, partner_id, active, created_at
    FROM offers
    WHERE id = $1
      AND active = $2
    `,
    [id, true]
  );

  const offers = result.rows.map(mapOffer);
  return offers.length ? offers[0] : [];
}

/* ─────────────────────────────────────────────
   CREATE OFFER (existing — unchanged)
───────────────────────────────────────────── */

async function createOffer({ id, title, description, partnerId }) {
  if (!title?.trim()) {
    throw makeError("Il titolo è obbligatorio.", 400);
  }

  await query(
    `
    INSERT INTO offers (id, title, description, partner_id, active, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    `,
    [id, title, description || "", partnerId, true]
  );

  try {
    await appendRow(SHEET.OFFERS, [
      id,
      title,
      description || "",
      partnerId,
      "true",
      new Date().toISOString(),
    ]);
  } catch (err) {
    console.error("[offerRepo] Sheet sync failed:", err.message);
  }

  return mapOffer({
    id,
    title,
    description,
    partner_id: partnerId,
    active:     true,
    created_at: new Date(),
  });
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  findOffers,
  findOffersPaginated,          // ← new
  findActiveOffers,
  findActiveOffersByPartner,
  findActiveOfferById,
  createOffer,
};