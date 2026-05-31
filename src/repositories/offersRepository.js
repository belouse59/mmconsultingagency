"use strict"

const { appendRow, getSheetValues } = require ("../services/sheetsService");
const { query }                     = require ("../db");
const { makeError }                 = require ("../utils/errorHandler");
const SHEET = {
  CUSTOMERS:   "Customers",
  REDEMPTIONS: "Redemptions",
  OFFERS:      "Offers",
};
const crypto = require("crypto");


async function getOffers() {
  try {
    /* ─────────────────────────────────────────────
       1. READ FROM POSTGRES (PRIMARY SOURCE)
    ───────────────────────────────────────────── */
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

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || "",
      partnerId: row.partner_id,
      active: row.active,
      createdAt: row.created_at,
    }));

  } catch (err) {
    console.error(
      "[readOffers] Postgres failed, falling back to Sheets:",
      err.message
    );

    /* ─────────────────────────────────────────────
       2. FALLBACK TO GOOGLE SHEETS
       Temporary migration safety
    ───────────────────────────────────────────── */
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

async function getActiveOffers() {
  const activeOffers = await query(
        `SELECT *
         FROM offers 
         WHERE active = $1`,
        [true]
      );
      return activeOffers;
}
 
async function getPartnerOffers(partnerId) {
  const offers = await query(
        `SELECT *
         FROM offers 
         WHERE (partner_id = $1 OR partner_id = $2) AND active = $3)`,
        [partnerId, "Globale", true]
      );
      return offers;
}

async function createOffer({ title, description, partnerId }) {
  if (!title?.trim()) {
    throw makeError("Il titolo dell'offerta è obbligatorio.", 400);
  }

  const id = `offer-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const nowIso = new Date().toISOString();
 
    /* ─────────────────────────────────────────────
     1. WRITE TO POSTGRES (SOURCE OF TRUTH)
  ───────────────────────────────────────────── */
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
    [
      id,
      title,
      description,
      partnerId,
      true,
    ]
  );
  /* ─────────────────────────────────────────────
     2. WRITE TO GOOGLE SHEETS (LEGACY SYNC)
     Do NOT block main flow if it fails
  ───────────────────────────────────────────── */
  await appendRow(SHEET.OFFERS, [
    id,
    title,
    description,
    partnerId,
    "true",
    nowIso,
  ]);
 
  return {
    success: true,
    offer:   { id, title: title, description: description, partnerId: partnerId, active: true, createdAt: nowIso },
  };
}

async function updateOffers(id, newValues) {
    console.log(id, newValues);
    return true;
}

module.exports = { getOffers, createOffer, getActiveOffers, getPartnerOffers, updateOffers };