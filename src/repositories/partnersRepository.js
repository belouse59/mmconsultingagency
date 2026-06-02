"use strict";

const {
  query,
} =
  require("../db");

/* ─────────────────────────────────────────────
   MAPPERS
───────────────────────────────────────────── */

function mapPartner(
  row
) {

  if (
    !row
  ) {
    return null;
  }

  return {

    id:
      row.id,

    name:
      row.name,

    category:
      row.category,

    address:
      row.address,

    passwordHash:
      row.password_hash,

    mustChangePassword:
      Boolean(
        row.must_change_password
      ),

    active:
      Boolean(
        row.active
      ),

    createdAt:
      row.created_at,

  };

}

/* ─────────────────────────────────────────────
   CREATE
───────────────────────────────────────────── */

async function createPartner({

  id,

  name,

  category,

  address,

  passwordHash,

}) {

  const result =
    await query(

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

      VALUES (

        $1,
        $2,
        $3,
        $4,
        $5,
        TRUE,
        TRUE,
        NOW()

      )

      RETURNING *
      `,

      [

        id,

        name,

        category,

        address,

        passwordHash,

      ]

    );

  return mapPartner(
    result.rows[0]
  );

}

/* ─────────────────────────────────────────────
   READ ALL
───────────────────────────────────────────── */

async function findPartners() {

  const result =
    await query(

      `
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

      ORDER BY
        created_at DESC
      `
    );

  return result.rows.map(
    mapPartner
  );

}

/* ─────────────────────────────────────────────
   READ ONE
───────────────────────────────────────────── */

async function findPartnerById(
  id
) {

  const result =
    await query(

      `
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

      WHERE id = $1
      `,

      [
        id
      ]

    );

  return mapPartner(
    result.rows[0]
  );

}

/* ─────────────────────────────────────────────
   PASSWORD UPDATE
───────────────────────────────────────────── */

async function updatePartnerPassword({

  partnerId,

  passwordHash,

  mustChangePassword,

}) {

  const result =
    await query(

      `
      UPDATE partners

      SET

        password_hash = $1,

        must_change_password = $2

      WHERE id = $3

      RETURNING *
      `,

      [

        passwordHash,

        mustChangePassword,

        partnerId,

      ]

    );

  return mapPartner(
    result.rows[0]
  );

}

/* ─────────────────────────────────────────────
   ACTIVE UPDATE
───────────────────────────────────────────── */

async function setPartnerActive(

  partnerId,

  active

) {

  const result =
    await query(

      `
      UPDATE partners

      SET
        active = $1

      WHERE id = $2

      RETURNING *
      `,

      [

        active,

        partnerId,

      ]

    );

  return mapPartner(
    result.rows[0]
  );

}

/* ───────────────────────────────────────────── */

module.exports = {

  createPartner,

  findPartners,

  findPartnerById,

  updatePartnerPassword,

  setPartnerActive,

};