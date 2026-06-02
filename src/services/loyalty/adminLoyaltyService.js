"use strict";

const customerRepo   = require("../../repositories/customersRepository");
const offerRepo      = require("../../repositories/offersRepository");
const redemptionRepo = require("../../repositories/redemptionsRepository");
const partnerRepo    = require("../../repositories/partnersRepository");
const { hashPassword } = require("../../utils/argon2");

/* ─────────────────────────────────────────────
   INTERNAL MAPPERS (IMPORTANT FOR CONSISTENCY)
───────────────────────────────────────────── */

function safe(row) {
  if (!row) return null;
  const {password, ...rest} = row;
  return rest;
}


/* ─────────────────────────────────────────────
   ADMIN — CUSTOMERS
───────────────────────────────────────────── */

async function getCustomers() {
  const rows = await customerRepo.findCustomers();
  return rows.map(safe);
}

/* ─────────────────────────────────────────────
   ADMIN — OFFERS
───────────────────────────────────────────── */

async function getOffers() {
  return await offerRepo.findOffers();
}

/* ─────────────────────────────────────────────
   ADMIN — PARTNERS
───────────────────────────────────────────── */

async function getPartners() {
  return await partnerRepo.findPartners();
}

/* ─────────────────────────────────────────────
   ADMIN — REDEMPTIONS
───────────────────────────────────────────── */

async function getRedemptions() {
  return await redemptionRepo.findRedemptions();
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  getCustomers,
  getOffers,
  getPartners,
  getRedemptions,
};