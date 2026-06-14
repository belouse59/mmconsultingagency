"use strict";

/**
|--------------------------------------------------------------------------
| Loyalty Router
|--------------------------------------------------------------------------
|
| Mounted at:
|   /api/loyalty
|
| Principles:
| - Role-based route grouping
| - Centralized rate limiting
| - Validation-ready
| - Idempotency-ready
| - Minimal controller responsibility
| - Pagination-ready (admin list endpoints)
|
 *
 * Route map:
 *   POST   /customer/register
 *   POST   /customer/login
 *   POST   /customer/logout
 *   POST   /customer/forgot-password
 *   GET    /customer/reset-password
 *   GET    /customer/verify
 *   GET    /customer/success
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
 *
 *   GET    /admin/customers
 *   GET    /admin/redemptions
 *   GET    /admin/offers
 *   POST   /admin/offers
 *   GET    /admin/partners
 *   POST   /admin/partners
 *   PATCH  /admin/partners/:id/active
 *
 * Admin list endpoints (customers, redemptions, offers, partners)
 * are paginated via paginationMiddleware and accept:
 *
 *   ?page=1
 *   &limit=20
 *   &search=...
 *   &sortBy=...
 *   &sortOrder=asc|desc
 *
 * Entity-specific filters (passed through automatically):
 *   &active=true|false       (customers, partners, offers)
 *   &verified=true|false     (customers)
 *   &category=...            (partners)
 *   &partnerId=...           (offers, redemptions)
 *   &offerId=...             (redemptions)
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: [...],
 *     pagination: {
 *       page, limit, totalItems, totalPages, hasNext, hasPrevious
 *     }
 *   }
 */

const express      = require("express");
const rateLimit    = require("express-rate-limit");

const adminCtrl    = require("../controllers/loyalty/adminLoyaltyController");
const customerCtrl = require("../controllers/loyalty/customerLoyaltyController");
const passwordCtrl = require("../controllers/loyalty/passwordResetLoyaltyController");
const partnerCtrl  = require("../controllers/loyalty/partnerLoyaltyController");
const verifCtrl    = require("../controllers/verificationController");

const {
    requireCustomerAPI,
    requirePartnerAPI,
    requirePartnerAnyAPI,
    requireAdminAPI,
    requireXHR,
} = require("../middleware/loyaltySession");

const {
    paginate,
} = require("../middleware/paginationMiddleware");

const router = express.Router();

const {
    ipKeyGenerator,
} = rateLimit;

/* ──────────────────────────────────────────────
   LIMITER FACTORY
────────────────────────────────────────────── */

function createLimiter({
    windowMs,
    max,
    message,
    keyGenerator,
}) {
    return rateLimit({
        windowMs,
        max,

        standardHeaders: true,
        legacyHeaders: false,

        skip:
            () =>
                process.env.NODE_ENV === "test",

        keyGenerator:
            keyGenerator ||
            ((req) =>
                ipKeyGenerator(req)),

        handler(req, res) {
            return res
                .status(429)
                .json({
                    success: false,
                    message,
                });
        },
    });
}

/* ──────────────────────────────────────────────
   LIMITERS
────────────────────────────────────────────── */

const authLimiter =
createLimiter({
    windowMs:
        15 * 60 * 1000,

    max:
        10,

    message:
        "Troppi tentativi. Riprova tra 15 minuti.",

    keyGenerator(req) {
        return (
            req.body?.email?.toLowerCase()
            ||
            req.body?.username?.toLowerCase()
            ||
            ipKeyGenerator(req)
        );
    },
});

const registerLimiter =
createLimiter({
    windowMs:
        60 * 60 * 1000,

    max:
        5,

    message:
        "Troppi tentativi di registrazione. Riprova tra un'ora.",

    keyGenerator(req) {
        return (
            req.body?.email?.toLowerCase()
            ||
            ipKeyGenerator(req)
        );
    },
});

const passwordResetLimiter =
createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Troppi tentativi. Riprova tra 15 minuti.",
});

const redeemLimiter =
createLimiter({
    windowMs:
        60 * 1000,

    max:
        30,

    message:
        "Troppi tentativi di validazione. Riprova tra un minuto.",

    keyGenerator(req) {
        return (
            req.user?.partnerId
            ||
            ipKeyGenerator(req)
        );
    },
});

const manualLimiter =
createLimiter({
    windowMs:
        60 * 1000,

    max:
        10,

    message:
        "Troppi tentativi manuali. Riprova tra un minuto.",

    keyGenerator(req) {
        return (
            req.user?.partnerId
            ||
            ipKeyGenerator(req)
        );
    },
});

/* ──────────────────────────────────────────────
   OPTIONAL VALIDATION PLACEHOLDER
────────────────────────────────────────────── */

const validate =
    (...validators) =>
        validators;

/* ──────────────────────────────────────────────
   OPTIONAL IDEMPOTENCY PLACEHOLDER
────────────────────────────────────────────── */

