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
const adminCtrl   = require("../controllers/loyalty/adminLoyaltyController");
const customerCtrl   = require("../controllers/loyalty/customerLoyaltyController");
const partnerCtrl   = require("../controllers/loyalty/partnerLoyaltyController");
const {
  requireCustomerAPI,
  requirePartnerAPI,
  requirePartnerAnyAPI,
  requireAdminAPI,
  requireXHR,
} = require("../middleware/loyaltySession");

const router          = express.Router();

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

/** Manual scan: 10 per hour per IP — prevents mass account creation */
const manualLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, message: "Troppi tentativi manuali. Riprova tra un minuto." },
  skip:            () => process.env.NODE_ENV === "test",
});
/* ─────────────────────────────────────────────────────────────
   CUSTOMER ROUTES
───────────────────────────────────────────────────────────── */
router.post("/customer/register", registerLimiter, requireXHR,         customerCtrl.registerCustomer);
router.post("/customer/login",    authLimiter,                         customerCtrl.loginCustomer);
router.post("/customer/logout",   requireXHR,                          customerCtrl.logoutCustomer);
router.get( "/customer/session",                                        customerCtrl.customerSession);
router.get( "/customer/qr",       requireCustomerAPI,                   customerCtrl.getCustomerQr);
router.get( "/customer/offers",   requireCustomerAPI,                   customerCtrl.getOffers);

/* ─────────────────────────────────────────────────────────────
   PARTNER ROUTES
───────────────────────────────────────────────────────────── */
router.post("/partner/login",        authLimiter,                                              partnerCtrl.loginPartner);
router.post("/partner/logout",       requireXHR,                                               partnerCtrl.logoutPartner);
router.get( "/partner/session",                                                                partnerCtrl.partnerSession);
router.post("/partner/set-password", requireXHR, requirePartnerAnyAPI,                        partnerCtrl.setPartnerPassword);
router.get( "/partner/offers",       requirePartnerAPI,                                        partnerCtrl.getPartnerOffers);
router.post("/partner/prevalidate",  requireXHR, requirePartnerAPI, manualLimiter,             partnerCtrl.prevalidateQr);
router.post("/partner/redeem",       requireXHR, requirePartnerAPI, redeemLimiter,             partnerCtrl.redeemQr);

/* ─────────────────────────────────────────────────────────────
   ADMIN ROUTES
───────────────────────────────────────────────────────────── */
router.post("/admin/login",                   authLimiter,                                     adminCtrl.loginAdmin);
router.post("/admin/logout",                  requireXHR,                                      adminCtrl.logoutAdmin);
router.get( "/admin/session",                 requireAdminAPI,                                 adminCtrl.adminSession);
router.get( "/admin/customers",               requireAdminAPI,                                 adminCtrl.adminGetCustomers);
router.get( "/admin/redemptions",             requireAdminAPI,                                 adminCtrl.adminGetRedemptions);
router.get( "/admin/offers",                  requireAdminAPI,                                 adminCtrl.adminGetOffers);
router.post("/admin/offers",                  requireXHR, requireAdminAPI,                     adminCtrl.adminCreateOffer);
router.get( "/admin/partners",                requireAdminAPI,                                 adminCtrl.adminGetPartners);
router.post("/admin/partners",                requireXHR, requireAdminAPI,                     adminCtrl.adminCreatePartner);
router.patch("/admin/partners/:id/active",    requireXHR, requireAdminAPI,                     adminCtrl.adminSetPartnerActive);

module.exports = router;