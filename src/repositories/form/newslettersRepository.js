"use strict";

const { query } = require("../../db");
const crypto = require("crypto");

function mapNewsletter(row) {
  if (!row) return null;
 
  return {
    id:              row.id,
    email:           row.email,
    subscribed:      row.subscribed,
    verified:        row.verified,
    verifiedAt:      row.verified_at,
    subscribedAt:    row.subscribed_at,
    unsubscribedAt:  row.unsubscribed_at,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

/* ─────────────────────────────────────────────
   FILTER COLUMN MAP
───────────────────────────────────────────── */
 
const NEWSLETTER_FILTER_COLUMNS = {
  subscribed: "subscribed",
  verified:   "verified",
};

async function findByEmail(email) {
    const result = await query(
        `
        SELECT *
        FROM newsletter_subscriptions
        WHERE email = $1
        LIMIT 1
        `,
        [email]
    );

    return mapNewsletter(result.rows[0]);
}

async function subscribe(id, email) {

    const result = await query(
    `
    INSERT INTO newsletter_subscriptions (
      id,
      email,
      subscribed,
      subscribed_at,
      verified,
      verified_at
    )
    VALUES (
      $1, $2, true, NOW(), false, NULL
    )
    ON CONFLICT (email)
    DO UPDATE SET
      subscribed      = true,
      subscribed_at   = NOW(),
      unsubscribed_at = NULL,
      updated_at      = NOW()
    RETURNING *
    `,
    [id, email]
  );
 
  return mapNewsletter(result.rows[0]);
}

async function unsubscribe(contactId) {

    const result = await query(
        `
        UPDATE newsletter_subscriptions
        SET
            subscribed = false,
            unsubscribed_at = NOW(),
            updated_at = NOW()
        WHERE email = $1
        RETURNING *
        `,
        [contactId]
    );

    return mapNewsletter(result.rows[0]);
}

async function markVerified(id) {
  const result = await query(
    `
    UPDATE newsletter_subscriptions
    SET
      verified = true,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return mapNewsletter(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND PAGINATED  ← NEW
   Admin-only. Postgres only.
   Search: email.
   Filters: subscribed, verified.
 
   @param {{
     offset:    number,
     limit:     number,
     search:    string,
     sortBy:    string | undefined,
     sortOrder: 'asc' | 'desc',
     filters:   { subscribed?: string, verified?: string }
   }} opts
───────────────────────────────────────────── */
 
async function findNewslettersPaginated({
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
    buildSearchClause(search, ["email"], params, idx);
  idx = afterSearch;
 
  const { clause: filterClause, nextIdx: afterFilter } =
    buildFilterClause(filters, NEWSLETTER_FILTER_COLUMNS, params, idx);
  idx = afterFilter;
 
  const orderClause = buildOrderClause(sortBy, sortOrder, "newsletters");
 
  params.push(limit);
  const limitIdx = idx++;
  params.push(offset);
  const offsetIdx = idx;
 
  const sql = `
    SELECT
      id,
      email,
      subscribed,
      verified,
      verified_at,
      subscribed_at,
      unsubscribed_at,
      created_at,
      updated_at,
      COUNT(*) OVER() AS _total
    FROM newsletter_subscriptions
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
    rows:  result.rows.map(mapNewsletter),
    total,
  };
}
 
/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
 
module.exports = {
  findByEmail,
  subscribe,
  unsubscribe,
  markVerified,
  findNewslettersPaginated, 
};