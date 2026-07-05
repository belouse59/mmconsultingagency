"use strict";

const { query }  = require("../../db");
const crypto     = require("crypto");

const {
  buildOrderClause,
  buildSearchClause,
  buildFilterClause,
} = require("../../utils/queryBuilder");

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapSimulation(row) {
  if (!row) return null;

  return {
    id:                      row.id,
    contactId:               row.contact_id,
    contactEmail:            row.contact_email    || null,
    contactPhone:            row.contact_phone    || null,
    contactVerified:         row.contact_verified ?? null,
    housingType:             row.housing_type,
    location:                row.location,
    surface:                 row.surface,
    energySource:            row.energy_source,
    peopleCount:             row.people_count,
    provider:                row.provider,
    annualBill:              row.annual_bill,
    electricityKwh:          row.electricity_kwh,
    gasKwh:                  row.gas_kwh,
    estimatedMonthlySavings: row.estimated_monthly_savings,
    createdAt:               row.created_at,
    status:                  row.status       || "new",   // ← new
    contactedAt:             row.contacted_at || null,      // ← new
    contactedBy:             row.contacted_by || null,       // ← new
    archived:                Boolean(row.archived),            // ← new
  };
}

/* ─────────────────────────────────────────────
   FILTER COLUMN MAP
───────────────────────────────────────────── */

const SIMULATOR_FILTER_COLUMNS = {
  energySource: "sr.energy_source",
  hasContact:   null, // handled manually below — can't use simple = $N
};

/* ─────────────────────────────────────────────
   CREATE (existing — unchanged)
───────────────────────────────────────────── */

async function createSimulationRequest({
  contactId,
  housingType,
  location,
  surface,
  energySource,
  peopleCount,
  provider,
  annualBill,
  electricityKwh,
  gasKwh,
  estimatedMonthlySavings,
}) {
  const id =
    `simulator-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const result = await query(
    `
    INSERT INTO simulation_requests (
      id,
      contact_id,
      housing_type,
      location,
      surface,
      energy_source,
      people_count,
      provider,
      annual_bill,
      electricity_kwh,
      gas_kwh,
      estimated_monthly_savings
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
    )
    RETURNING *
    `,
    [
      id,
      contactId,
      housingType,
      location,
      surface,
      energySource,
      peopleCount,
      provider,
      annualBill,
      electricityKwh,
      gasKwh,
      estimatedMonthlySavings,
    ]
  );

  return mapSimulation(result.rows[0]);
}

/* ─────────────────────────────────────────────
   GET ALL (existing — unchanged)
───────────────────────────────────────────── */

async function getSimulations() {
  const result = await query(
    `
    SELECT *
    FROM simulation_requests
    ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapSimulation);
}

/* ─────────────────────────────────────────────
   FIND PAGINATED  ← NEW
   Admin-only. LEFT JOINs contacts so the admin
   can see and search by the submitter's email /
   phone, even though contact_id is nullable
   (anonymous simulator runs have no linked contact).

   Search: contacts.email, contacts.phone, sr.location,
           sr.provider.
   Filters: energySource (sr.energy_source).

   @param {{
     offset:    number,
     limit:     number,
     search:    string,
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { energySource?: string }
   }} opts
───────────────────────────────────────────── */

async function findSimulationsPaginated({
  offset    = 0,
  limit     = 20,
  search    = "",
  sortBy,
  sortOrder = "desc",
  filters   = {},
} = {}) {
  const params = [];
  let   idx    = 1;

  // Search across contact email/phone and simulation fields
  const { clause: searchClause, nextIdx: afterSearch } =
    buildSearchClause(
      search,
      ["c.email", "c.phone", "sr.location", "sr.provider"],
      params,
      idx
    );
  idx = afterSearch;

  // energySource filter — simple equality on sr.energy_source
  let energyFilterClause = "";
  if (filters.energySource) {
    params.push(filters.energySource);
    energyFilterClause = `AND sr.energy_source = $${idx}`;
    idx++;
  }

  // Archived — default-excluded from the list unless explicitly
  // requested via ?archived=true. Mirrors the newsletter
  // subscribed=false soft-delete pattern: hidden by default,
  // visible on demand, never hard-deleted.
  let archivedClause = "AND sr.archived = false";
  if (filters.archived === "true") {
    archivedClause = "AND sr.archived = true";
  } else if (filters.archived === "all") {
    archivedClause = "";
  }

  const orderClause = buildOrderClause(sortBy, sortOrder, "simulatorRequests");

  params.push(limit);
  const limitIdx = idx++;
  params.push(offset);
  const offsetIdx = idx;

  const sql = `
    SELECT
      sr.id,
      sr.contact_id,
      c.email              AS contact_email,
      c.phone              AS contact_phone,
      c.verified           AS contact_verified,
      sr.housing_type,
      sr.location,
      sr.surface,
      sr.energy_source,
      sr.people_count,
      sr.provider,
      sr.annual_bill,
      sr.electricity_kwh,
      sr.gas_kwh,
      sr.estimated_monthly_savings,
      sr.created_at,
      sr.status,
      sr.contacted_at,
      sr.contacted_by,
      sr.archived,
      COUNT(*) OVER()      AS _total
    FROM simulation_requests sr
    LEFT JOIN contacts c ON c.id = sr.contact_id
    WHERE 1=1
      ${searchClause}
      ${energyFilterClause}
      ${archivedClause}
    ${orderClause}
    LIMIT  $${limitIdx}
    OFFSET $${offsetIdx}
  `;

  const result = await query(sql, params);

  const total = result.rows.length > 0
    ? parseInt(result.rows[0]._total, 10)
    : 0;

  return {
    rows:  result.rows.map(mapSimulation),
    total,
  };
}

/* ─────────────────────────────────────────────
   MARK CONTACTED  ← NEW
───────────────────────────────────────────── */

async function markContacted(id, adminEmail) {
  const result = await query(
    `
    UPDATE simulation_requests
    SET
      status       = 'contacted',
      contacted_at = NOW(),
      contacted_by = $2
    WHERE id = $1
    RETURNING *
    `,
    [id, adminEmail || null]
  );

  return mapSimulation(result.rows[0]);
}

/* ─────────────────────────────────────────────
   ARCHIVE (soft delete)  ← NEW
   Sets archived = true. Default list view
   excludes archived rows; never hard-deleted.
───────────────────────────────────────────── */

async function archiveSimulation(id) {
  const result = await query(
    `
    UPDATE simulation_requests
    SET archived = true
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return mapSimulation(result.rows[0]);
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  createSimulationRequest,
  getSimulations,
  findSimulationsPaginated,
  markContacted,         // ← new
  archiveSimulation,      // ← new
};