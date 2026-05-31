const { appendRow, getSheetValues } = require ("../services/sheetsService");
const { query }                        = require ("../db");
const { makeError }                 = require ("../utils/errorHandler");

async function getRedemptions() {
  try {
    /* ─────────────────────────────────────────────
       1. READ FROM POSTGRES (PRIMARY SOURCE)
    ───────────────────────────────────────────── */
    const result = await query(`
      SELECT
        id,
        customer_id,
        partner_id,
        offer_id,
        redeemed_at
      FROM redemptions
      ORDER BY redeemed_at DESC
    `);

    return result.rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      partnerId: row.partner_id,
      offerId: row.offer_id,

      /* legacy compatibility */
      usedToken: null,

      /* legacy compatibility */
      date: row.redeemed_at
        ? new Date(row.redeemed_at).toISOString().slice(0, 10)
        : null,

      createdAt: row.redeemed_at,
    }));

  } catch (err) {
    console.error(
      "[readRedemptions] Postgres failed, falling back to Sheets:",
      err.message
    );

    /* ─────────────────────────────────────────────
       2. FALLBACK TO GOOGLE SHEETS
    ───────────────────────────────────────────── */
    const rows = await getSheetValues(SHEET.REDEMPTIONS);

    return rows.slice(1).map((r) => ({
      id: r[0],
      customerId: r[1],
      partnerId: r[2],
      offerId: r[3],
      usedToken: r[4],
      date: r[5],
      createdAt: r[6],
    }));
  }
}

module.exports = { getRedemptions };