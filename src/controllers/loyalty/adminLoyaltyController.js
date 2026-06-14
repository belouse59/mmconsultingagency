"use strict";

/**
 * controllers/loyalty/adminLoyaltyController.js
 *
 * Changes from original:
 *   - All handlers now use asyncHandler (matches the pattern
 *     used by customerLoyaltyController and partnerLoyaltyController)
 *   - Paginated handlers added for customers, partners, offers, redemptions
 *   - Paginated handlers read req.pagination (set by paginationMiddleware)
 *   - Original flat handlers preserved — routes can switch at the router level
 *   - Removed raw try/catch from every handler (asyncHandler owns this)
 *
 *
 *   // Paginated list endpoints
 *   router.get("/customers",   paginate, ctrl.adminGetCustomersPaginated);
 *   router.get("/partners",    paginate, ctrl.adminGetPartnersPaginated);
 *   router.get("/offers",      paginate, ctrl.adminGetOffersPaginated);
 *   router.get("/redemptions", paginate, ctrl.adminGetRedemptionsPaginated);
 *
 *   // Mutation endpoints (unchanged)
 *   router.post("/partners",           ctrl.adminCreatePartner);
 *   router.patch("/partners/:id/active", ctrl.adminSetPartnerActive);
 *   router.post("/offers",             ctrl.adminCreateOffer);
 */

const redemptionLoyaltyService = require("../../services/loyalty/redemptionLoyaltyService");
const customerLoyaltyService   = require("../../services/loyalty/customerLoyaltyService");
const partnerLoyaltyService    = require("../../services/loyalty/partnerLoyaltyService");
const adminLoyaltyService      = require("../../services/loyalty/adminLoyaltyService");
const offerLoyaltyService      = require("../../services/loyalty/offerLoyaltyService");

const { clean }          = require("../../utils/sanitizer");
const { verifyPassword } = require("../../utils/argon2");

const { establishSession, destroySession } = require("../../services/sessionService");
const { asyncHandler }                     = require("./helper");

/* ─────────────────────────────────────────────
   ADMIN LOGIN
───────────────────────────────────────────── */

const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const adminEmail = process.env.LOYALTY_ADMIN_EMAIL;
  const adminHash  = process.env.LOYALTY_ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminHash) {
    return res.status(503).json({
      success: false,
      message: "Admin non configurato.",
    });
  }

  if (!email?.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: "Credenziali obbligatorie.",
    });
  }

  const emailOk = email.trim().toLowerCase() === adminEmail.toLowerCase();
  const passOk  = await verifyPassword(password, adminHash);

  if (!emailOk || !passOk) {
    return res.status(401).json({
      success: false,
      message: "Credenziali non valide.",
    });
  }

  await establishSession(req, {
    loyaltyAdmin: { email: adminEmail },
  });

  return res.json({
    success: true,
    message: "Login effettuato.",
  });
});

/* ─────────────────────────────────────────────
   SESSION
───────────────────────────────────────────── */

const adminSession = asyncHandler(async (req, res) => {
  if (!req.session?.loyaltyAdmin) {
    return res.status(401).json({
      success: false,
      message: "Non autorizzato.",
    });
  }

  return res.json({
    success: true,
    data:    req.session.loyaltyAdmin,
  });
});

/* ─────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────── */

const logoutAdmin = asyncHandler(async (req, res) => {
  await destroySession(req, res);

  return res.json({
    success: true,
    message: "Logout effettuato.",
  });
});

/* ─────────────────────────────────────────────
   CUSTOMERS — FLAT (original preserved)
───────────────────────────────────────────── */

const adminGetCustomers = asyncHandler(async (req, res) => {
  const customers = await adminLoyaltyService.getCustomers();

  return res.json({
    success: true,
    data:    customers,
  });
});

/* ─────────────────────────────────────────────
   CUSTOMERS — PAGINATED  ← NEW
   GET /admin/customers?page=1&limit=20&search=mario&active=true
───────────────────────────────────────────── */

const adminGetCustomersPaginated = asyncHandler(async (req, res) => {
  const result = await adminLoyaltyService.getCustomersPaginated(req.pagination);

  return res.json({
    success:    true,
    data:       result.data,
    pagination: result.pagination,
  });
});

