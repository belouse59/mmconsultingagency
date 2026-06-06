"use strict";

const { query } =
  require("../../db");

/* ─────────────────────────────────────────────
   TABLE NAME
───────────────────────────────────────────── */

const TABLE =
  "loyalty_customer_password_resets";

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapPasswordReset(row) {

  if (!row)
    return null;

  return {
    id: row.password_reset_id,
    customerId: row.customer_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };

}

/* ─────────────────────────────────────────────
   CREATE RESET TOKEN
───────────────────────────────────────────── */

async function createPasswordReset({
  id,
  customerId,
  tokenHash,
  expiresAt,
}) {

  const result =
    await query(
      `
            INSERT INTO loyalty_customer_password_resets
            (
                password_reset_id,
                customer_id,
                token_hash,
                expires_at
            )
            VALUES
            ($1, $2, $3, $4)
            RETURNING
                password_reset_id,
                customer_id,
                token_hash,
                expires_at,
                used_at,
                created_at
            `,
      [
        id,
        customerId,
        tokenHash,
        expiresAt,
      ]
    );

  return mapPasswordReset(result.rows[0]);

}

/* ─────────────────────────────────────────────
   FIND BY TOKEN HASH
───────────────────────────────────────────── */

async function findByTokenHash(tokenHash) {

  const result =
    await query(
      `
            SELECT
                password_reset_id,
                customer_id,
                token_hash,
                expires_at,
                used_at,
                created_at
            FROM loyalty_customer_password_resets
            WHERE token_hash = $1
            LIMIT 1
            `,
      [
        tokenHash,
      ]
    );

  return mapPasswordReset(result.rows[0]);

}

/* ─────────────────────────────────────────────
   MARK USED
───────────────────────────────────────────── */

async function markUsed(id) {

  const result =
    await query(
      `
            UPDATE loyalty_customer_password_resets
            SET used_at = NOW()
            WHERE password_reset_id = $1
            RETURNING
                password_reset_id,
                customer_id,
                token_hash,
                expires_at,
                used_at,
                created_at
            `,
      [
        id,
      ]
    );

  return mapPasswordReset(result.rows[0]);

}

/* ─────────────────────────────────────────────
   INVALIDATE OLD TOKENS
───────────────────────────────────────────── */

async function invalidateCustomerTokens(customerId) {

  await query(
    `
        UPDATE loyalty_customer_password_resets
        SET used_at = NOW()
        WHERE customer_id = $1
          AND used_at IS NULL
        `,
    [
      customerId,
    ]
  );

}

/* ───────────────────────────────────────────── */

module.exports = {
  createPasswordReset,
  findByTokenHash,
  markUsed,
  invalidateCustomerTokens,
};