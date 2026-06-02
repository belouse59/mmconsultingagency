"use strict";

const crypto = require("crypto");
const { query } = require("../../db");

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
  email,
  firstName,
  lastName,
  phone,
}) {
  const id =
    `contact-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

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

async function markVerified(contactId) {
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
    [contactId]
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

module.exports = {
  findById,
  findByEmail,
  createContact,
  markVerified,
  getContacts,
};