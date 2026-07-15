"use strict";

const crypto = require("crypto");
const { query } = require("../../db");

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapContactRequest(row) {
  if (!row) return null;

  return {
    id:                    row.id,
    contactId:             row.contact_id,
    source:                row.source,
    category:              row.category,
    preferredContactTime:  row.preferred_contact_time,
    message:               row.message,
    consent:               row.consent,
    status:                row.status      || "new",
    contactedAt:           row.contacted_at || null,
    contactedBy:           row.contacted_by || null,
    createdAt:             row.created_at,
  };
}

/* ─────────────────────────────────────────────
   CREATE (unchanged from previous version)
───────────────────────────────────────────── */

async function createContactRequest({
  contactId,
  source,
  category,
  preferredContactTime,
  message,
  consent,
}) {
  const id =
    `request-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const result = await query(
    `
    INSERT INTO contact_requests (
      id,
      contact_id,
      source,
      category,
      preferred_contact_time,
      message,
      consent,
      status
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, 'new'
    )
    RETURNING *
    `,
    [
      id,
      contactId,
      source      || null,
      category    || null,
      preferredContactTime,
      message,
      consent,
    ]
  );

  return mapContactRequest(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND BY ID (unchanged)
───────────────────────────────────────────── */

async function findById(id) {
  const result = await query(
    `
    SELECT *
    FROM contact_requests
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return mapContactRequest(result.rows[0]);
}

/* ─────────────────────────────────────────────
   FIND BY CONTACT ID (unchanged)
───────────────────────────────────────────── */

async function findByContactId(contactId) {
  const result = await query(
    `
    SELECT *
    FROM contact_requests
    WHERE contact_id = $1
    ORDER BY created_at DESC
    `,
    [contactId]
  );

  return result.rows.map(mapContactRequest);
}

/* ─────────────────────────────────────────────
   FIND LATEST BY CONTACT ID  ← NEW

   Used by verificationService when a contact clicks
   their verification link. At that point we have the
   contact's email (from the token) but not which
   submission triggered it — this recovers the most
   recent contact_request for that contact so
   notifyNewLead can show what they actually asked
   about (message, category, source) instead of just
   the bare email address.

   If the contact submitted the form multiple times
   before verifying, this intentionally returns only
   the latest one — one verification event produces
   one notification, referencing the most recent inquiry.

   @param {string} contactId
   @returns {ContactRequest|null}
───────────────────────────────────────────── */

async function findLatestByContactId(contactId) {
  const result = await query(
    `
    SELECT *
    FROM contact_requests
    WHERE contact_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [contactId]
  );

  return mapContactRequest(result.rows[0]);
}

/* ─────────────────────────────────────────────
   GET ALL (unchanged)
───────────────────────────────────────────── */

async function getContactRequests() {
  const result = await query(
    `
    SELECT *
    FROM contact_requests
    ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapContactRequest);
}

/* ─────────────────────────────────────────────
   MARK CONTACTED  ← NEW
───────────────────────────────────────────── */

async function markContacted(id, adminEmail) {
  const result = await query(
    `
    UPDATE contact_requests
    SET
      status       = 'contacted',
      contacted_at = NOW(),
      contacted_by = $2
    WHERE id = $1
    RETURNING *
    `,
    [id, adminEmail || null]
  );

  return mapContactRequest(result.rows[0]);
}

/* ─────────────────────────────────────────────
   ARCHIVE  ← NEW
───────────────────────────────────────────── */

async function archiveContactRequest(id) {
  const result = await query(
    `
    UPDATE contact_requests
    SET status = 'archived'
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return mapContactRequest(result.rows[0]);
}


/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  createContactRequest,
  findById,
  findByContactId,
  findLatestByContactId,
  getContactRequests,
  markContacted,           // ← new
  archiveContactRequest,   // ← new
};