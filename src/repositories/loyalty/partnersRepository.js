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
    id: row.id,
    name: row.name,
    legalName: row.legal_name,
    vatNumber: row.vat_number,
    email: row.email,
    phone: row.phone,
    website: row.website,
    category: row.category,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    description: row.description,
    offerDescription: row.offer_description,
    notes: row.notes,
    passwordHash: row.password_hash,
    mustChangePassword: Boolean(row.must_change_password),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ─────────────────────────────────────────────
   SHARED COLUMN LIST
   Used by every SELECT / RETURNING so mapPartner
   always receives the full record.
───────────────────────────────────────────── */

const PARTNER_COLUMNS = `
  id,
  name,
  legal_name,
  vat_number,
  email,
  phone,
  website,
  category,
  address,
  city,
  postal_code,
  description,
  offer_description,
  notes,
  password_hash,
  must_change_password,
  active,
  created_at,
  updated_at
`;

/* ─────────────────────────────────────────────
   FILTER COLUMN MAP — for findPartnersPaginated
───────────────────────────────────────────── */

const PARTNER_FILTER_COLUMNS = {
  active: "active",
  category: "category",
  city: "city",
};

/* ─────────────────────────────────────────────
   UPDATABLE FIELDS — for updatePartner
   Maps service-level keys to SQL columns.
   id, password, mustChangePassword
   are intentionally absent — they have their own
   dedicated update paths.
───────────────────────────────────────────── */

const PARTNER_UPDATABLE_FIELDS = {
  name: "name",
  legalName: "legal_name",
  vatNumber: "vat_number",
  email: "email",
  phone: "phone",
  website: "website",
  category: "category",
  address: "address",
  city: "city",
  postalCode: "postal_code",
  description: "description",
  offerDescription: "offer_description",
  notes: "notes",
  active: "active",
};

/* ─────────────────────────────────────────────
   CREATE
   Previously left NULL, which broke loginPartner()
   (findPartnerByIdentifier returned nothing for any
   partner created via the admin form). Existing rows
   are backfilled by the accompanying migration.
───────────────────────────────────────────── */

async function createPartner({
  id,
  name,
  legalName,
  vatNumber,
  email,
  phone,
  website,
  category,
  address,
  city,
  postalCode,
  description,
  offerDescription,
  notes,
  passwordHash,
}) {
  const result = await query(
    `
    INSERT INTO partners (
      id,
      name,
      legal_name,
      vat_number,
      email,
      phone,
      website,
      category,
      address,
      city,
      postal_code,
      description,
      offer_description,
      notes,
      password_hash,
      must_change_password,
      active,
      created_at,
      updated_at
    )
    VALUES (
      $1,  $2,  $3,  $4,  $5,  $6,  $7,
      $8,  $9,
      $10, $11, $12, $13, $14, $15,
      TRUE, TRUE, NOW(), NOW()
    )
    RETURNING ${PARTNER_COLUMNS}
    `,
    [
      id,
      name,
      legalName || null,
      vatNumber || null,
      email || null,
      phone || null,
      website || null,
      category,
      address || null,
      city || null,
      postalCode || null,
      description || null,
      offerDescription || null,
      notes || null,
      passwordHash,
    ]
  );

  return mapPartner(result.rows[0]);
}

/* ─────────────────────────────────────────────
   UPDATE PARTNER  ← NEW
   Partial update — only keys present in `fields`
   are written. Used by the admin edit drawer.

   @param {string} partnerId
   @param {object} fields — subset of PARTNER_UPDATABLE_FIELDS keys
   @returns {Promise<Partner|null>}
───────────────────────────────────────────── */

async function updatePartner(partnerId, fields = {}) {
  const setClauses = [];
  const params = [];
  let idx = 1;

  for (const [key, column] of Object.entries(PARTNER_UPDATABLE_FIELDS)) {
    if (fields[key] === undefined) continue;
    params.push(fields[key]);
    setClauses.push(`${column} = $${idx}`);
    idx++;
  }

  if (!setClauses.length) {
    // Nothing to update — return current record unchanged.
    return findPartnerById(partnerId);
  }

  setClauses.push("updated_at = NOW()");
  params.push(partnerId);

  const result = await query(
    `
    UPDATE partners
    SET ${setClauses.join(", ")}
    WHERE id = $${idx}
    RETURNING ${PARTNER_COLUMNS}
    `,
    params
  );

  return mapPartner(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND ALL (existing — unchanged contract)
───────────────────────────────────────────── */

async function findPartners() {
  const result = await query(
    `
    SELECT ${PARTNER_COLUMNS}
    FROM partners
    ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapPartner);
}

/* ─────────────────────────────────────────────
   FIND PARTNERS PAGINATED
   Admin-only. Postgres only.

   Search now covers: name, category, address,
   email, phone, vat_number, city.

   @param {{
     offset:    number,
     limit:     number,
     search:    string,
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { active?: string, category?: string, city?: string }
   }} opts
───────────────────────────────────────────── */

async function findPartnersPaginated({
  offset = 0,
  limit = 20,
  search = "",
  sortBy,
  sortOrder = "desc",
  filters = {},
} = {}) {
  const params = [];
  let idx = 1;

  const { clause: searchClause, nextIdx: afterSearch } =
    buildSearchClause(
      search,
      ["name", "category", "address", "email", "phone", "vat_number", "city"],
      params,
      idx
    );
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
      ${PARTNER_COLUMNS},
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
    rows: result.rows.map(mapPartner),
    total,
  };
}

/* ─────────────────────────────────────────────
   FIND ONE
   Returns the full record — used by:
     - loginPartner (via findPartnerByIdentifier)
     - admin edit drawer (via findPartnerById)
───────────────────────────────────────────── */

async function findPartnerById(id) {
  const result = await query(
    `
    SELECT ${PARTNER_COLUMNS}
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
    SELECT ${PARTNER_COLUMNS}
    FROM partners
    WHERE email = $1
    `,
    [identifier]
  );

  return mapPartner(result.rows[0]);
}

/* ─────────────────────────────────────────────
   PASSWORD UPDATE (existing — unchanged)
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
    RETURNING ${PARTNER_COLUMNS}
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
    RETURNING ${PARTNER_COLUMNS}
    `,
    [data.partnerId, data.passwordHash]
  );

  return mapPartner(result.rows[0]);
}

/* ─────────────────────────────────────────────
   ACTIVE UPDATE (existing — now also bumps updated_at
   for consistency with updatePartner)
───────────────────────────────────────────── */

async function setPartnerActive(partnerId, active) {
  const result = await query(
    `
    UPDATE partners
    SET
      active     = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING ${PARTNER_COLUMNS}
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
  updatePartner,           // ← new
  findPartners,
  findPartnersPaginated,
  findPartnerById,
  findPartnerByIdentifier,
  updatePartnerPassword,
  setPartnerActive,
  updatePassword,
};