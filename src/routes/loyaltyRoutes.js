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
|
 *
 * Route map:
 *   POST   /customer/register
 *   POST   /customer/login
 *   POST   /customer/logout
 *   GET    /customer/verify
  *  GET    /customer/success
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

const adminCtrl    = require("../controllers/loyalty/adminLoyaltyController");
const customerCtrl = require("../controllers/loyalty/customerLoyaltyController");
const partnerCtrl  = require("../controllers/loyalty/partnerLoyaltyController");
const verifCtrl    = require("../controllers/verificationController");

const {
    requireCustomerAPI,
    requirePartnerAPI,
    requirePartnerAnyAPI,
    requireAdminAPI,
    requireXHR,
} = require("../middleware/loyaltySession");

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

customerRouter.get(
    "/registration/success", customerCtrl.successPage
);


customerRouter.post(
    "/login",
    authLimiter,
    validate(),
    customerCtrl.loginCustomer
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

adminRouter.get(
    "/customers",
    adminCtrl.adminGetCustomers
);

adminRouter.get(
    "/redemptions",
    adminCtrl.adminGetRedemptions
);

adminRouter.get(
    "/offers",
    adminCtrl.adminGetOffers
);

adminRouter.post(
    "/offers",
    requireXHR,
    adminCtrl.adminCreateOffer
);

adminRouter.get(
    "/partners",
    adminCtrl.adminGetPartners
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
