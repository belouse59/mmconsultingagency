"use strict";

/**
 * middleware/loyaltySession.js
 *
 * API-only guards — always return JSON, never redirect.
 * Page-level auth is handled by the inline <script> guard
 * in each HTML file, which fires before any DOM paint.
 *
 * mustChangePassword:
 *   Partners created by admin have this flag set to true.
 *   requirePartnerAPI blocks all partner endpoints except
 *   /set-password with a 403 MUST_CHANGE_PASSWORD code.
 *   requirePartnerAnyAPI is used only on the set-password route.
 *
 * CSRF:
 *   State-mutating endpoints check for X-Requested-With header.
 *   This is a lightweight CSRF mitigation layer that works
 *   alongside SameSite=Lax cookies without requiring token rotation.
 */

const session = require("express-session");
const { RedisStore } = require("connect-redis");

const {
  redisClient,
  connectRedis,
} = require("../utils/redis");

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
      "UPSTASH_REDIS_URL must be set in .env."
    );
  }

  connectRedis().catch((err) => {
    console.error("[redis connect]", err);
  });

  const store = new RedisStore({
    client: redisClient,
    prefix: "mmconsulting:sess:",
  });

  return session({
    store,
    secret,

    name: "mm.sid",

    resave: false,
    saveUninitialized: false,

    rolling: true,

    unset: "destroy",

    cookie: {
      httpOnly: true,

      secure: process.env.NODE_ENV === "production",

      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",

      maxAge: 7 * 24 * 60 * 60 * 1000,

      path: "/",
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
/* ── Customer API guard ── */
function requireCustomerAPI(req, res, next) {
  if (req.session?.loyaltyCustomer) return next();
  res.status(401).json({ success: false, message: "Sessione scaduta. Effettua di nuovo l'accesso." });
}

/* ── Partner API guard — blocks if mustChangePassword ── */
function requirePartnerAPI(req, res, next) {
  if (!req.session?.loyaltyPartner) {
    return res.status(401).json({ success: false, message: "Sessione scaduta. Accedi di nuovo." });
  }
  if (req.session.loyaltyPartner.mustChangePassword) {
    return res.status(403).json({
      success: false,
      code:    "MUST_CHANGE_PASSWORD",
      message: "Devi impostare una nuova password prima di continuare.",
    });
  }
  return next();
}

/* ── Partner API guard — allows even if mustChangePassword ── */
/* Used exclusively on POST /api/loyalty/partner/set-password   */
function requirePartnerAnyAPI(req, res, next) {
  if (!req.session?.loyaltyPartner) {
    return res.status(401).json({ success: false, message: "Sessione scaduta. Accedi di nuovo." });
  }
  return next();
}

/* ── Admin API guard ── */
function requireAdminAPI(req, res, next) {
  if (req.session?.loyaltyAdmin) return next();
  res.status(401).json({ success: false, message: "Non autorizzato." });
}

/* ── CSRF guard ──
   Applied to all state-mutating endpoints (POST that are not login/logout).
   Browsers never send X-Requested-With on cross-origin requests
   unless the server explicitly allows it via CORS — which we do not.
   This provides meaningful protection without full CSRF token rotation. */
function requireXHR(req, res, next) {
  const header = req.headers["x-requested-with"];
  if (!header || header.toLowerCase() !== "xmlhttprequest") {
    return res.status(403).json({ success: false, message: "Richiesta non autorizzata." });
  }
  return next();
}

module.exports = {
  createSessionMiddleware,
  requireCustomerAPI,
  requirePartnerAPI,
  requirePartnerAnyAPI,
  requireAdminAPI,
  requireXHR
  //requireCustomerPage,
  //requirePartnerPage,
  //requireAdminPage,
};