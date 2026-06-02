"use strict";

const { query } = require("../../db");
const crypto = require("crypto");

function mapNewsletter(row) {
    if (!row) return null;

    return {
        id: row.id,
        email: row.email,
        subscribed: row.subscribed,
        subscribedAt: row.subscribed_at,
        unsubscribedAt: row.unsubscribed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function findByContactId(contactId) {
    const result = await query(
        `
        SELECT *
        FROM newsletter_subscriptions
        WHERE email = $1
        LIMIT 1
        `,
        [contactId]
    );

    return mapNewsletter(result.rows[0]);
}

async function subscribe(email) {
      const id =
        `request-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const result = await query(
        `
        INSERT INTO newsletter_subscriptions (
            id,
            email,
            subscribed,
            subscribed_at
        )
        VALUES (
            $1,
            $2,
            true,
            NOW()
        )
        ON CONFLICT (email)
        DO UPDATE SET
            subscribed = true,
            subscribed_at = NOW(),
            unsubscribed_at = NULL,
            updated_at = NOW()
        RETURNING *
        `,
        [id, email]
    );

    return mapNewsletter(result.rows[0]);
}

async function unsubscribe(contactId) {

    const result = await query(
        `
        UPDATE newsletter_subscriptions
        SET
            subscribed = false,
            unsubscribed_at = NOW(),
            updated_at = NOW()
        WHERE email = $1
        RETURNING *
        `,
        [contactId]
    );

    return mapNewsletter(result.rows[0]);
}

module.exports = {
    findByContactId,
    subscribe,
    unsubscribe,
};