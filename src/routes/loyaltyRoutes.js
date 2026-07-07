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
 *   GET    /admin/partners/:id
 *   PATCH  /admin/partners/:id
 *   PATCH  /admin/partners/:id/active
 *
 *   GET    /admin/partner-requests
 *   POST   /admin/partner-requests/:id/approve
 *   POST   /admin/partner-requests/:id/reject
 *
 *   POST   /partner-request
 *
 * GET  /admin/partners/:id returns the full partner record
 * (including notes, description, offerDescription) for the
 * admin edit drawer — the paginated list response is lean.
 *
 * PATCH /admin/partners/:id accepts a partial update of any of:
 *   name, legalName, vatNumber, category,
 *   email, phone, website,
 *   address, city, postalCode,
 *   description, offerDescription, notes,
 *   active
 * id / identifier / password are not editable via this route.
 *
 * POST /partner-request is the public, unauthenticated endpoint
 * behind the loyalty landing page "Richiedi di diventare Partner"
 * form. It creates a row in loyalty_partner_requests with
 * status='pending'. Admins review pending requests via
 * GET /admin/partner-requests and either:
 *   - approve: POST /admin/partner-requests/:id/approve
 *     (body: { id, tempPassword, ...overrides, reviewNotes? })
 *     → calls partnerLoyaltyService.createPartner() and links
 *       the new partner via convertedPartnerId
 *   - reject: POST /admin/partner-requests/:id/reject
 *     (body: { reviewNotes? })
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

const adminCtrl           = require("../controllers/loyalty/adminLoyaltyController");
const customerCtrl        = require("../controllers/loyalty/customerLoyaltyController");
const passwordCtrl        = require("../controllers/loyalty/passwordResetLoyaltyController");
const partnerCtrl         = require("../controllers/loyalty/partnerLoyaltyController");
const partnerRequestCtrl  = require("../controllers/loyalty/partnerRequestLoyaltyController");
const verifCtrl           = require("../controllers/verificationController");

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

