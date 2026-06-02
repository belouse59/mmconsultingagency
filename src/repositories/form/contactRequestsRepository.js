"use strict";

const crypto = require("crypto");
const { query } = require("../../db");

function mapContactRequest(row) {
  if (!row) return null;

  return {
    id: row.id,
    contactId: row.contact_id,
    energyType: row.energy_type,
    preferredContactTime: row.preferred_contact_time,
    message: row.message,
    consent: row.consent,
    createdAt: row.created_at,
  };
}

async function createContactRequest({
  contactId,
  energyType,
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
      energy_type,
      preferred_contact_time,
      message,
      consent
    )
    VALUES (
      $1,$2,$3,$4,$5,$6
    )
    RETURNING *
    `,
    [
      id,
      contactId,
      energyType,
      preferredContactTime,
      message,
      consent,
    ]
  );

  return mapContactRequest(result.rows[0]);
}

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

module.exports = {
  createContactRequest,
  findById,
  findByContactId,
  getContactRequests,
};