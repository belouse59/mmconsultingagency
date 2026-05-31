"use strict"

const customerRepo    = require("../../repositories/customersRepository");
const offerRepo    = require("../../repositories/offersRepository");
const redemptionRepo    = require("../../repositories/redemptionsRepository");
const partnerRepo    = require("../../repositories/partnersRepository");

async function getRedemptions() {
  return redemptionRepo.getRedemptions();
}

async function getOffers() {
  return offerRepo.getOffers();
}
async function getPartners() {
  return partnerRepo.findPartners();
}

module.exports = { getRedemptions, getOffers, getPartners }