const partnerRequestLimiter =
createLimiter({
    windowMs:
        60 * 60 * 1000,

    max:
        5,

    message:
        "Troppe richieste. Riprova tra un'ora.",

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
   PARTNER REQUEST ROUTER
   Public, unauthenticated. Used by the loyalty
   landing page "Richiedi di diventare Partner" form.

   Mounted directly on the top-level router (sibling
   of /customer, /partner, /admin) since it has no
   session context of its own.
────────────────────────────────────────────── */

const partnerRequestRouter =
express.Router();

partnerRequestRouter.post(
    "/",
    partnerRequestLimiter,
    requireXHR,
    partnerRequestCtrl.submitPartnerRequest
);

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

/* ── CUSTOMERS — create ──
   POST /admin/customers
   Body: { full_name, identifier, password }
*/
adminRouter.post(
    "/customers",
    requireXHR,
    adminCtrl.adminCreateCustomer
);

/* ── CUSTOMERS — get one (full record for edit drawer) ──
   GET /admin/customers/:id
*/
adminRouter.get(
    "/customers/:id",
    adminCtrl.adminGetCustomerById
);

/* ── CUSTOMERS — update ──
   PATCH /admin/customers/:id
   Body: { full_name }
*/
adminRouter.patch(
    "/customers/:id",
    requireXHR,
    adminCtrl.adminUpdateCustomer
);

/* ── CUSTOMERS — activate/suspend ──
   PATCH /admin/customers/:id/active
   Body: { active: boolean }
*/
adminRouter.patch(
    "/customers/:id/active",
    requireXHR,
    adminCtrl.adminSetCustomerActive
);

/* ── CUSTOMERS — resend verification ──
   POST /admin/customers/:id/resend-verification
*/
adminRouter.post(
    "/customers/:id/resend-verification",
    requireXHR,
    adminCtrl.adminResendCustomerVerification
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

/* ── OFFERS — get one (full record for edit drawer) ──
   GET /admin/offers/:id
*/
adminRouter.get(
    "/offers/:id",
    adminCtrl.adminGetOfferById
);

/* ── OFFERS — update ──
   PATCH /admin/offers/:id
   Body: { title, description, active }
*/
adminRouter.patch(
    "/offers/:id",
    requireXHR,
    adminCtrl.adminUpdateOffer
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

/* ── PARTNERS — get one (full record for edit drawer) ──
   GET /admin/partners/:id
*/
adminRouter.get(
    "/partners/:id",
    adminCtrl.adminGetPartnerById
);

/* ── PARTNERS — update (partial) ──
   PATCH /admin/partners/:id
*/
adminRouter.patch(
    "/partners/:id",
    requireXHR,
    adminCtrl.adminUpdatePartner
);

adminRouter.patch(
    "/partners/:id/active",
    requireXHR,
    adminCtrl.adminSetPartnerActive
);

/* ── PARTNERS — force password reset ──
   POST /admin/partners/:id/force-password-reset
*/
adminRouter.post(
    "/partners/:id/force-password-reset",
    requireXHR,
    adminCtrl.adminForcePartnerPasswordReset
);

/* ── PARTNER REQUESTS — paginated list ──
   GET /admin/partner-requests?page=&limit=&search=&sortBy=&sortOrder=&status=&category=
*/
adminRouter.get(
    "/partner-requests",
    paginate,
    adminCtrl.adminGetPartnerRequestsPaginated
);

/* ── PARTNER REQUESTS — approve ──
   POST /admin/partner-requests/:id/approve
   Body: { id, tempPassword, ...partner field overrides, reviewNotes? }
*/
adminRouter.post(
    "/partner-requests/:id/approve",
    requireXHR,
    adminCtrl.adminApprovePartnerRequest
);

/* ── PARTNER REQUESTS — reject ──
   POST /admin/partner-requests/:id/reject
   Body: { reviewNotes? }
*/
adminRouter.post(
    "/partner-requests/:id/reject",
    requireXHR,
    adminCtrl.adminRejectPartnerRequest
);

/* ── PARTNER REQUESTS — archive ──
   PATCH /admin/partner-requests/:id/archive
*/
adminRouter.patch(
    "/partner-requests/:id/archive",
    requireXHR,
    adminCtrl.adminArchivePartnerRequest
);

/* ── NEWSLETTERS — paginated list ──
   GET /admin/newsletters?page=&limit=&search=&sortBy=&sortOrder=&subscribed=&verified=
*/
adminRouter.get(
    "/newsletters",
    paginate,
    adminCtrl.adminGetNewslettersPaginated
);

/* ── NEWSLETTERS — delete (soft) ──
   DELETE /admin/newsletters/:email
   Sets subscribed=false + unsubscribed_at=NOW() —
   see adminLoyaltyService.deleteNewsletterSubscription.
*/
adminRouter.delete(
    "/newsletters/:email",
    requireXHR,
    adminCtrl.adminDeleteNewsletter
);

/* ── NEWSLETTERS — resend verification ──
   POST /admin/newsletters/:email/resend-verification
*/
adminRouter.post(
    "/newsletters/:email/resend-verification",
    requireXHR,
    adminCtrl.adminResendNewsletterVerification
);

/* ── SIMULATOR LEADS — paginated list ──
   GET /admin/simulator?page=&limit=&search=&sortBy=&sortOrder=&energySource=&archived=
*/
adminRouter.get(
    "/simulator",
    paginate,
    adminCtrl.adminGetSimulationsPaginated
);

/* ── SIMULATOR LEADS — mark contacted ──
   PATCH /admin/simulator/:id/mark-contacted
*/
adminRouter.patch(
    "/simulator/:id/mark-contacted",
    requireXHR,
    adminCtrl.adminMarkSimulationContacted
);

/* ── SIMULATOR LEADS — archive (soft delete) ──
   PATCH /admin/simulator/:id/archive
*/
adminRouter.patch(
    "/simulator/:id/archive",
    requireXHR,
    adminCtrl.adminArchiveSimulation
);

/* ── CONTACT REQUESTS — paginated list ──
   GET /admin/contacts?page=&limit=&search=&sortBy=&sortOrder=&verified=&source=&category=&status=
*/
adminRouter.get(
    "/contacts",
    paginate,
    adminCtrl.adminGetContactsPaginated
);

/* ── CONTACT REQUESTS — mark contacted ──
   PATCH /admin/contacts/:requestId/mark-contacted
*/
adminRouter.patch(
    "/contacts/:requestId/mark-contacted",
    requireXHR,
    adminCtrl.adminMarkContactContacted
);

/* ── CONTACT REQUESTS — archive ──
   PATCH /admin/contacts/:requestId/archive
*/
adminRouter.patch(
    "/contacts/:requestId/archive",
    requireXHR,
    adminCtrl.adminArchiveContact
);

/* ── CONTACT REQUESTS — resend verification ──
   POST /admin/contacts/:contactId/resend-verification
   Note: contactId, not requestId — the verification
   email is tied to the contact record, not the request.
*/
adminRouter.post(
    "/contacts/:contactId/resend-verification",
    requireXHR,
    adminCtrl.adminResendContactVerification
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
    "/partner-request",
    partnerRequestRouter
);

router.use(
    "/admin",
    adminRouter
);

module.exports =
router;