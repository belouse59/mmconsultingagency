"use strict";

const { query } =
    require("../../db");

const { paginate } =
    require("../paginationHelper");

const {
    appendRow,
    getSheetValues,
} =
    require("../../services/sheetsService");

const SHEET = {
    CUSTOMERS:
        "Customers",
};

const ENABLE_SHEETS_FALLBACK =
    process.env
        .ENABLE_SHEETS_FALLBACK
    === "true";

/* ───────────────────────────────────────────── */

function mapCustomer(row) {
    if (!row)
        return null;

    return {
        id: row.id,
        full_name: row.full_name,
        identifier: row.identifier,
        identifierType: row.identifier_type,
        password: row.password_hash,
        active: row.active,
        createdAt: row.created_at,
        verified: row.verified,
        verifiedAt: row.verified_at
    };

}

/* ───────────────────────────────────────────── */

async function createCustomer({ id, full_name, identifier, identifierType, password, active }) {

    const result =
        await query(
            `
 INSERT INTO customers
 (
  id,
  full_name,
  identifier,
  identifier_type,
  password_hash,
  active
 )

 VALUES
 (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6
 )

 RETURNING
 id,
 full_name,
 identifier,
 identifier_type,
 password_hash,
 active,
 created_at,
 verified
 `,
            [
                id,
                full_name,
                identifier,
                identifierType,
                password,
                active,
            ]
        );

    const customer = mapCustomer(result.rows[0]);
    syncCustomerToSheets(customer);
    return customer;

}

/* ───────────────────────────────────────────── */

async function markVerified(id) {
  const result = await query(
    `
    UPDATE customers
    SET
      verified = true,
      active = true,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return mapCustomer(result.rows[0]);
}

/* ───────────────────────────────────────────── */
async function updatePassword(data) {
    const id = data.customerId;
    const password_hash = data.passwordHash
  const result = await query(
    `
    UPDATE customers
    SET
      password_hash = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, password_hash]
  );

  return mapCustomer(result.rows[0]);
}

/* ───────────────────────────────────────────── */

// async function findCustomers() {
//     try {
//         const result = await query(
//             `
//  SELECT
//  id,
//  full_name,
//  identifier,
//  identifier_type,
//  password_hash,
//  active,
//  created_at

//  FROM customers

//  ORDER BY
//  created_at DESC
//  `
//         );

//         return result
//             .rows
//             .map(mapCustomer);

//     }

//     catch (err) {

//         if (
//             !ENABLE_SHEETS_FALLBACK
//         ) {

//             throw err;

//         }

//         const rows =
//             await getSheetValues(
//                 SHEET.CUSTOMERS
//             );

//         return rows
//             .slice(1)
//             .map(mapSheetCustomer);

//     }

// }

async function findCustomers(options) {
    try {
        return paginate({
            table: "customers",
            mapper: mapCustomer,
            ...options
        })
    } catch(err) {
        console.error("[offerRepo] Postgres failed, fallback Sheets:", err.message);
    }
}

/* ───────────────────────────────────────────── */

async function findCustomerByIdentifier(
    identifier
) {

    const result = await query(
        `
 SELECT
 id,
 full_name,
 identifier,
 identifier_type,
 password_hash,
 active,
 created_at,
 verified,
 verified_at

 FROM customers

 WHERE identifier=$1

 LIMIT 1
 `,
        [
            identifier
        ]
    );

    return mapCustomer(result.rows[0]);

}

async function findCustomerById(
    id
) {

    const result = await query(
        `
 SELECT
 id,
 full_name,
 identifier,
 identifier_type,
 password_hash,
 active,
 created_at

 FROM customers

 WHERE id=$1

 LIMIT 1
 `,
        [
            id
        ]
    );

    return mapCustomer(result.rows[0]);

}

/* ───────────────────────────────────────────── */

async function findActiveCustomers() {
    const result = await query(
        `
 SELECT
 id,
 full_name,
 identifier,
 identifier_type,
 password_hash,
 active,
 created_at

 FROM customers

 WHERE active=true
 `
    );
    return result.rows.map(mapCustomer);

}

/* ───────────────────────────────────────────── */

function mapSheetCustomer(
    r
) {

    return {
        id: r[0],
        full_name: r[1],
        identifier: r[2],
        identifierType: r[3],
        password: r[4],
        active: r[5] === "true",
        createdAt: r[6],
    };

}

/* ───────────────────────────────────────────── */

function syncCustomerToSheets(
    customer
) {

    if (
        !ENABLE_SHEETS_FALLBACK
    ) {

        return;

    }

    appendRow(
        SHEET.CUSTOMERS,
        [
            customer.id,
            customer.full_name,
            customer.identifier,
            customer.identifierType,
            customer.password,
            String(customer.active),
            customer.createdAt,
        ]

    ).catch(
        err => {

            console.error(
                "[Sheets Sync]",
                err
            );

        });

}

/* ───────────────────────────────────────────── */

module.exports = {
    createCustomer,
    markVerified,
    updatePassword,
    findCustomers,
    findCustomerByIdentifier,
    findCustomerById,
    findActiveCustomers,
};