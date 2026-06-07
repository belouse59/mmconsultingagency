"use strict";

const { query } =
  require("../../db");

/* ─────────────────────────────────────────────
   TABLE NAME
───────────────────────────────────────────── */

const TABLE =
  "loyalty_user_password_resets";

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapPasswordReset(row) {

  if (!row)
    return null;

  return {
    id: row.password_reset_id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
    type: row.type
  };

}

/* ─────────────────────────────────────────────
   CREATE RESET TOKEN
───────────────────────────────────────────── */

async function createPasswordReset({
  id,
  userId,
  tokenHash,
  expiresAt,
  origin
}) {

  const result =
    await query(
      `
            INSERT INTO loyalty_password_resets
            (
                password_reset_id,
                user_id,
                token_hash,
                expires_at,
                type
            )
            VALUES
            ($1, $2, $3, $4, $5)
            RETURNING
                password_reset_id,
                user_id,
                token_hash,
                expires_at,
                used_at,
                created_at,
                type
            `,
      [
        id,
        userId,
        tokenHash,
        expiresAt,
        origin
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
                user_id,
                token_hash,
                expires_at,
                used_at,
                created_at,
                type
            FROM loyalty_password_resets
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
            UPDATE loyalty_password_resets
            SET used_at = NOW()
            WHERE password_reset_id = $1
            RETURNING
                password_reset_id,
                user_id,
                token_hash,
                expires_at,
                used_at,
                created_at,
                type
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

async function invalidateUserTokens(userId) {

  await query(
    `
        UPDATE loyalty_password_resets
        SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
        `,
    [
      userId,
    ]
  );

}

/* ───────────────────────────────────────────── */

module.exports = {
  createPasswordReset,
  findByTokenHash,
  markUsed,
  invalidateUserTokens,
};