"use strict";

/**
 * services/loyalty/adminLoyaltyService.js
 *
 * Changes from previous version:
 *   - Added getPartnerById — returns the full partner record
 *     (sanitized) for the admin edit drawer. The paginated list
 *     response is intentionally lean and does not include
 *     notes/description/offerDescription, so the edit drawer
 *     fetches the full record on open via this method.
 *   - All other methods unchanged.
 */

const customerRepo        = require("../../repositories/loyalty/customersRepository");
const offerRepo           = require("../../repositories/loyalty/offersRepository");
const redemptionRepo      = require("../../repositories/loyalty/redemptionsRepository");
const partnerRepo         = require("../../repositories/loyalty/partnersRepository");
const partnerRequestRepo  = require("../../repositories/loyalty/partnerRequestsRepository");
const newsletterRepo      = require("../../repositories/form/newslettersRepository");
const simulatorRepo       = require("../../repositories/form/simulatorRepository");
const contactRepo         = require("../../repositories/form/contactsRepository");
const contactRequestRepo  = require("../../repositories/form/contactRequestsRepository");

const { buildPaginationMeta }  = require("../../utils/paginate");
const { sendVerificationEmail } = require("../../services/emailService");
const { makeError }             = require("../../utils/errorHandler");

/* ─────────────────────────────────────────────
   INTERNAL HELPERS
───────────────────────────────────────────── */

/**
 * Strip sensitive fields before returning to the controller.
 */
function safe(row) {
  if (!row) return null;
  const { password, passwordHash, ...rest } = row;
  return rest;
}

/* ─────────────────────────────────────────────
   FLAT (existing — unchanged)
   Preserved for internal/non-admin usage.
───────────────────────────────────────────── */

async function getCustomers() {
  const rows = await customerRepo.findCustomers();
  return rows.map(safe);
}

async function getOffers() {
  return await offerRepo.findOffers();
}

async function getPartners() {
  return await partnerRepo.findPartners();
}

async function getRedemptions() {
  return await redemptionRepo.findRedemptions();
}

/* ─────────────────────────────────────────────
   GET PARTNER BY ID  ← NEW
   Full record (sanitized) for the admin edit drawer.

   @param {string} id
   @returns {Partner|null}
───────────────────────────────────────────── */

async function getPartnerById(id) {
  const partner = await partnerRepo.findPartnerById(id);
  return safe(partner);
}

/* ─────────────────────────────────────────────
   PAGINATED (existing — unchanged)
   All four methods follow the same contract:

   Input:  req.pagination (set by paginationMiddleware)
   Output: { data: [...], pagination: { page, limit, totalItems,
             totalPages, hasNext, hasPrevious } }
───────────────────────────────────────────── */