function requireIdempotency(
    req,
    res,
    next
) {
    const key =
        req.header(
            "Idempotency-Key"
        );

    if (!key) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Idempotency-Key required",
            });
    }

    next();
}

/* ──────────────────────────────────────────────
   CUSTOMER ROUTER
────────────────────────────────────────────── */

const customerRouter =
express.Router();

customerRouter.post(
    "/register",
    registerLimiter,
    requireXHR,
    validate(),
    customerCtrl.registerCustomer
);

customerRouter.get(
    "/verify", verifCtrl.verifyCustomer
);


customerRouter.post(
    "/login",
    authLimiter,
    validate(),
    customerCtrl.loginCustomer
);

customerRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  requireXHR,
  passwordCtrl.forgotPassword
);

customerRouter.get(
  "/reset-password",
  passwordCtrl.resetPasswordPage
);

customerRouter.post(
  "/reset-password",
  authLimiter,
  requireXHR,
  passwordCtrl.resetPassword
);

customerRouter.post(
    "/logout",
    requireXHR,
    customerCtrl.logoutCustomer
);

customerRouter.get(
    "/session",
    customerCtrl.customerSession
);

customerRouter.use(
    requireCustomerAPI
);

customerRouter.get(
    "/qr",
    customerCtrl.getCustomerQr
);

customerRouter.get(
    "/offers",
    customerCtrl.getOffers
);

/* ──────────────────────────────────────────────
   PARTNER ROUTER
────────────────────────────────────────────── */

const partnerRouter =
express.Router();

partnerRouter.post(
    "/login",
    authLimiter,
    partnerCtrl.loginPartner
);

partnerRouter.post(
    "/logout",
    requireXHR,
    partnerCtrl.logoutPartner
);

partnerRouter.get(
    "/session",
    partnerCtrl.partnerSession
);

partnerRouter.post(
    "/set-password",
    requireXHR,
    requirePartnerAnyAPI,
    partnerCtrl.setPartnerPassword
);

partnerRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  requireXHR,
  passwordCtrl.forgotPassword
);

partnerRouter.get(
  "/reset-password",
  passwordCtrl.resetPasswordPage
);

partnerRouter.post(
  "/reset-password",
  authLimiter,
  requireXHR,
  passwordCtrl.resetPassword
);

partnerRouter.use(
    requirePartnerAPI
);

partnerRouter.get(
    "/offers",
    partnerCtrl.getPartnerOffers
);

partnerRouter.post(
    "/prevalidate",
    requireXHR,
    manualLimiter,
    partnerCtrl.prevalidateQr
);

partnerRouter.post(
    "/redeem",
    requireXHR,
    redeemLimiter,
    requireIdempotency,
    partnerCtrl.redeemQr
);

/* ──────────────────────────────────────────────
   ADMIN ROUTER
────────────────────────────────────────────── */

const adminRouter =
express.Router();

adminRouter.post(
    "/login",
    authLimiter,
    adminCtrl.loginAdmin
);

adminRouter.use(
    requireAdminAPI
);

adminRouter.post(
    "/logout",
    requireXHR,
    adminCtrl.logoutAdmin
);

adminRouter.get(
    "/session",
    adminCtrl.adminSession
);

/* ── CUSTOMERS — paginated list ──
   GET /admin/customers?page=&limit=&search=&sortBy=&sortOrder=&active=&verified=
*/
adminRouter.get(
    "/customers",
    paginate,
    adminCtrl.adminGetCustomersPaginated
);

/* ── REDEMPTIONS — paginated list ──
   GET /admin/redemptions?page=&limit=&search=&sortBy=&sortOrder=&partnerId=&offerId=
*/
adminRouter.get(
    "/redemptions",
    paginate,
    adminCtrl.adminGetRedemptionsPaginated
);

/* ── OFFERS — paginated list ──
   GET /admin/offers?page=&limit=&search=&sortBy=&sortOrder=&active=&partnerId=
*/
adminRouter.get(
    "/offers",
    paginate,
    adminCtrl.adminGetOffersPaginated
);

adminRouter.post(
    "/offers",
    requireXHR,
    adminCtrl.adminCreateOffer
);

/* ── PARTNERS — paginated list ──
   GET /admin/partners?page=&limit=&search=&sortBy=&sortOrder=&active=&category=
*/
adminRouter.get(
    "/partners",
    paginate,
    adminCtrl.adminGetPartnersPaginated
);

adminRouter.post(
    "/partners",
    requireXHR,
    adminCtrl.adminCreatePartner
);

adminRouter.patch(
    "/partners/:id/active",
    requireXHR,
    adminCtrl.adminSetPartnerActive
);

/* ──────────────────────────────────────────────
   MOUNT
────────────────────────────────────────────── */

router.use(
    "/customer",
    customerRouter
);

router.use(
    "/partner",
    partnerRouter
);

router.use(
    "/admin",
    adminRouter
);

module.exports =
router;