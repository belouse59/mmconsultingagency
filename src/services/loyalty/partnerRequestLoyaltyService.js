"use strict";

/**
 * services/loyalty/partnerRequestLoyaltyService.js
 *
 * Owns the partner onboarding request lifecycle:
 *
 *   landing page submit ──► pending request
 *                              │
 *              ┌───────────────┴───────────────┐
 *              ▼                                ▼
 *          approveRequest()              rejectRequest()
 *              │                                │
 *   partnerLoyaltyService.createPartner()   status = 'rejected'
 *   status = 'approved'                     reviewNotes saved
 *   convertedPartnerId = new partner id
 *
 * approveRequest() deliberately reuses
 * partnerLoyaltyService.createPartner() — the exact same function
 * the admin partner creation drawer calls — so a request becomes a
 * real partner through the same validated path (category whitelist,
 * email format, password rules, identifier bug fix, etc.).
 */

const partnerRequestRepo    = require("../../repositories/loyalty/partnerRequestsRepository");
const partnerLoyaltyService = require("./partnerLoyaltyService");

const { makeError }      = require("../../utils/errorHandler");
const { clean }          = require("../../utils/sanitizer");
const { generateUUID }   = require("../../utils/generateUUID");
const { notifyPartnerRequest } = require("../emailService");

const { PARTNER_CATEGORIES } = partnerLoyaltyService;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function validateCategory(category) {
  if (!category?.trim()) {
    throw makeError("La categoria è obbligatoria.", 400);
  }
  if (!PARTNER_CATEGORIES.includes(category.trim())) {
    throw makeError("Categoria non valida.", 400);
  }
}

function validateEmail(email) {
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    throw makeError("Email non valida.", 400);
  }
}

/**
 * Normalizes an optional string:
 *   undefined → undefined
 *   null/""   → null
 *   "value"   → clean("value").trim()
 */
function normalizeOptional(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = clean(String(value)).trim();
  return trimmed === "" ? null : trimmed;
}

/* ─────────────────────────────────────────────
   SUBMIT REQUEST
   Public, unauthenticated. Called from the loyalty
   landing page "Richiedi di diventare Partner" form.

   @param {{
     businessName: string,
     vatNumber?:    string,
     email:        string,
     phone?:        string,
     category:     string,
     description?:  string,
   }} payload
   @returns {{ success: true, id: string }}
───────────────────────────────────────────── */

async function submitRequest({
  businessName,
  vatNumber,
  email,
  phone,
  category,
  description,
}) {
  if (!businessName?.trim()) {
    throw makeError("Il nome dell'attività è obbligatorio.", 400);
  }

  validateEmail(email);
  validateCategory(category);

  const request = await partnerRequestRepo.createPartnerRequest({
    id:           generateUUID('pr'),
    businessName: clean(businessName).trim(),
    vatNumber:    normalizeOptional(vatNumber),
    email:        clean(email).toLowerCase().trim(),
    phone:        normalizeOptional(phone),
    category:     clean(category).trim(),
    description:  normalizeOptional(description),
    source:       "landing_page",
  });

  // Best-effort admin notification — never blocks the response.
  // notifyPartnerRequest already catches its own errors internally
  // (see emailService.js), but we guard here too in case that
  // contract changes in the future.
  notifyPartnerRequest(request).catch(() => {});

  return {
    success: true,
    id:      request.id,
  };
}

/* ─────────────────────────────────────────────
   APPROVE REQUEST
   Admin-only. Converts a pending request into a
   live partner via partnerLoyaltyService.createPartner().

   `overrides` contains the fields the admin filled in
   the approval drawer (id, tempPassword, plus any edits
   to the business/contact/location fields). Request
   fields are used as fallbacks where the admin left a
   field empty, so the admin only has to fill in what's
   missing (id, tempPassword) for a quick approval.

   @param {string} requestId
   @param {object} overrides — see partnerLoyaltyService.createPartner
                                 (id and tempPassword are required)
   @param {string|null} adminEmail — for reviewedBy
   @returns {{ success: true, partnerId: string, request: PartnerRequest }}
───────────────────────────────────────────── */

async function approveRequest(requestId, overrides = {}, adminEmail = null) {
  if (!requestId) {
    throw makeError("ID richiesta mancante.", 400);
  }

  const request = await partnerRequestRepo.findPartnerRequestById(requestId);

  if (!request) {
    throw makeError("Richiesta non trovata.", 404);
  }

  if (request.status !== "pending") {
    throw makeError("Questa richiesta è già stata gestita.", 409);
  }

  if (!overrides.tempPassword) {
    throw makeError(
      "La password temporanea è obbligatoria per approvare la richiesta.",
      400
    );
  }

  // Build the createPartner payload: admin overrides win,
  // otherwise fall back to the original request fields.
  // `id` is intentionally absent — partnerLoyaltyService.createPartner()
  // generates it server-side from the business name.
  const createResult = await partnerLoyaltyService.createPartner({
    name:             overrides.name             || request.businessName,
    legalName:        overrides.legalName,
    vatNumber:        overrides.vatNumber        || request.vatNumber,
    email:            overrides.email            || request.email,
    phone:            overrides.phone            || request.phone,
    website:          overrides.website,
    category:         overrides.category         || request.category,
    address:          overrides.address,
    city:             overrides.city,
    postalCode:       overrides.postalCode,
    description:      overrides.description,
    offerDescription: overrides.offerDescription || request.description,
    notes:            overrides.notes,
    tempPassword:     overrides.tempPassword,
  });

  const updatedRequest = await partnerRequestRepo.updatePartnerRequestStatus({
    id:                 requestId,
    status:             "approved",
    reviewedBy:         adminEmail,
    reviewNotes:        normalizeOptional(overrides.reviewNotes) || null,
    convertedPartnerId: createResult.partnerId,
  });

  return {
    success:   true,
    partnerId: createResult.partnerId,
    request:   updatedRequest,
  };
}

/* ─────────────────────────────────────────────
   REJECT REQUEST
   Admin-only. Marks a pending request as rejected.
   Creates nothing.

   @param {string} requestId
   @param {{ reviewNotes?: string }} payload
   @param {string|null} adminEmail — for reviewedBy
   @returns {{ success: true, request: PartnerRequest }}
───────────────────────────────────────────── */

async function rejectRequest(requestId, { reviewNotes } = {}, adminEmail = null) {
  if (!requestId) {
    throw makeError("ID richiesta mancante.", 400);
  }

  const request = await partnerRequestRepo.findPartnerRequestById(requestId);

  if (!request) {
    throw makeError("Richiesta non trovata.", 404);
  }

  if (request.status !== "pending") {
    throw makeError("Questa richiesta è già stata gestita.", 409);
  }

  const updatedRequest = await partnerRequestRepo.updatePartnerRequestStatus({
    id:                 requestId,
    status:             "rejected",
    reviewedBy:         adminEmail,
    reviewNotes:        normalizeOptional(reviewNotes) || null,
    convertedPartnerId: null,
  });

  return {
    success: true,
    request: updatedRequest,
  };
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  submitRequest,
  approveRequest,
  rejectRequest,
};