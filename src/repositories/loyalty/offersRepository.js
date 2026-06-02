"use strict";

const { query } = require("../../db");
const { makeError } = require("../../utils/errorHandler");
const { appendRow, getSheetValues } = require("../../services/sheetsService");

const SHEET = {
  OFFERS: "Offers",
};

async function findOffers() {
  try {
    const result = await query(`
      SELECT
        id,
        title,
        description,
        partner_id,
        active,
        created_at
      FROM offers
      ORDER BY created_at DESC
    `);

    return result.rows.map(mapOffer);
  } catch (err) {
    console.error("[offerRepo] Postgres failed, fallback Sheets:", err.message);

    const rows = await getSheetValues(SHEET.OFFERS);

    return rows.slice(1).map((r) => ({
      id: r[0],
      title: r[1],
      description: r[2],
      partnerId: r[3],
      active: r[4] === "true" || r[4] === "TRUE",
      createdAt: r[5],
    }));
  }
}

/* ─────────────────────────────────────────────
   ACTIVE OFFERS
───────────────────────────────────────────── */
async function findActiveOffers() {
  const result = await query(
    `
    SELECT
      id,
      title,
      description,
      partner_id,
      active,
      created_at
    FROM offers
    WHERE active = $1
    ORDER BY created_at DESC
    `,
    [true]
  );

  return result.rows.map(mapOffer);
}

/* ─────────────────────────────────────────────
   OFFERS BY PARTNER
───────────────────────────────────────────── */
async function findActiveOffersByPartner(partnerId) {
  const result = await query(
    `
    SELECT
      id,
      title,
      description,
      partner_id,
      active,
      created_at
    FROM offers
    WHERE (partner_id = $1 OR partner_id = $2)
      AND active = $3
    ORDER BY created_at DESC
    `,
    [partnerId, "Globale", true]
  );

  return result.rows.map(mapOffer);
}

/* ─────────────────────────────────────────────
   ACTIVE OFFERS
───────────────────────────────────────────── */
async function findActiveOfferById(id) {
  const result = await query(
    `
    SELECT
      id,
      title,
      description,
      partner_id,
      active,
      created_at
    FROM offers
    WHERE id = $1
    AND active = $2
    `,
    [id, true]
  );

  const offer = result.rows.map(mapOffer);
  
  return offer.length ? offer[0] : [];
}

/* ─────────────────────────────────────────────
   CREATE OFFER
───────────────────────────────────────────── */
async function createOffer({ id, title, description, partnerId }) {
  if (!title?.trim()) {
    throw makeError("Il titolo è obbligatorio.", 400);
  }

  await query(
    `
    INSERT INTO offers (
      id,
      title,
      description,
      partner_id,
      active,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    `,
    [id, title, description || "", partnerId, true]
  );

  try {
    await appendRow(SHEET.OFFERS, [
      id,
      title,
      description || "",
      partnerId,
      "true",
      new Date().toISOString(),
    ]);
  } catch (err) {
    console.error("[offerRepo] Sheet sync failed:", err.message);
  }

  return mapOffer({
    id,
    title,
    description,
    partner_id: partnerId,
    active: true,
    created_at: new Date(),
  });
}

/* ─────────────────────────────────────────────
   MAPPER (IMPORTANT CONSISTENCY FIX)
───────────────────────────────────────────── */
function mapOffer(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    partnerId: row.partner_id,
    active: row.active,
    createdAt: row.created_at,
  };
}

module.exports = {
  findOffers,
  findActiveOffers,
  findActiveOffersByPartner,
  findActiveOfferById,
  createOffer,
};