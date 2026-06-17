"use strict";

/**
 * controllers/loyalty/adminLoyaltyController.js
 *
 * Changes from previous version:
 *   - adminCreatePartner extended to accept the full
 *     business/contact/location/loyalty-program payload
 *     from the admin partner creation drawer
 *   - adminGetPartnerById added — GET /admin/partners/:id
 *     returns the full record for the edit drawer
 *   - adminUpdatePartner added — PATCH /admin/partners/:id
 *     partial update of partner fields
 *   - All other handlers unchanged
 */

const redemptionLoyaltyService     = require("../../services/loyalty/redemptionLoyaltyService");
const customerLoyaltyService       = require("../../services/loyalty/customerLoyaltyService");
const partnerLoyaltyService        = require("../../services/loyalty/partnerLoyaltyService");
const partnerRequestLoyaltyService = require("../../services/loyalty/partnerRequestLoyaltyService");
const adminLoyaltyService          = require("../../services/loyalty/adminLoyaltyService");
const offerLoyaltyService          = require("../../services/loyalty/offerLoyaltyService");

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
   CUSTOMERS — PAGINATED
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
   PARTNERS — PAGINATED
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
   PARTNERS — GET ONE  ← NEW
   GET /admin/partners/:id

   Returns the full partner record (sanitized).
   The paginated list response is intentionally lean
   (no notes/description/offerDescription) — the edit
   drawer fetches the full record via this endpoint
   when opened.
───────────────────────────────────────────── */

const adminGetPartnerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const partner = await adminLoyaltyService.getPartnerById(clean(id || ""));

  if (!partner) {
    return res.status(404).json({
      success: false,
      message: "Partner non trovato.",
    });
  }

  return res.json({
    success: true,
    data:    partner,
  });
});

/* ─────────────────────────────────────────────
   CREATE PARTNER  ← EXTENDED
   POST /admin/partners

   Accepts the full business / contact / location /
   loyalty-program payload from the admin partner
   creation drawer, in addition to the original
   id / name / category / address / tempPassword.
───────────────────────────────────────────── */

const adminCreatePartner = asyncHandler(async (req, res) => {
  const {
    name,
    legalName,
    vatNumber,
    email,
    phone,
    website,
    category,
    address,
    city,
    postalCode,
    description,
    offerDescription,
    notes,
    tempPassword,
  } = req.body;

  const result = await partnerLoyaltyService.createPartner({
    name:             clean(name || ""),
    legalName:        clean(legalName || ""),
    vatNumber:        clean(vatNumber || ""),
    email:            clean(email || ""),
    phone:            clean(phone || ""),
    website:          clean(website || ""),
    category:         clean(category || ""),
    address:          clean(address || ""),
    city:             clean(city || ""),
    postalCode:       clean(postalCode || ""),
    description:      clean(description || ""),
    offerDescription: clean(offerDescription || ""),
    notes:            clean(notes || ""),
    tempPassword,
  });

  return res.status(201).json(result);
});

/* ─────────────────────────────────────────────
   UPDATE PARTNER  ← NEW
   PATCH /admin/partners/:id

   Partial update — only keys present in the request
   body are changed. Used by the edit drawer.

   id / identifier / password are not editable here
   (id is immutable; password has its own flow via
   setPartnerPassword).
───────────────────────────────────────────── */

const PARTNER_PATCH_FIELDS = [
  "name",
  "legalName",
  "vatNumber",
  "category",
  "email",
  "phone",
  "website",
  "address",
  "city",
  "postalCode",
  "description",
  "offerDescription",
  "notes",
];

const adminUpdatePartner = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const fields = {};

  for (const key of PARTNER_PATCH_FIELDS) {
    if (req.body[key] !== undefined) {
      fields[key] = clean(String(req.body[key] ?? ""));
    }
  }

  // active is boolean — must not be passed through clean()
  if (req.body.active !== undefined) {
    fields.active = Boolean(req.body.active);
  }

  const result = await partnerLoyaltyService.updatePartner(clean(id || ""), fields);

  return res.json(result);
});

/* ─────────────────────────────────────────────
   PARTNER REQUESTS — PAGINATED  ← NEW
   GET /admin/partner-requests?page=&limit=&search=&sortBy=&sortOrder=&status=&category=

   Recommended placement: Loyalty → Richieste Partner
   (the entity has a direct FK to partners and its
   approval action creates a partner).
───────────────────────────────────────────── */

const adminGetPartnerRequestsPaginated = asyncHandler(async (req, res) => {
  const result = await adminLoyaltyService.getPartnerRequestsPaginated(req.pagination);

  return res.json({
    success:    true,
    data:       result.data,
    pagination: result.pagination,
  });
});

/* ─────────────────────────────────────────────
   PARTNER REQUESTS — APPROVE  ← NEW
   POST /admin/partner-requests/:id/approve

   Body: { id, tempPassword, ...any partner field overrides,
           reviewNotes? }

   id and tempPassword are required — they're the two pieces
   of information the request itself can never provide.
   Any other field left empty falls back to the value
   originally submitted in the request
   (see partnerRequestLoyaltyService.approveRequest).
───────────────────────────────────────────── */

const PARTNER_REQUEST_APPROVE_FIELDS = [
  "name",
  "legalName",
  "vatNumber",
  "email",
  "phone",
  "website",
  "category",
  "address",
  "city",
  "postalCode",
  "description",
  "offerDescription",
  "notes",
  "reviewNotes",
];

const adminApprovePartnerRequest = asyncHandler(async (req, res) => {
  const { id: requestId } = req.params;

  const overrides = {};

  for (const key of PARTNER_REQUEST_APPROVE_FIELDS) {
    if (req.body[key] !== undefined) {
      overrides[key] = clean(String(req.body[key] ?? ""));
    }
  }

  // tempPassword must not be passed through clean() (it's a secret,
  // not display text — clean() may alter characters intended
  // verbatim for the password).
  if (req.body.tempPassword) {
    overrides.tempPassword = req.body.tempPassword;
  }

  const adminEmail = req.session?.loyaltyAdmin?.email || null;

  const result = await partnerRequestLoyaltyService.approveRequest(
    clean(requestId || ""),
    overrides,
    adminEmail
  );

  return res.status(201).json(result);
});

/* ─────────────────────────────────────────────
   PARTNER REQUESTS — REJECT  ← NEW
   POST /admin/partner-requests/:id/reject

   Body: { reviewNotes? }
───────────────────────────────────────────── */

const adminRejectPartnerRequest = asyncHandler(async (req, res) => {
  const { id: requestId } = req.params;
  const { reviewNotes }   = req.body;

  const adminEmail = req.session?.loyaltyAdmin?.email || null;

  const result = await partnerRequestLoyaltyService.rejectRequest(
    clean(requestId || ""),
    { reviewNotes: reviewNotes ? clean(reviewNotes) : "" },
    adminEmail
  );

  return res.json(result);
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
   OFFERS — PAGINATED
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
   REDEMPTIONS — PAGINATED
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
  adminGetPartnerById,        // ← new
  adminCreatePartner,
  adminUpdatePartner,         // ← new
  adminSetPartnerActive,

  // Partner Requests
  adminGetPartnerRequestsPaginated,   // ← new
  adminApprovePartnerRequest,         // ← new
  adminRejectPartnerRequest,          // ← new

  // Offers
  adminGetOffers,
  adminGetOffersPaginated,
  adminCreateOffer,

  // Redemptions
  adminGetRedemptions,
  adminGetRedemptionsPaginated,
};