async function getCustomersPaginated(pagination) {
  const { rows, total } = await customerRepo.findCustomersPaginated(pagination);

  return {
    data:       rows.map(safe),
    pagination: buildPaginationMeta({
      page:  pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

async function getPartnersPaginated(pagination) {
  const { rows, total } = await partnerRepo.findPartnersPaginated(pagination);

  return {
    data:       rows.map(safe),
    pagination: buildPaginationMeta({
      page:  pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

async function getOffersPaginated(pagination) {
  const { rows, total } = await offerRepo.findOffersPaginated(pagination);

  return {
    data:       rows,
    pagination: buildPaginationMeta({
      page:  pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

async function getRedemptionsPaginated(pagination) {
  const { rows, total } = await redemptionRepo.findRedemptionsPaginated(pagination);

  return {
    data:       rows,
    pagination: buildPaginationMeta({
      page:  pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

/* ─────────────────────────────────────────────
   PARTNER REQUESTS — PAGINATED  ← NEW
   List-only. Mutations (approve/reject) live in
   partnerRequestLoyaltyService — the same layering
   used for partner create/update.

   @param {{ page, limit, offset, search, sortBy, sortOrder, filters }} pagination
   @returns {{ data: PartnerRequest[], pagination: PaginationMeta }}
───────────────────────────────────────────── */

async function getPartnerRequestsPaginated(pagination) {
  const { rows, total } = await partnerRequestRepo.findPartnerRequestsPaginated(pagination);

  return {
    data:       rows,
    pagination: buildPaginationMeta({
      page:  pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

/* ─────────────────────────────────────────────
   NEWSLETTERS — PAGINATED  ← NEW
───────────────────────────────────────────── */

async function getNewslettersPaginated(pagination) {
  const { rows, total } = await newsletterRepo.findNewslettersPaginated(pagination);

  return {
    data:       rows,
    pagination: buildPaginationMeta({
      page:  pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

/* ─────────────────────────────────────────────
   SIMULATOR LEADS — PAGINATED  ← NEW
───────────────────────────────────────────── */

async function getSimulationsPaginated(pagination) {
  const { rows, total } = await simulatorRepo.findSimulationsPaginated(pagination);

  return {
    data:       rows,
    pagination: buildPaginationMeta({
      page:  pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

/* ─────────────────────────────────────────────
   CONTACT REQUESTS — PAGINATED  ← NEW
   Returns contacts joined with their latest
   contact_request (category, source, message)
   for the admin contact requests view.
───────────────────────────────────────────── */

async function getContactsPaginated(pagination) {
  const { rows, total } = await contactRepo.findContactsPaginated(pagination);

  return {
    data:       rows,
    pagination: buildPaginationMeta({
      page:  pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   GET CUSTOMER BY ID  ← NEW
   Full record for the admin edit drawer.
───────────────────────────────────────────── */

async function getCustomerById(id) {
  const customer = await customerRepo.findCustomerById(id);
  return safe(customer);
}

/* ─────────────────────────────────────────────
   UPDATE CUSTOMER  ← NEW
───────────────────────────────────────────── */

async function updateCustomer(id, fields = {}) {
  const customer = await customerRepo.findCustomerById(id);

  if (!customer) {
    throw makeError("Cliente non trovato.", 404);
  }

  const updated = await customerRepo.updateCustomer(id, {
    full_name: fields.full_name?.trim() || customer.full_name,
  });

  return { success: true, customer: safe(updated) };
}

/* ─────────────────────────────────────────────
   GET OFFER BY ID  ← NEW
───────────────────────────────────────────── */

async function getOfferById(id) {
  const offer = await offerRepo.findOfferById(id);
  return offer;
}

/* ─────────────────────────────────────────────
   UPDATE OFFER  ← NEW
───────────────────────────────────────────── */

async function updateOffer(id, fields = {}) {
  const offer = await offerRepo.findOfferById(id);

  if (!offer) {
    throw makeError("Offerta non trovata.", 404);
  }

  const updated = await offerRepo.updateOffer(id, {
    title:       fields.title?.trim()       || offer.title,
    description: fields.description?.trim() ?? offer.description,
    active:      fields.active !== undefined ? Boolean(fields.active) : offer.active,
  });

  return { success: true, offer: updated };
}

/* ─────────────────────────────────────────────
   CUSTOMER ACTIONS  (existing — unchanged)
───────────────────────────────────────────── */

/**
 * Activate or suspend a customer account.
 * Mirrors partnerLoyaltyService.setPartnerActive.
 */
async function setCustomerActive(customerId, active) {
  const customer = await customerRepo.findCustomerById(customerId);

  if (!customer) {
    throw makeError("Cliente non trovato.", 404);
  }

  const updated = await customerRepo.setCustomerActive(customerId, Boolean(active));

  return { success: true, customer: safe(updated) };
}

/**
 * Resend the verification email to a customer who hasn't
 * verified yet. No-op (returns a clear message) if already
 * verified — avoids spamming someone who doesn't need it.
 */
async function resendCustomerVerification(customerId) {
  const customer = await customerRepo.findCustomerById(customerId);

  if (!customer) {
    throw makeError("Cliente non trovato.", 404);
  }

  if (customer.verified) {
    return { success: true, message: "Il cliente è già verificato." };
  }

  await sendVerificationEmail(customer.identifier, "loyalty/customer", customer.full_name);

  return { success: true, message: "Email di verifica inviata." };
}

/* ─────────────────────────────────────────────
   PARTNER ACTIONS  ← NEW
───────────────────────────────────────────── */

/**
 * Force a partner to change their password on next login.
 * Does not touch the existing password hash — the partner
 * can still log in with their current password, then is
 * redirected to the set-password flow (mustChangePassword
 * is already checked by requirePartnerSetPasswordPage).
 */
async function forcePartnerPasswordReset(partnerId) {
  const partner = await partnerRepo.findPartnerById(partnerId);

  if (!partner) {
    throw makeError("Partner non trovato.", 404);
  }

  await partnerRepo.forcePasswordReset(partnerId);

  return { success: true, message: "Il partner dovrà impostare una nuova password al prossimo accesso." };
}

/* ─────────────────────────────────────────────
   PARTNER REQUEST ACTIONS  ← NEW
───────────────────────────────────────────── */

/**
 * Archive a partner request (pending or rejected).
 * Reversible from the database if needed — no hard delete.
 */
async function archivePartnerRequest(requestId) {
  const request = await partnerRequestRepo.findPartnerRequestById(requestId);

  if (!request) {
    throw makeError("Richiesta non trovata.", 404);
  }

  const updated = await partnerRequestRepo.updatePartnerRequestStatus({
    id:                 requestId,
    status:             "archived",
    reviewedBy:         request.reviewedBy,
    reviewNotes:        request.reviewNotes,
    convertedPartnerId: request.convertedPartnerId,
  });

  return { success: true, request: updated };
}

/* ─────────────────────────────────────────────
   CONTACT REQUEST ACTIONS  ← NEW
───────────────────────────────────────────── */

/**
 * Mark a contact request as contacted by an admin.
 * Records which admin performed the action via adminEmail.
 */
async function markContactRequestContacted(requestId, adminEmail) {
  const request = await contactRequestRepo.findById(requestId);

  if (!request) {
    throw makeError("Richiesta non trovata.", 404);
  }

  const updated = await contactRequestRepo.markContacted(requestId, adminEmail);

  return { success: true, request: updated };
}

/**
 * Archive a contact request. Reversible from the database.
 */
async function archiveContactRequest(requestId) {
  const request = await contactRequestRepo.findById(requestId);

  if (!request) {
    throw makeError("Richiesta non trovata.", 404);
  }

  const updated = await contactRequestRepo.archiveContactRequest(requestId);

  return { success: true, request: updated };
}

/**
 * Resend the verification email for the contact linked to
 * this contact_request. No-op if the contact is already
 * verified.
 */
async function resendContactVerification(contactId) {
  const contact = await contactRepo.findById(contactId);

  if (!contact) {
    throw makeError("Contatto non trovato.", 404);
  }

  if (contact.verified) {
    return { success: true, message: "Il contatto è già verificato." };
  }

  await sendVerificationEmail(contact.email, "form", contact.firstName);

  return { success: true, message: "Email di verifica inviata." };
}

/* ─────────────────────────────────────────────
   NEWSLETTER ACTIONS  ← NEW
───────────────────────────────────────────── */

/**
 * Soft-delete a newsletter subscription. Reuses the existing
 * unsubscribe() repository method — sets subscribed=false and
 * unsubscribed_at=NOW(), which is exactly the GDPR-purge-ready
 * pattern: rows can later be hard-deleted in bulk directly from
 * the database based on unsubscribed_at age, without any admin
 * console changes needed for that purge.
 */
async function deleteNewsletterSubscription(email) {
  const existing = await newsletterRepo.findByEmail(email);

  if (!existing) {
    throw makeError("Iscrizione non trovata.", 404);
  }

  const updated = await newsletterRepo.unsubscribe(email);

  return { success: true, subscription: updated };
}

/**
 * Resend the verification email for a newsletter subscriber.
 * No-op if already verified.
 */
async function resendNewsletterVerification(email) {
  const subscription = await newsletterRepo.findByEmail(email);

  if (!subscription) {
    throw makeError("Iscrizione non trovata.", 404);
  }

  if (subscription.verified) {
    return { success: true, message: "L'iscritto è già verificato." };
  }

  await sendVerificationEmail(email, "form", "");

  return { success: true, message: "Email di verifica inviata." };
}

/* ─────────────────────────────────────────────
   SIMULATOR ACTIONS  ← NEW
───────────────────────────────────────────── */

/**
 * Mark a simulator lead as contacted by an admin.
 */
async function markSimulationContacted(simulationId, adminEmail) {
  const updated = await simulatorRepo.markContacted(simulationId, adminEmail);

  if (!updated) {
    throw makeError("Simulazione non trovata.", 404);
  }

  return { success: true, simulation: updated };
}

/**
 * Archive (soft-delete) a simulator lead. Excluded from the
 * default list view but never hard-deleted.
 */
async function archiveSimulation(simulationId) {
  const updated = await simulatorRepo.archiveSimulation(simulationId);

  if (!updated) {
    throw makeError("Simulazione non trovata.", 404);
  }

  return { success: true, simulation: updated };
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  // Flat (original)
  getCustomers,
  getOffers,
  getPartners,
  getRedemptions,

  // Single record
  getPartnerById,
  getCustomerById,   // ← new
  getOfferById,      // ← new

  // Paginated
  getCustomersPaginated,
  getPartnersPaginated,
  getOffersPaginated,
  getRedemptionsPaginated,
  getPartnerRequestsPaginated,
  getNewslettersPaginated,
  getSimulationsPaginated,
  getContactsPaginated,

  // Customer actions
  setCustomerActive,
  resendCustomerVerification,
  updateCustomer,     // ← new

  // Partner actions
  forcePartnerPasswordReset,

  // Offer actions
  updateOffer,        // ← new

  // Partner request actions
  archivePartnerRequest,

  // Contact request actions
  markContactRequestContacted,
  archiveContactRequest,
  resendContactVerification,

  // Newsletter actions
  deleteNewsletterSubscription,
  resendNewsletterVerification,

  // Simulator actions
  markSimulationContacted,
  archiveSimulation,
};