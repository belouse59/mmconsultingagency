"use strict";

/**
 * controllers/loyalty/sessionLoyaltyController.js
 *
 * GET /api/loyalty/session
 *
 * Aggregating session check across all three loyalty roles.
 * Does NOT replace customerSession / partnerSession / adminSession —
 * those stay as-is for their existing per-area consumers (e.g. the
 * customer dashboard checking its own session). This endpoint exists
 * specifically to serve callers that need to know "is *anyone*
 * logged in, and as what" without making three separate requests:
 *
 *   - public/js/features/navigation/nav.js
 *     (decide "Accedi" vs "Il Mio Account" / "Area Partner" / "Admin")
 *   - public/js/features/loyalty/login.js
 *     (redirect away from the login page if already authenticated)
 *
 * establishSession() already enforces that only one of
 * loyaltyCustomer / loyaltyPartner / loyaltyAdmin can be set on a
 * session at a time — this controller relies on that invariant and
 * checks them in a fixed priority order (customer, partner, admin),
 * though in practice at most one will ever be present.
 *
 * Response shape (always 200 — "not authenticated" is not an error):
 *
 *   authenticated: false
 *     { authenticated: false }
 *
 *   authenticated: true
 *     {
 *       authenticated: true,
 *       role:          "customer" | "partner" | "admin",
 *       label:         string,   // navbar display label
 *       dashboardUrl:  string,   // unconditional link target
 *     }
 *
 * Adding a future role (employee, consultant, etc.) means adding
 * one entry to ROLE_CONFIG below — nav.js and login.js need no
 * changes, since they only ever read role/label/dashboardUrl from
 * this response, never hardcode a role→URL mapping themselves.
 */

const { asyncHandler } = require("./helper");

/* ─────────────────────────────────────────────
   ROLE CONFIG
   Single source of truth for label + dashboard
   URL per role. Add new roles here only.
───────────────────────────────────────────── */

const ROLE_CONFIG = {
  customer: {
    label:        "Il Mio Account",
    dashboardUrl: "/loyalty/customer/dashboard",
  },
  partner: {
    label:        "Area Partner",
    dashboardUrl: "/loyalty/partner/scan",
  },
  admin: {
    label:        "Admin",
    dashboardUrl: "/loyalty/admin/dashboard",
  },
};

/* ─────────────────────────────────────────────
   GET /api/loyalty/session
───────────────────────────────────────────── */

const getLoyaltySession = asyncHandler(async (req, res) => {
  let role = null;

  if (req.session?.loyaltyCustomer) {
    role = "customer";
  } else if (req.session?.loyaltyPartner) {
    role = "partner";
  } else if (req.session?.loyaltyAdmin) {
    role = "admin";
  }

  if (!role) {
    return res.json({ authenticated: false });
  }

  const cfg = ROLE_CONFIG[role];

  return res.json({
    authenticated: true,
    role,
    label:         cfg.label,
    dashboardUrl:  cfg.dashboardUrl,
  });
});

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  getLoyaltySession,
};