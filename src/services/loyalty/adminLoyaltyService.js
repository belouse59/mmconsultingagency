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

const customerRepo   = require("../../repositories/loyalty/customersRepository");
const offerRepo      = require("../../repositories/loyalty/offersRepository");
const redemptionRepo = require("../../repositories/loyalty/redemptionsRepository");
const partnerRepo    = require("../../repositories/loyalty/partnersRepository");

const { buildPaginationMeta } = require("../../utils/paginate");

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
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  // Flat (original)
  getCustomers,
  getOffers,
  getPartners,
  getRedemptions,

  // Single record
  getPartnerById,          // ← new

  // Paginated
  getCustomersPaginated,
  getPartnersPaginated,
  getOffersPaginated,
  getRedemptionsPaginated,
};