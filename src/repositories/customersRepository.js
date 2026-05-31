"use strict"

const { appendRow, getSheetValues } = require ("../services/sheetsService");
const { query }                        = require ("../db");
const { makeError }                 = require ("../utils/errorHandler");
const SHEET = {
  CUSTOMERS:   "Customers",
  REDEMPTIONS: "Redemptions",
  OFFERS:      "Offers",
};
/**
 * Read customers from Supabase/Postgres.
 * Keeps Google Sheets as temporary fallback during migration.
 */

/* ─────────────────────────────────────────────
   1. INSERT (DB IS SOURCE OF TRUTH)
   Handles race conditions via UNIQUE constraint
───────────────────────────────────────────── */
async function createCustomer() {

    try {
        await query(
            `
              INSERT INTO customers (
                id,
        full_name,
        identifier,
        identifier_type,
        password_hash,
        active,
        created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
            [
                customerId,
                clean(full_name),
                normalized,
                identifierType,
                hash,
                true,
            ]
        );
    } catch (err) {
        /* Unique violation = already exists */
        if (err.code === "23505") {
            throw makeError(
                "Registrazione non possibile. Contatta il supporto.",
                409
            );
        }
        throw err;
    }
    return {
        success: true,
        customerId,
        full_name: clean(full_name),
    };
    /* ─────────────────────────────────────────────
       2. OPTIONAL: SHEETS SYNC (LEGACY)
       Non-blocking, can be removed later
    ───────────────────────────────────────────── */
    appendRow(SHEET.CUSTOMERS, [
        customerId,
        clean(full_name),
        normalized,
        identifierType,
        hash,
        "true",
        nowIso,
    ]).catch((err) => {
        console.error("[register] Sheets sync failed:", err.message);
    });
}

async function findCustomers() {
    try {
        /* ─────────────────────────────────────────────
       1. READ FROM POSTGRES (PRIMARY SOURCE)
    ───────────────────────────────────────────── */
        const result = await query(`
      SELECT
        id,
        full_name,
        identifier,
        identifier_type,
        password_hash,
        active,
        created_at
      FROM customers
      ORDER BY created_at DESC
    `);

        return result.rows.map((row) => ({
            id: row.id,
            full_name: row.full_name,
            identifier: row.identifier,
            identifierType: row.identifier_type,
            passwordHash: row.password_hash,
            active: row.active,
            createdAt: row.created_at,
        }));

    } catch (err) {
        console.error(
            "[readCustomers] Postgres failed, falling back to Sheets:",
            err.message
        );

        /* ─────────────────────────────────────────────
           2. FALLBACK TO GOOGLE SHEETS
        ───────────────────────────────────────────── */
        const rows = await getSheetValues(SHEET.CUSTOMERS);

        return rows.slice(1).map((r) => ({
            id: r[0],
            full_name: r[1],
            identifier: r[2],
            identifierType: r[3],
            passwordHash: r[4],
            active: r[5] === "true" || r[5] === "TRUE",
            createdAt: r[6],
        }));
    }
}

async function findCustomerByIdentifier(identifier) {
    try {
        /* ─────────────────────────────────────────────
       1. READ FROM POSTGRES (PRIMARY SOURCE)
    ───────────────────────────────────────────── */
        const result = await query(`
      SELECT
        id,
        full_name,
        identifier,
        identifier_type,
        password_hash,
        active,
        created_at
      FROM customers
      WHERE identifier = $1 
    `, [identifier]
        );

        const row = result.rows[0];

        if (!row) return null;

        return {
            id: row.id,
            full_name: row.full_name,
            identifier: row.identifier,
            identifierType: row.identifier_type,
            passwordHash: row.password_hash,
            active: row.active,
            createdAt: row.created_at,
        };

    } catch (err) {
        console.error(
            "[readCustomers] Postgres failed, falling back to Sheets:",
            err.message
        );

        /* ─────────────────────────────────────────────
           2. FALLBACK TO GOOGLE SHEETS
        ───────────────────────────────────────────── */
        const row = rows.slice(1).find(r => r[2] === identifier);

        if (!row) return null;

        return {
            id: row[0],
            full_name: row[1],
            identifier: row[2],
            identifierType: row[3],
            passwordHash: row[4],
            active: row[5] === "true" || row[5] === "TRUE",
            createdAt: row[6],
        };
    }
}

async function findActiveCustomers() {
    await query(
        `SELECT *
        FROM customers
        WHERE active = $1`,
        [true]
    );
}

module.exports = {
createCustomer, findCustomers, findCustomerByIdentifier, findActiveCustomers
}

