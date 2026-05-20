"use strict";

/**
 * middleware/loyaltySession.js
 *
 * Session-based authentication guards for loyalty routes.
 *
 * WHY SESSION COOKIES INSTEAD OF LOCALSTORAGE:
 *   localStorage is accessible by any JavaScript on the page — including
 *   injected scripts (XSS). httpOnly session cookies cannot be read by JS
 *   at all. This is the correct auth model for any system involving identity.
 *
 * The session store uses connect-sqlite3 (local file) or falls back to
 * MemoryStore in development. In production, ensure SESSION_SECRET is set.
 */

const session = require("express-session");
const { RedisStore } = require("connect-redis");
const { createClient } = require("redis");

const path = require("path");
const fs = require("fs");

/* ─────────────────────────────────────────────────────────────
   SESSION MIDDLEWARE FACTORY
   Call this once in app.js before any loyalty routes.
───────────────────────────────────────────────────────────── */
function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set in .env (min 32 chars). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  if (!process.env.UPSTASH_REDIS_URL) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env. " +
      "Get them from https://upstash.com"
    );
  }

    /* ── Upstash Redis client ── */
const redisClient = createClient({
  url: process.env.UPSTASH_REDIS_URL,
});

redisClient.connect().catch(console.error);
 
  /* ── Session store ── */
  const store = new RedisStore({
    client: redisClient,
    prefix: "mmconsulting:sess:",
    //ttl:    7 * 24 * 60 * 60, // 7 days in seconds
  });
 
 return session({
  store,
  secret,
  name: "mm.sid",

  resave: false,
  saveUninitialized: false,

  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",

    sameSite: process.env.NODE_ENV === "production"
      ? "none"
      : "lax",

    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
}

/* ─────────────────────────────────────────────────────────────
   PAGE GUARDS — redirect to login page on failure
───────────────────────────────────────────────────────────── */
function requireCustomerPage(req, res, next) {
  if (req.session?.loyaltyCustomer) return next();
  res.redirect(`/loyalty/customer/login.html?next=${encodeURIComponent(req.originalUrl)}`);
}

function requirePartnerPage(req, res, next) {
  if (req.session?.loyaltyPartner) return next();
  res.redirect(`/loyalty/partner/login.html?next=${encodeURIComponent(req.originalUrl)}`);
}

function requireAdminPage(req, res, next) {
  if (req.session?.loyaltyAdmin) return next();
  res.redirect("/loyalty/admin/login.html");
}

/* ─────────────────────────────────────────────────────────────
   API GUARDS — return JSON 401 on failure (never redirect)
   Used on all /api/loyalty/* endpoints.
───────────────────────────────────────────────────────────── */
function requireCustomerAPI(req, res, next) {
  if (req.session?.loyaltyCustomer) return next();
  res.status(401).json({ success: false, message: "Sessione scaduta. Effettua di nuovo l'accesso." });
}

function requirePartnerAPI(req, res, next) {
  if (req.session?.loyaltyPartner) return next();
  res.status(401).json({ success: false, message: "Sessione scaduta. Effettua di nuovo l'accesso." });
}

function requireAdminAPI(req, res, next) {
  if (req.session?.loyaltyAdmin) return next();
  res.status(401).json({ success: false, message: "Non autorizzato." });
}

module.exports = {
  createSessionMiddleware,
  requireCustomerAPI,
  requirePartnerAPI,
  requireAdminAPI,
  requireCustomerPage,
  requirePartnerPage,
  requireAdminPage,
};