"use strict";

const { query } = require("../db");
const { makeError } = require("../utils/errorHandler");

/* ─────────────────────────────────────────────
   MAPPER
───────────────────────────────────────────── */

function mapRedemption(row) {
  return {
    id: row.id,

    customerId: row.customer_id,

    partnerId: row.partner_id,

    offerId: row.offer_id,

    usedToken: row.used_token,

    redeemedAt: row.redeemed_at,
  };
}

/* ─────────────────────────────────────────────
   CREATE
───────────────────────────────────────────── */

async function createRedemption({
  id,
  customerId,
  partnerId,
  offerId,
  token,
}) {
  try {
    const result = await query(
      `
      INSERT INTO redemptions (
        id,
        customer_id,
        partner_id,
        offer_id,
        used_token,
        redeemed_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW()
      )
      RETURNING *
      `,
      [
        id,
        customerId,
        partnerId,
        offerId,
        token,
      ]
    );

    return mapRedemption(
      result.rows[0]
    );

  } catch (err) {

    if (err.code === "23505") {
      throw makeError(
        "REDEMPTION_ALREADY_EXISTS",
        409
      );
    }

    throw err;
  }
}

/* ─────────────────────────────────────────────
   FIND BY ID
───────────────────────────────────────────── */

async function findRedemptionById(id) {

  const result = await query(
    `
    SELECT *
    FROM redemptions
    WHERE id = $1
    `,
    [id]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapRedemption(row);
}

/* ─────────────────────────────────────────────
   FIND CUSTOMER + PARTNER REDEMPTIONS
───────────────────────────────────────────── */

async function findCustomerPartnerRedemptions(
  customerId,
  partnerId
) {

  const result = await query(
    `
    SELECT *
    FROM redemptions
    WHERE customer_id = $1
      AND (partner_id = $2 OR partner_id = $3)
    `,
    [
      customerId,
      partnerId,
      "Globale"
    ]
  );

  return result.rows.map(
    mapRedemption
  );
}

/* ─────────────────────────────────────────────
   FIND REDEMPTION
   Used for existence checks
───────────────────────────────────────────── */

async function findCustomerPartnerOfferRedemption(
  customerId,
  partnerId,
  offerId
) {

  const result = await query(
    `
    SELECT *
    FROM redemptions
    WHERE customer_id = $1
      AND partner_id = $2
      AND offer_id = $3
    `,
    [
      customerId,
      partnerId,
      offerId,
    ]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapRedemption(row);
}

/* ─────────────────────────────────────────────
   FIND ALL
───────────────────────────────────────────── */

async function findRedemptions() {

  const result = await query(
    `
    SELECT *
    FROM redemptions
    ORDER BY redeemed_at DESC
    `
  );

  return result.rows.map(
    mapRedemption
  );
}

module.exports = {
  createRedemption,

  findRedemptionById,

  findCustomerPartnerRedemptions,

  findCustomerPartnerOfferRedemption,

  findRedemptions,
};