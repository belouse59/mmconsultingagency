"use strict";

const crypto = require("crypto");

const { redisClient: redis } = require("../../utils/redis");
const { verifyQrToken } = require("../qrService");

const redemptionRepo = require("../../repositories/loyalty/redemptionsRepository");
const offerRepo = require("../../repositories/loyalty/offersRepository");
const customerRepo = require("../../repositories/loyalty/customersRepository");

/* ─────────────────────────────────────────────────────────────
   QR VALIDATION + PREVALIDATION
───────────────────────────────────────────────────────────── */

async function prevalidateQr({ token, partnerId } = {}) {
  if (!token || !partnerId) {
    return {
      success: false,
      code: "MISSING_DATA",
      message: "Dati mancanti.",
    };
  }

  /* 1. QR VERIFY */
  const check = verifyQrToken(token);

  if (!check.valid) {
    const messages = {
      TOKEN_MISSING: "QR mancante.",
      TOKEN_MALFORMED: "QR non valido.",
      TOKEN_INVALID_SIGNATURE: "QR non autentico.",
      TOKEN_EXPIRED: "QR scaduto. Chiedi al cliente di aggiornare il QR.",
    };

    return {
      success: false,
      code: check.reason,
      message: messages[check.reason] || "QR non valido.",
      expiresAt: null,
    };
  }

  const { customerId, exp } = check;

  /* 2. LOAD DATA IN PARALLEL VIA REPOS */
  const [customer, offers, usedOffers] = await Promise.all([
    customerRepo.findCustomerById(customerId),
    offerRepo.findActiveOffersByPartner(partnerId),
    redemptionRepo.findCustomerPartnerRedemptions(customerId, partnerId),
  ]);

  if (!customer) {
    return {
      success: false,
      code: "CUSTOMER_NOT_FOUND",
      message: "Cliente non trovato.",
      expiresAt: null,
    };
  }

  if (!customer.active) {
    return {
      success: false,
      code: "CUSTOMER_SUSPENDED",
      message: "Account cliente sospeso.",
      expiresAt: null,
    };
  }

  const usedSet = new Set(usedOffers);

  const eligibleOffers = offers.map((offer) => ({
    id: offer.id,
    title: offer.title,
    description: offer.description,
    eligible: !usedSet.has(offer.id),
    createdAt: offer.createdAt,
    reason: usedSet.has(offer.id) ? "Già utilizzata" : null,
  }));

  return {
    success: true,
    customerId,
    customerName: customer.full_name,
    expiresAt: exp,
    eligibleOffers,
  };
}

/* ─────────────────────────────────────────────────────────────
   REDEEM OFFER (ATOMIC FLOW)
───────────────────────────────────────────────────────────── */

async function redeemOffer({ token, offerId, partnerId, idempotencyKey } = {}) {
  if (!token || !offerId || !partnerId) {
    return {
      success: false,
      code: "MISSING_DATA",
      message: "Dati mancanti.",
    };
  }

  /* 1. VERIFY QR */
  const check = verifyQrToken(token);

  if (!check.valid) {
    return {
      success: false,
      code: check.reason,
      message: "QR non valido.",
    };
  }

  const customerId = String(check.customerId).trim();

  /* 2. SHORT LOCK (ANTI DOUBLE SCAN) */
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const lockKey = `mm:scan:${tokenHash}:${offerId}`;

  const locked = await redis.set(lockKey, "1", {
    nx: true,
    ex: 5,
  });

  if (!locked) {
    return {
      success: false,
      code: "SCAN_IN_PROGRESS",
      message: "Scansione già in corso.",
    };
  }

  try {
    /* 3. LOAD DATA VIA REPOS */
    const [customer, offer] = await Promise.all([
      customerRepo.findCustomerById(customerId),
      offerRepo.findActiveOfferById(offerId),
    ]);

    if (!customer) {
      return {
        success: false,
        code: "CUSTOMER_NOT_FOUND",
        message: "Cliente non trovato.",
      };
    }

    if (!customer.active) {
      return {
        success: false,
        code: "CUSTOMER_SUSPENDED",
        message: "Account cliente sospeso.",
      };
    }

    if (!offer || !offer.active) {
      return {
        success: false,
        code: "OFFER_INVALID",
        message: "Offerta non valida.",
      };
    }

    /* 4. INSERT REDEMPTION (DB GUARANTEE UNIQUE INDEX) */
    const redemption = await redemptionRepo.createRedemption({
      id: idempotencyKey,
      customerId,
      partnerId,
      offerId,
      usedToken: token,
    });

    return {
      success: true,
      redemptionId: redemption.id,
      customerName: customer.full_name,
      offerTitle: offer.title,
      redeemedAt: redemption.redeemedAt,
    };

  } catch (err) {
    if (err.code === "23505") {
      return {
        success: false,
        code: "ALREADY_REDEEMED",
        message: "Offerta già utilizzata.",
      };
    }
    throw err;

  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}

module.exports = {
  prevalidateQr,
  redeemOffer,
};