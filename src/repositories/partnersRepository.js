"use strict"

const { appendRow, getSheetValues } = require("../services/sheetsService");
const { query } = require("../db");
const { makeError } = require("../utils/errorHandler");

async function createPartner(cleanId, name, category, address, hash) {

    try {
        let result = await query(
            `
    INSERT INTO partners (
      id,
      name,
      category,
      address,
      password_hash,
      must_change_password,
      active,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `,
            [
                cleanId,
                name,
                category,
                address,
                hash,
                true,
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
        cleanId,
        name: name,
    };
}

async function findPartners() {
    try {
        /* ─────────────────────────────────────────────
       1. READ FROM POSTGRES (PRIMARY SOURCE)
    ───────────────────────────────────────────── */
        const result = await query(`
      SELECT
        id,
        name,
        category,
        address,
        password_hash,
        must_change_password,
        active,
        created_at
      FROM partners
      ORDER BY created_at DESC
    `);
    return result;

    } catch (err) {
        console.error(
            "[readCustomers] Postgres failed, falling back to Sheets:",
            err.message
        );
    }
}

async function findPartnerById(id) {
    try {
        /* ─────────────────────────────────────────────
       1. READ FROM POSTGRES (PRIMARY SOURCE)
    ───────────────────────────────────────────── */
        return await query(
            `SELECT * FROM partners WHERE id = $1`,
            [id]
        );


    } catch (err) {
        console.error(
            "[readPartner] Postgres failed, falling back to Sheets:",
            err.message
        );
    }
}

async function updatePartnerById(id, newValues) {
    const fields = Object.keys(newValues);

    if (fields.length === 0) {
        throw new Error("No fields provided for update");
    }

    const setClause = fields
        .map((field, index) => `${field} = $${index + 1}`)
        .join(", ");

    const values = fields.map((field) => newValues[field]);

    const querySQL = `
    UPDATE partners
    SET ${setClause}
    WHERE id = $${fields.length + 1}
    RETURNING *;
  `;

    const result = await query(querySQL, [...values, id]);

    return result.rows[0];
}

module.exports = {
    createPartner, findPartners, findPartnerById, updatePartnerById
}