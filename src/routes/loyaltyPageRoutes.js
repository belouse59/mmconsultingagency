"use strict";

/**
 * routes/loyaltyPageRoutes.js
 *
 * Server-side page routing for protected loyalty HTML pages.
 *
 * WHY THIS FILE EXISTS:
 *   express.static() serves files blindly with zero session awareness.
 *   By registering explicit GET routes for protected pages BEFORE
 *   express.static() in app.js, Express intercepts those requests,
 *   runs the session guard, and either:
 *     a) serves the file via res.sendFile()  (authenticated)
 *     b) redirects to login                  (unauthenticated)
 *
 *   express.static() never sees the request for protected pages at all.
 *
 * PUBLIC PAGES (login, register, set-password):
 *   These are NOT listed here. They fall through to express.static()
 *   normally — anyone can access a login page.
 *
 * ROUTE REGISTRATION ORDER IN app.js:
 *   1. Session middleware
 *   2. API routes         (/api/*)
 *   3. THIS FILE          (loyalty page guards)
 *   4. express.static()   (public assets, public pages)
 */

const path    = require("path");
const express = require("express");
const {
  requireCustomerPage,
  requirePartnerPage,
  requirePartnerSetPasswordPage,
  requireAdminPage,
} = require("../middleware/loyaltySession");

const router = express.Router();
const VIEWS = path.join(__dirname, "../../views");

/* ── Helper — serve a file from public/ ── */
const serve = (relative) => (req, res) =>
  res.sendFile(path.join(VIEWS, relative));

/* ─────────────────────────────────────────────────────────────
   CUSTOMER PAGES
   Protected: session required.
   Unauthenticated → /loyalty/customer/login.html
───────────────────────────────────────────────────────────── */
router.get(
  "/loyalty/customer/dashboard",
  requireCustomerPage,
  serve("loyalty/customer/dashboard.html")
);

/* ─────────────────────────────────────────────────────────────
   PARTNER PAGES
───────────────────────────────────────────────────────────── */

/**
 * Scan page:
 *   No session              → login
 *   mustChangePassword=true → set-password
 *   OK                      → serve scan.html
 */
router.get(
  "/loyalty/partner/scan",
  requirePartnerPage,
  serve("loyalty/partner/scan.html")
);

/**
 * Set-password page:
 *   No session               → login
 *   mustChangePassword=false → scan (already done)
 *   OK                       → serve set-password.html
 */
router.get(
  "/loyalty/partner/set-password",
  requirePartnerSetPasswordPage,
  serve("loyalty/partner/set-password.html")
);

/* ─────────────────────────────────────────────────────────────
   ADMIN PAGE
   Always served — admin renders its own inline login form.
   All data is protected at the API level by requireAdminAPI.
───────────────────────────────────────────────────────────── */
router.get(
  "/loyalty/admin/dashboard",
  requireAdminPage,
  serve("loyalty/admin/dashboard.html")
);

module.exports = router;