/* ─────────────────────────────────────────────
   PARTNERS — FLAT (original preserved)
───────────────────────────────────────────── */

const adminGetPartners = asyncHandler(async (req, res) => {
  const partners = await adminLoyaltyService.getPartners();

  return res.json({
    success: true,
    data:    partners,
  });
});

/* ─────────────────────────────────────────────
   PARTNERS — PAGINATED  ← NEW
   GET /admin/partners?page=1&limit=20&search=bar&category=ristorante&active=true
───────────────────────────────────────────── */

const adminGetPartnersPaginated = asyncHandler(async (req, res) => {
  const result = await adminLoyaltyService.getPartnersPaginated(req.pagination);

  return res.json({
    success:    true,
    data:       result.data,
    pagination: result.pagination,
  });
});

/* ─────────────────────────────────────────────
   CREATE PARTNER (original — unchanged)
───────────────────────────────────────────── */

const adminCreatePartner = asyncHandler(async (req, res) => {
  const { id, name, category, address, tempPassword } = req.body;

  const result = await partnerLoyaltyService.createPartner({
    id:           clean(id || ""),
    name:         clean(name || ""),
    category:     clean(category || ""),
    address:      clean(address || ""),
    tempPassword,
  });

  return res.status(201).json(result);
});

/* ─────────────────────────────────────────────
   SET PARTNER ACTIVE (original — unchanged)
───────────────────────────────────────────── */

const adminSetPartnerActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  if (typeof active !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "active must be boolean",
    });
  }

  const result = await partnerLoyaltyService.setPartnerActive(clean(id), active);

  return res.json(result);
});

/* ─────────────────────────────────────────────
   OFFERS — FLAT (original preserved)
───────────────────────────────────────────── */

const adminGetOffers = asyncHandler(async (req, res) => {
  const offers = await adminLoyaltyService.getOffers();

  return res.json({
    success: true,
    data:    offers,
  });
});

/* ─────────────────────────────────────────────
   OFFERS — PAGINATED  ← NEW
   GET /admin/offers?page=1&limit=20&search=pizza&active=true&partnerId=bar-centrale
───────────────────────────────────────────── */

const adminGetOffersPaginated = asyncHandler(async (req, res) => {
  const result = await adminLoyaltyService.getOffersPaginated(req.pagination);

  return res.json({
    success:    true,
    data:       result.data,
    pagination: result.pagination,
  });
});

/* ─────────────────────────────────────────────
   CREATE OFFER (original — unchanged)
───────────────────────────────────────────── */

const adminCreateOffer = asyncHandler(async (req, res) => {
  const { title, description, partnerId } = req.body;

  const result = await offerLoyaltyService.createOffer({
    title:       clean(title || ""),
    description: clean(description || ""),
    partnerId:   clean(partnerId || ""),
  });

  return res.status(201).json(result);
});

/* ─────────────────────────────────────────────
   REDEMPTIONS — FLAT (original preserved)
───────────────────────────────────────────── */

const adminGetRedemptions = asyncHandler(async (req, res) => {
  const redemptions = await adminLoyaltyService.getRedemptions();

  return res.json({
    success: true,
    data:    redemptions,
  });
});

/* ─────────────────────────────────────────────
   REDEMPTIONS — PAGINATED  ← NEW
   GET /admin/redemptions?page=1&limit=20&partnerId=bar-centrale&offerId=x
───────────────────────────────────────────── */

const adminGetRedemptionsPaginated = asyncHandler(async (req, res) => {
  const result = await adminLoyaltyService.getRedemptionsPaginated(req.pagination);

  return res.json({
    success:    true,
    data:       result.data,
    pagination: result.pagination,
  });
});

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  // Auth
  loginAdmin,
  logoutAdmin,
  adminSession,

  // Customers
  adminGetCustomers,
  adminGetCustomersPaginated,

  // Partners
  adminGetPartners,
  adminGetPartnersPaginated,
  adminCreatePartner,
  adminSetPartnerActive,

  // Offers
  adminGetOffers,
  adminGetOffersPaginated,
  adminCreateOffer,

  // Redemptions
  adminGetRedemptions,
  adminGetRedemptionsPaginated,
};