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

function mapPartnerRequest(row) {
  if (!row) return null;

  return {
    id:                 row.id,
    businessName:       row.business_name,
    vatNumber:          row.vat_number,
    email:              row.email,
    phone:              row.phone,
    category:           row.category,
    description:        row.description,
    status:             row.status,
    source:             row.source,
    submittedAt:        row.submitted_at,
    reviewedAt:         row.reviewed_at,
    reviewedBy:         row.reviewed_by,
    reviewNotes:        row.review_notes,
    convertedPartnerId: row.converted_partner_id,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

/* ─────────────────────────────────────────────
   SHARED COLUMN LIST
───────────────────────────────────────────── */

const PARTNER_REQUEST_COLUMNS = `
  id,
  business_name,
  vat_number,
  email,
  phone,
  category,
  description,
  status,
  source,
  submitted_at,
  reviewed_at,
  reviewed_by,
  review_notes,
  converted_partner_id,
  created_at,
  updated_at
`;

/* ─────────────────────────────────────────────
   FILTER COLUMN MAP — for findPartnerRequestsPaginated
───────────────────────────────────────────── */

const PARTNER_REQUEST_FILTER_COLUMNS = {
  status:   "status",
  category: "category",
  source:   "source",
};

/* ─────────────────────────────────────────────
   CREATE
   Called by partnerRequestLoyaltyService.submitRequest()
   — public, unauthenticated endpoint.
───────────────────────────────────────────── */

async function createPartnerRequest({
  id,
  businessName,
  vatNumber,
  email,
  phone,
  category,
  description,
  source,
  status
}) {
  const result = await query(
    `
    INSERT INTO loyalty_partner_requests (
      id,
      business_name,
      vat_number,
      email,
      phone,
      category,
      description,
      status,
      source,
      submitted_at,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW()
    )
    RETURNING ${PARTNER_REQUEST_COLUMNS}
    `,
    [
      id,
      businessName,
      vatNumber   || null,
      email,
      phone       || null,
      category,
      description,
      status      || "pending",
      source      || "landing_page",
    ]
  );

  return mapPartnerRequest(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND ONE
   Used by approveRequest / rejectRequest to load
   the request before transitioning its status.
───────────────────────────────────────────── */

async function findPartnerRequestById(id) {
  const result = await query(
    `
    SELECT ${PARTNER_REQUEST_COLUMNS}
    FROM loyalty_partner_requests
    WHERE id = $1
    `,
    [id]
  );

  return mapPartnerRequest(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND PAGINATED
   Admin-only. Postgres only.

   Search covers: business_name, email, vat_number, phone.
   Filters: status, category, source.

   @param {{
     offset:    number,
     limit:     number,
     search:    string,
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { status?: string, category?: string, source?: string }
   }} opts
───────────────────────────────────────────── */

async function findPartnerRequestsPaginated({
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
      ["business_name", "email", "vat_number", "phone"],
      params,
      idx
    );
  idx = afterSearch;

  const { clause: filterClause, nextIdx: afterFilter } =
    buildFilterClause(filters, PARTNER_REQUEST_FILTER_COLUMNS, params, idx);
  idx = afterFilter;

  const orderClause = buildOrderClause(sortBy, sortOrder, "partnerRequests");

  params.push(limit);
  const limitIdx = idx++;
  params.push(offset);
  const offsetIdx = idx;

  const sql = `
    SELECT
      ${PARTNER_REQUEST_COLUMNS},
      COUNT(*) OVER() AS _total
    FROM loyalty_partner_requests
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
    rows:  result.rows.map(mapPartnerRequest),
    total,
  };
}

/* ─────────────────────────────────────────────
   UPDATE STATUS
   Used by both approveRequest and rejectRequest.

   @param {{
     id:                 string,
     status:             'approved' | 'rejected',
     reviewedBy:         string | null,
     reviewNotes:        string | null,
     convertedPartnerId: string | null
   }} opts
───────────────────────────────────────────── */

async function updatePartnerRequestStatus({
  id,
  status,
  reviewedBy,
  reviewNotes,
  convertedPartnerId,
}) {
  const result = await query(
    `
    UPDATE loyalty_partner_requests
    SET
      status               = $1,
      reviewed_at          = NOW(),
      reviewed_by          = $2,
      review_notes         = $3,
      converted_partner_id = $4,
      updated_at           = NOW()
    WHERE id = $5
    RETURNING ${PARTNER_REQUEST_COLUMNS}
    `,
    [
      status,
      reviewedBy   || null,
      reviewNotes  || null,
      convertedPartnerId || null,
      id,
    ]
  );

  return mapPartnerRequest(result.rows[0]);
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  createPartnerRequest,
  findPartnerRequestById,
  findPartnerRequestsPaginated,
  updatePartnerRequestStatus,
};