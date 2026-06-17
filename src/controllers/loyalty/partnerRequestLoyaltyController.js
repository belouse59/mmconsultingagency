"use strict";

/**
 * controllers/loyalty/partnerRequestController.js
 *
 * Public, unauthenticated controller for the loyalty landing
 * page "Richiedi di diventare Partner" form.
 *
 * Mounted directly on the top-level loyalty router (sibling of
 * /customer, /partner, /admin) — see routes/loyalty.js:
 *
 *   POST /api/loyalty/partner-request
 *
 * Maps the landing page's snake_case payload to the camelCase
 * contract expected by partnerRequestLoyaltyService.submitRequest().
 */

const partnerRequestLoyaltyService =
  require("../../services/loyalty/partnerRequestLoyaltyService");

const { clean } = require("../../utils/sanitizer");
const { asyncHandler } = require("./helper");

/* ─────────────────────────────────────────────
   SUBMIT PARTNER REQUEST
───────────────────────────────────────────── */

const submitPartnerRequest = asyncHandler(async (req, res) => {
  const {
    business_name,
    vat,
    email,
    phone,
    category,
    description,
  } = req.body;

  await partnerRequestLoyaltyService.submitRequest({
    businessName: clean(business_name || ""),
    vatNumber:    clean(vat || ""),
    email:        clean(email || ""),
    phone:        clean(phone || ""),
    category:     clean(category || ""),
    description:  clean(description || ""),
  });

  // Generic message — no internal IDs are returned to the public.
  return res.status(201).json({
    success: true,
    message: "Richiesta inviata con successo. Ti contatteremo presto.",
  });
});

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  submitPartnerRequest,
};