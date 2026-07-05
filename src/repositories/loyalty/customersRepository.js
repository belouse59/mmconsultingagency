"use strict";

const { query } = require("../../db");

const {
  appendRow,
  getSheetValues,
} = require("../../services/sheetsService");

const {
  buildOrderClause,
  buildSearchClause,
  buildFilterClause,
} = require("../../utils/queryBuilder");

const SHEET = {
  CUSTOMERS: "Customers",
};

const ENABLE_SHEETS_FALLBACK =
  process.env.ENABLE_SHEETS_FALLBACK === "true";

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapCustomer(row) {
  if (!row) return null;

  return {
    id:             row.id,
    full_name:      row.full_name,
    identifier:     row.identifier,
    identifierType: row.identifier_type,
    password:       row.password_hash,
    active:         row.active,
    createdAt:      row.created_at,
    verified:       row.verified,
    verifiedAt:     row.verified_at,
  };
}

/* ─────────────────────────────────────────────
   FILTER COLUMN MAP
   Maps service-level filter keys to SQL columns.
───────────────────────────────────────────── */

const CUSTOMER_FILTER_COLUMNS = {
  active:   "active",
  verified: "verified",
};

/* ─────────────────────────────────────────────
   CREATE
───────────────────────────────────────────── */

async function createCustomer({
  id,
  full_name,
  identifier,
  identifierType,
  password,
  active,
}) {
  const result = await query(
    `
    INSERT INTO customers
    (
      id,
      full_name,
      identifier,
      identifier_type,
      password_hash,
      active
    )
    VALUES
    ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      full_name,
      identifier,
      identifier_type,
      password_hash,
      active,
      created_at,
      verified
    `,
    [id, full_name, identifier, identifierType, password, active]
  );

  const customer = mapCustomer(result.rows[0]);
  syncCustomerToSheets(customer);
  return customer;
}

/* ─────────────────────────────────────────────
   MARK VERIFIED
───────────────────────────────────────────── */

async function markVerified(id) {
  const result = await query(
    `
    UPDATE customers
    SET
      verified    = true,
      active      = true,
      verified_at = NOW(),
      updated_at  = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return mapCustomer(result.rows[0]);
}

/* ─────────────────────────────────────────────
   UPDATE PASSWORD
───────────────────────────────────────────── */

async function updatePassword(data) {
  const result = await query(
    `
    UPDATE customers
    SET
      password_hash = $2,
      updated_at    = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [data.customerId, data.passwordHash]
  );

  return mapCustomer(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND ALL (existing — unchanged)
   Used by non-admin paths. Sheets fallback intact.
───────────────────────────────────────────── */

async function findCustomers() {
  try {
    const result = await query(
      `
      SELECT
        id,
        full_name,
        identifier,
        identifier_type,
        password_hash,
        active,
        created_at
      FROM customers
      ORDER BY created_at DESC
      `
    );

    return result.rows.map(mapCustomer);

  } catch (err) {
    if (!ENABLE_SHEETS_FALLBACK) throw err;

    const rows = await getSheetValues(SHEET.CUSTOMERS);
    return rows.slice(1).map(mapSheetCustomer);
  }
}

/* ─────────────────────────────────────────────
   FIND CUSTOMERS PAGINATED  ← NEW
   Admin-only. Postgres only (no Sheets fallback).
   Returns { rows, total } — service builds envelope.

   @param {{
     page:      number,
     limit:     number,
     offset:    number,
     search:    string,
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { active?: string, verified?: string }
   }} opts
   @returns {Promise<{ rows: Customer[], total: number }>}
───────────────────────────────────────────── */

async function findCustomersPaginated({
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
    buildSearchClause(search, ["full_name", "identifier"], params, idx);
  idx = afterSearch;

  const { clause: filterClause, nextIdx: afterFilter } =
    buildFilterClause(filters, CUSTOMER_FILTER_COLUMNS, params, idx);
  idx = afterFilter;

  const orderClause = buildOrderClause(sortBy, sortOrder, "customers");

  // LIMIT + OFFSET
  params.push(limit);
  const limitIdx = idx++;
  params.push(offset);
  const offsetIdx = idx;

  const sql = `
    SELECT
      id,
      full_name,
      identifier,
      identifier_type,
      password_hash,
      active,
      created_at,
      verified,
      verified_at,
      COUNT(*) OVER() AS _total
    FROM customers
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
    rows:  result.rows.map(mapCustomer),
    total,
  };
}

/* ─────────────────────────────────────────────
   FIND BY IDENTIFIER
───────────────────────────────────────────── */

async function findCustomerByIdentifier(identifier) {
  const result = await query(
    `
    SELECT
      id,
      full_name,
      identifier,
      identifier_type,
      password_hash,
      active,
      created_at,
      verified,
      verified_at
    FROM customers
    WHERE identifier = $1
    LIMIT 1
    `,
    [identifier]
  );

  return mapCustomer(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND BY ID
───────────────────────────────────────────── */

async function findCustomerById(id) {
  const result = await query(
    `
    SELECT
      id,
      full_name,
      identifier,
      identifier_type,
      password_hash,
      active,
      created_at
    FROM customers
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return mapCustomer(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND ACTIVE
───────────────────────────────────────────── */

async function findActiveCustomers() {
  const result = await query(
    `
    SELECT
      id,
      full_name,
      identifier,
      identifier_type,
      password_hash,
      active,
      created_at
    FROM customers
    WHERE active = true
    `
  );

  return result.rows.map(mapCustomer);
}

/* ─────────────────────────────────────────────
   INTERNAL — SHEETS HELPERS
───────────────────────────────────────────── */

function mapSheetCustomer(r) {
  return {
    id:             r[0],
    full_name:      r[1],
    identifier:     r[2],
    identifierType: r[3],
    password:       r[4],
    active:         r[5] === "true",
    createdAt:      r[6],
  };
}

function syncCustomerToSheets(customer) {
  if (!ENABLE_SHEETS_FALLBACK) return;

  appendRow(SHEET.CUSTOMERS, [
    customer.id,
    customer.full_name,
    customer.identifier,
    customer.identifierType,
    customer.password,
    String(customer.active),
    customer.createdAt,
  ]).catch(err => {
    console.error("[Sheets Sync]", err);
  });
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   UPDATE CUSTOMER  ← NEW
   Editable fields: full_name only for now.
   identifier is intentionally NOT editable via
   this route — changing a login identifier is a
   separate, higher-risk operation (would need
   email/phone verification of the new value).
───────────────────────────────────────────── */

async function updateCustomer(id, { full_name }) {
  const result = await query(
    `
    UPDATE customers
    SET
      full_name  = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [full_name, id]
  );

  return mapCustomer(result.rows[0]);
}

/* ─────────────────────────────────────────────
   SET ACTIVE  (existing — unchanged)
───────────────────────────────────────────── */

async function setCustomerActive(customerId, active) {
  const result = await query(
    `
    UPDATE customers
    SET
      active     = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [active, customerId]
  );

  return mapCustomer(result.rows[0]);
}

/* ───────────────────────────────────────────── */

module.exports = {
  createCustomer,
  markVerified,
  updatePassword,
  findCustomers,
  findCustomersPaginated,
  findCustomerByIdentifier,
  findCustomerById,
  findActiveCustomers,
  setCustomerActive,
  updateCustomer,   // ← new
};