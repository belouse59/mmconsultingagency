"use strict";

/**
 * routes/loyaltyRoutes.js
 *
 * Mounted at: /api/loyalty
 *
 * CHANGES FROM ORIGINAL:
 *   - Rate limiting on all auth endpoints (express-rate-limit)
 *   - All admin routes protected by requireAdminAPI guard
 *   - All customer data routes protected by requireCustomerAPI guard
 *   - All partner data routes protected by requirePartnerAPI guard
 *   - Redemption endpoint rate-limited independently (stricter)
 *   - Consistent REST naming
 *
 * Route map:
 *   POST   /customer/register
 *   POST   /customer/login
 *   POST   /customer/logout
 *   GET    /customer/session
 *   GET    /customer/qr
 *   GET    /customer/offers
 *
 *   POST   /partner/login
 *   POST   /partner/logout
 *   GET    /partner/session
 *   GET    /partner/offers
 *   POST   /partner/redeem
 *
 *   POST   /admin/login
 *   POST   /admin/logout
 *   GET    /admin/session
 *   GET    /admin/customers
 *   GET    /admin/redemptions
 *   GET    /admin/offers
 *   POST   /admin/offers
 */

const express      = require("express");
const rateLimit    = require("express-rate-limit");
const controller   = require("../controllers/loyaltyController");
const {
  requireCustomerAPI,
  requirePartnerAPI,
  requireAdminAPI,
} = require("../middleware/loyaltySession");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   RATE LIMITERS
───────────────────────────────────────────────────────────── */

/** Auth endpoints: 10 attempts per 15 minutes per IP */
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { success: false, message: "Troppi tentativi. Riprova tra 15 minuti." },
  skip: () => process.env.NODE_ENV === "test",
});

/** Redemption endpoint: 30 scans per minute per IP (partner device) */
const redeemLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              30,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { success: false, message: "Troppi tentativi di validazione. Riprova tra un minuto." },
  skip: () => process.env.NODE_ENV === "test",
});

/** Registration: 5 per hour per IP — prevents mass account creation */
const registerLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { success: false, message: "Troppi tentativi di registrazione. Riprova tra un'ora." },
  skip: () => process.env.NODE_ENV === "test",
});

/* ─────────────────────────────────────────────────────────────
   CUSTOMER ROUTES
───────────────────────────────────────────────────────────── */
router.post("/customer/register",  registerLimiter, controller.registerCustomer);
router.post("/customer/login",     authLimiter,     controller.loginCustomer);
router.post("/customer/logout",                     controller.logoutCustomer);
router.get( "/customer/session",                    controller.customerSession);
router.get( "/customer/qr",        requireCustomerAPI, controller.getCustomerQr);
router.get( "/customer/offers",    requireCustomerAPI, controller.getOffers);

/* ─────────────────────────────────────────────────────────────
   PARTNER ROUTES
───────────────────────────────────────────────────────────── */
router.post("/partner/login",      authLimiter,     controller.loginPartner);
router.post("/partner/logout",                      controller.logoutPartner);
router.get( "/partner/session",                     controller.partnerSession);
router.get( "/partner/offers",     requirePartnerAPI, controller.getPartnerOffers);
router.post("/partner/redeem",     requirePartnerAPI, redeemLimiter, controller.redeemQr);

/* ─────────────────────────────────────────────────────────────
   ADMIN ROUTES
───────────────────────────────────────────────────────────── */
router.post("/admin/login",        authLimiter,     controller.loginAdmin);
router.post("/admin/logout",                        controller.logoutAdmin);
router.get( "/admin/session",      requireAdminAPI, controller.adminSession);
router.get( "/admin/customers",    requireAdminAPI, controller.adminGetCustomers);
router.get( "/admin/redemptions",  requireAdminAPI, controller.adminGetRedemptions);
router.get( "/admin/offers",       requireAdminAPI, controller.adminGetOffers);
router.post("/admin/offers",       requireAdminAPI, controller.adminCreateOffer);

module.exports = router;