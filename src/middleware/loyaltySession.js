"use strict";
 
/**
 * middleware/loyaltyGuards.js
 *
 * TWO LAYERS OF PROTECTION:
 *
 * 1. PAGE GUARDS (requireCustomerPage, requirePartnerPage, etc.)
 *    Used on explicit Express GET routes registered BEFORE express.static().
 *    The server checks the session and either:
 *      - Calls next() so the route handler serves the HTML file
 *      - Redirects to login — the protected HTML is NEVER sent to the client
 *    This means zero skeleton flash by design: unauthenticated users never
 *    receive the page HTML at all, so there is nothing to flash.
 *    No inline <script> needed in any HTML file.
 *
 * 2. API GUARDS (requireCustomerAPI, requirePartnerAPI, etc.)
 *    Used on all /api/loyalty/* endpoints.
 *    Always return JSON — never redirect.
 *    Defence-in-depth even after page guards pass.
 *
 * CSRF GUARD (requireXHR):
 *    Applied to all state-mutating API endpoints.
 *    Checks X-Requested-With: XMLHttpRequest header.
 *    Browsers never send this on cross-origin requests unless CORS
 *    explicitly permits it — which we do not for state mutations.
 *
 * PARTNER mustChangePassword:
 *    requirePartnerAPI blocks all partner endpoints except /set-password.
 *    requirePartnerSetPasswordPage only allows the set-password page when
 *    mustChangePassword is true — otherwise redirects to scan.
 */

const session = require("express-session");
const { RedisStore } = require("connect-redis");

const {
  redisClient,
  connectRedis,
} = require("../utils/redis");

const { serverRenderPage } = require("../utils/renderPage");

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

/**
 * Partner set-password page guard.
 * No session               → redirect to login.
 * mustChangePassword=false → redirect to scan (already set password).
 * OK                       → next()
 */
function requirePartnerSetPasswordPage(req, res, next) {
  if (!req.session?.loyaltyPartner) {
    return res.redirect("/loyalty/partner/login.html");
  }
  if (!req.session.loyaltyPartner.mustChangePassword) {
    return res.redirect("/loyalty/partner/scan.html");
  }
  return next();
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

  /* PAGE GUARDS */
  requireCustomerPage,
  requirePartnerPage,
  requirePartnerSetPasswordPage,
  requireAdminPage,

  /* API GUARDS */
  requireCustomerAPI,
  requirePartnerAPI,
  requirePartnerAnyAPI,
  requireAdminAPI,

  requireXHR,
};