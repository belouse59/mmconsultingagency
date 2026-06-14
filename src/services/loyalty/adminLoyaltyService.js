"use strict";

/**
 * services/loyalty/adminLoyaltyService.js
 *
 * Changes from original:
 *   - Removed unused `hashPassword` import
 *   - Added getCustomersPaginated, getPartnersPaginated,
 *     getOffersPaginated, getRedemptionsPaginated
 *   - All paginated methods use shared buildPaginationMeta utility
 *   - Original flat methods (getCustomers, etc.) preserved unchanged
 *     for any internal callers that do not need pagination
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
 * Matches original safe() behaviour.
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
   PAGINATED  ← NEW
   All four methods follow the same contract:

   Input:  req.pagination (set by paginationMiddleware)
   Output: { data: [...], pagination: { page, limit, totalItems,
             totalPages, hasNext, hasPrevious } }

   The service is responsible for:
     1. Calling the paginated repository method
     2. Sanitising sensitive fields
     3. Building the pagination envelope
   The controller simply passes req.pagination through.
───────────────────────────────────────────── */

/**
 * @param {{ page, limit, offset, search, sortBy, sortOrder, filters }} pagination
 * @returns {{ data: Customer[], pagination: PaginationMeta }}
 */
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

/**
 * @param {{ page, limit, offset, search, sortBy, sortOrder, filters }} pagination
 * @returns {{ data: Partner[], pagination: PaginationMeta }}
 */
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

/**
 * @param {{ page, limit, offset, search, sortBy, sortOrder, filters }} pagination
 * @returns {{ data: Offer[], pagination: PaginationMeta }}
 */
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

/**
 * @param {{ page, limit, offset, search, sortBy, sortOrder, filters }} pagination
 * @returns {{ data: Redemption[], pagination: PaginationMeta }}
 */
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

  // Paginated (new)
  getCustomersPaginated,
  getPartnersPaginated,
  getOffersPaginated,
  getRedemptionsPaginated,
};