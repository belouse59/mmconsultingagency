"use strict";

const offerRepo = require("../../repositories/offersRepository");
const { makeError } = require("../../utils/errorHandler");
const crypto = require("crypto");

/* ─────────────────────────────────────────────
   GET OFFERS (ALL)
───────────────────────────────────────────── */
async function getOffers() {
  const offers = await offerRepo.findOffers();
  return sanitizeOffers(offers);
}

/* ─────────────────────────────────────────────
   GET ACTIVE OFFERS
───────────────────────────────────────────── */
async function getActiveOffers() {
  const offers = await offerRepo.findActiveOffers();
  return sanitizeOffers(offers);
}

/* ─────────────────────────────────────────────
   GET PARTNER OFFERS
───────────────────────────────────────────── */
async function getPartnerOffers(partnerId) {
  if (!partnerId) {
    throw makeError("partnerId mancante", 400);
  }

  return await offerRepo.findActiveOffersByPartner(partnerId);
}

/* ─────────────────────────────────────────────
   CREATE OFFER
───────────────────────────────────────────── */
async function createOffer({ title, description, partnerId }) {
  if (!title?.trim()) {
    throw makeError("Il titolo dell'offerta è obbligatorio.", 400);
  }

  const id = `offer-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const offer = await offerRepo.createOffer({
    id,
    title: title.trim(),
    description: description || "",
    partnerId,
  });

  return {
    success: true,
    offer,
  };
}

/* ─────────────────────────────────────────────
   SANITIZER (ONLY SERVICE LAYER RESPONSIBILITY)
───────────────────────────────────────────── */
function sanitizeOffers(offers) {
  return offers.map((o) => ({
    ...o,
    title: o.title ? o.title.replace(/'/g, "") : "",
  }));
}

module.exports = {
  getOffers,
  getActiveOffers,
  getPartnerOffers,
  createOffer,
};