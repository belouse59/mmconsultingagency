"use strict";

const { query } = require("../../db");

const {
  buildOrderClause,
  buildSearchClause,
  buildFilterClause,
} = require("../../utils/queryBuilder");

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapPartner(row) {
  if (!row) return null;

  return {
    id:                 row.id,
    name:               row.name,
    identifier:         row.identifier,
    identifier_type:    row.identifier_type,
    category:           row.category,
    address:            row.address,
    passwordHash:       row.password_hash,
    mustChangePassword: Boolean(row.must_change_password),
    active:             Boolean(row.active),
    createdAt:          row.created_at,
  };
}

/* ─────────────────────────────────────────────
   FILTER COLUMN MAP
───────────────────────────────────────────── */

const PARTNER_FILTER_COLUMNS = {
  active:   "active",
  category: "category",
};

/* ─────────────────────────────────────────────
   CREATE
───────────────────────────────────────────── */

async function createPartner({
  id,
  name,
  category,
  address,
  passwordHash,
}) {
  const result = await query(
    `
    INSERT INTO partners
    (
      id,
      name,
      category,
      address,
      password_hash,
      must_change_password,
      active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, NOW(), NOW())
    RETURNING *
    `,
    [id, name, category, address, passwordHash]
  );

  return mapPartner(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND ALL (existing — unchanged)
───────────────────────────────────────────── */

async function findPartners() {
  const result = await query(
    `
    SELECT
      id,
      name,
      category,
      address,
      password_hash,
      must_change_password,
      active,
      created_at
    FROM partners
    ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapPartner);
}

/* ─────────────────────────────────────────────
   FIND PARTNERS PAGINATED  ← NEW
   Admin-only. Postgres only.
   Returns { rows, total }.

   @param {{
     offset:    number,
     limit:     number,
     search:    string,
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { active?: string, category?: string }
   }} opts
───────────────────────────────────────────── */

async function findPartnersPaginated({
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
    buildSearchClause(search, ["name", "category", "address"], params, idx);
  idx = afterSearch;

  const { clause: filterClause, nextIdx: afterFilter } =
    buildFilterClause(filters, PARTNER_FILTER_COLUMNS, params, idx);
  idx = afterFilter;

  const orderClause = buildOrderClause(sortBy, sortOrder, "partners");

  params.push(limit);
  const limitIdx = idx++;
  params.push(offset);
  const offsetIdx = idx;

  const sql = `
    SELECT
      id,
      name,
      category,
      address,
      password_hash,
      must_change_password,
      active,
      created_at,
      COUNT(*) OVER() AS _total
    FROM partners
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
    rows:  result.rows.map(mapPartner),
    total,
  };
}

/* ─────────────────────────────────────────────
   FIND ONE
───────────────────────────────────────────── */

async function findPartnerById(id) {
  const result = await query(
    `
    SELECT
      id,
      name,
      category,
      address,
      password_hash,
      must_change_password,
      active,
      created_at
    FROM partners
    WHERE id = $1
    `,
    [id]
  );

  return mapPartner(result.rows[0]);
}

async function findPartnerByIdentifier(identifier) {
  const result = await query(
    `
    SELECT
      id,
      name,
      identifier,
      identifier_type,
      category,
      address,
      password_hash,
      must_change_password,
      active,
      created_at
    FROM partners
    WHERE identifier = $1
    `,
    [identifier]
  );

  return mapPartner(result.rows[0]);
}

/* ─────────────────────────────────────────────
   PASSWORD UPDATE
───────────────────────────────────────────── */

async function updatePartnerPassword({
  partnerId,
  passwordHash,
  mustChangePassword,
}) {
  const result = await query(
    `
    UPDATE partners
    SET
      password_hash        = $1,
      must_change_password = $2,
      updated_at           = NOW()
    WHERE id = $3
    RETURNING *
    `,
    [passwordHash, mustChangePassword, partnerId]
  );

  return mapPartner(result.rows[0]);
}

async function updatePassword(data) {
  const result = await query(
    `
    UPDATE partners
    SET
      password_hash = $2,
      updated_at    = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [data.partnerId, data.passwordHash]
  );

  return mapPartner(result.rows[0]);
}

/* ─────────────────────────────────────────────
   ACTIVE UPDATE
───────────────────────────────────────────── */

async function setPartnerActive(partnerId, active) {
  const result = await query(
    `
    UPDATE partners
    SET active = $1
    WHERE id = $2
    RETURNING *
    `,
    [active, partnerId]
  );

  return mapPartner(result.rows[0]);
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  createPartner,
  findPartners,
  findPartnersPaginated,        // ← new
  findPartnerById,
  findPartnerByIdentifier,
  updatePartnerPassword,
  setPartnerActive,
  updatePassword,
};