"use strict";

const crypto = require("crypto");
const { query } = require("../../db");
const {
  buildOrderClause,
  buildSearchClause,
  buildFilterClause,
} = require("../../utils/queryBuilder");

function mapContact(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    verified: row.verified,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ─────────────────────────────────────────────
   EXTENDED MAPPER — contact + latest request
   Used by findContactsPaginated to surface the
   most recent request's content (category, source,
   message) directly in the admin list view without
   a second query per row.
───────────────────────────────────────────── */
 
function mapContactWithRequest(row) {
  if (!row) return null;
 
  return {
    ...mapContact(row),
    // Latest contact_request fields (null when no request exists)
    requestId:             row.request_id   || null,
    category:              row.category     || null,
    source:                row.source       || null,
    message:               row.message      || null,
    preferredContactTime:  row.preferred_contact_time || null,
    requestCreatedAt:      row.request_created_at || null,
  };
}
 
/* ─────────────────────────────────────────────
   FILTER COLUMN MAP
───────────────────────────────────────────── */
 
const CONTACT_FILTER_COLUMNS = {
  verified: "c.verified",
  source:   "cr.source",
  category: "cr.category",
};

async function findById(id) {
  const result = await query(
    `
    SELECT *
    FROM contacts
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return mapContact(result.rows[0]);
}

async function findByEmail(email) {
  const result = await query(
    `
    SELECT *
    FROM contacts
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
    `,
    [email]
  );

  return mapContact(result.rows[0]);
}

async function createContact({
  id,
  email,
  firstName,
  lastName,
  phone,
}) {
  
  const result = await query(
    `
    INSERT INTO contacts (
      id,
      email,
      first_name,
      last_name,
      phone,
      verified
    )
    VALUES (
      $1,$2,$3,$4,$5,false
    )
    RETURNING *
    `,
    [
      id,
      email,
      firstName,
      lastName,
      phone,
    ]
  );

  return mapContact(result.rows[0]);
}

async function markVerified(id) {
  const result = await query(
    `
    UPDATE contacts
    SET
      verified = true,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return mapContact(result.rows[0]);
}

async function getContacts() {
  const result = await query(
    `
    SELECT *
    FROM contacts
    ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapContact);
}

/* ─────────────────────────────────────────────
   FIND CONTACTS PAGINATED  ← NEW
   Admin-only. LEFT JOINs the most recent
   contact_request per contact (via DISTINCT ON)
   so category/source/message appear inline in
   the admin list without a second round-trip.
 
   Search: email, first_name, last_name, phone.
   Filters: verified (contact level),
            source / category (request level).
 
   @param {{
     offset:    number,
     limit:     number,
     search:    string,
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { verified?: string, source?: string, category?: string }
   }} opts
───────────────────────────────────────────── */
 
async function findContactsPaginated({
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
    buildSearchClause(
      search,
      ["c.email", "c.first_name", "c.last_name", "c.phone"],
      params,
      idx
    );
  idx = afterSearch;
 
  const { clause: filterClause, nextIdx: afterFilter } =
    buildFilterClause(filters, CONTACT_FILTER_COLUMNS, params, idx);
  idx = afterFilter;
 
  const orderClause = buildOrderClause(sortBy, sortOrder, "contacts");
 
  params.push(limit);
  const limitIdx = idx++;
  params.push(offset);
  const offsetIdx = idx;
 
  // DISTINCT ON contact_requests picks only the latest request per
  // contact (ORDER BY contact_id, created_at DESC inside the subquery).
  const sql = `
    SELECT
      c.id,
      c.email,
      c.first_name,
      c.last_name,
      c.phone,
      c.verified,
      c.verified_at,
      c.created_at,
      c.updated_at,
      cr.id           AS request_id,
      cr.category,
      cr.source,
      cr.message,
      cr.preferred_contact_time,
      cr.created_at   AS request_created_at,
      COUNT(*) OVER() AS _total
    FROM contacts c
    LEFT JOIN LATERAL (
      SELECT *
      FROM contact_requests
      WHERE contact_id = c.id
      ORDER BY created_at DESC
      LIMIT 1
    ) cr ON true
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
    rows:  result.rows.map(mapContactWithRequest),
    total,
  };
}
 
/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
 
module.exports = {
  findById,
  findByEmail,
  createContact,
  markVerified,
  getContacts,
  findContactsPaginated,   // ← new
};