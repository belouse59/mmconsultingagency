"use strict";

const { appendRow, getSheetValues } = require("../services/sheetsService");
const crypto = require("crypto");
const { generateQrToken } = require("./qrService");

// Sheet tab names
const CUSTOMERS_SHEET = "Customers";
const REDENTIONS_SHEET = "Redemptions";
const OFFERS_SHEET = "Offers";

const hashPassword = (password) =>
  crypto.createHash("sha256").update(password).digest("hex");

const detectIdentifierType = (identifier) => {
  return identifier.includes("@") ? "email" : "phone";
};

const normalizeIdentifier = (identifier) => {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return trimmed.replace(/[^\d+]/g, "");
};

//
// =====================
// HELPERS (SHEETS READ)
// =====================
//
function stripHeader(rows) {
  if (!rows || rows.length === 0) return [];
  return rows.slice(1);
}

async function readCustomers() {
  const rows = stripHeader(await getSheetValues(CUSTOMERS_SHEET));
  return rows.map((r) => ({
    id: r[0],
    identifier: r[1],
    identifierType: r[2],
    passwordHash: r[3],
    qrToken: r[4],
    active: r[5] === "true" || r[5] === "TRUE",
    createdAt: r[6],
  }));
}

async function readOffers() {
  const rows = stripHeader(await getSheetValues(OFFERS_SHEET));
  return rows.map((r) => ({
    id: r[0],
    title: r[1],
    description: r[2],
    active: r[3] === "true",
    createdAt: r[4],
  }));
}

async function readRedemptions() {
  const rows = stripHeader(await getSheetValues(REDENTIONS_SHEET));
  return rows.map((r) => ({
    id: r[0],
    customerId: r[1],
    partnerId: r[2],
    offerId: r[3],
    date: r[4],
    createdAt: r[5],
  }));
}

//
// =====================
// CORE FUNCTIONS
// =====================
//

async function register({ full_name, identifier, password }) {
  if (!full_name || !identifier || !password) {
    throw new Error("Missing required fields");
  }

  const customers = await readCustomers();

  const normalizedIdentifier = normalizeIdentifier(identifier);

  const existing = customers.find(
    (c) => c.identifier === normalizedIdentifier
  );

  if (existing) {
    throw new Error("Customer already exists");
  }

  const customer = {
    id: Date.now().toString(),
    full_name: full_name,
    identifier: normalizedIdentifier,
    identifierType: detectIdentifierType(normalizedIdentifier),
    passwordHash: hashPassword(password),
    qrToken: generateQrToken(),
    active: true,
    createdAt: new Date().toISOString(),
  };

  await appendRow(CUSTOMERS_SHEET, [
    customer.id,
    customer.identifier,
    customer.identifierType,
    customer.passwordHash,
    customer.qrToken,
    customer.active,
    customer.createdAt,
  ]);

  return { success: true, customer };
}

async function login({ identifier, password }) {
  const customers = await readCustomers();

  const normalizedIdentifier = normalizeIdentifier(identifier);

  const customer = customers.find(
    (c) =>
      c.identifier === normalizedIdentifier &&
      c.passwordHash === hashPassword(password)
  );

  if (!customer) {
    throw new Error("Invalid credentials");
  }

  return { success: true, customer };
}

async function createOffer({ title, description = "" }) {
  const offer = {
    id: Date.now().toString(),
    title,
    description,
    active: true,
    createdAt: new Date().toISOString(),
  };

  await appendRow(OFFERS_SHEET, [
    offer.id,
    offer.title,
    offer.description,
    offer.active,
    offer.createdAt,
  ]);

  return offer;
}

async function getByToken(token) {
  const customers = await readCustomers();
  return customers.find((c) => c.qrToken === token);
}

async function validateRedemption({ token, offerId, partnerId } = {}) {
  if (!token || !offerId || !partnerId) {
    return {
      success: false,
      message: "Missing token, offerId or partnerId",
    };
  }

  const customer = await getByToken(token);

  if (!customer) {
    return {
      success: false,
      message: "Invalid QR code",
    };
  }

  const redemptions = await readRedemptions();

  const today = new Date().toISOString().slice(0, 10);

  const existingRedemption = redemptions.find(
    (r) =>
      r.customerId === customer.id &&
      r.offerId === offerId &&
      r.date === today
  );

  if (existingRedemption) {
    return {
      success: false,
      message: "Offer already redeemed today",
    };
  }

  const redemption = {
    id: Date.now().toString(),
    customerId: customer.id,
    partnerId,
    offerId,
    date: today,
    createdAt: new Date().toISOString(),
  };

  await appendRow(REDENTIONS_SHEET, [
    redemption.id,
    redemption.customerId,
    redemption.partnerId,
    redemption.offerId,
    redemption.date,
    redemption.createdAt,
  ]);

  return {
    success: true,
    message: "Discount validated",
    customer,
  };
}

//
// =====================
// EXPORTS
// =====================
//

module.exports = {
  register,
  login,
  getByToken,
  validateRedemption,
  createOffer,
  getCustomers: readCustomers,
  getRedemptions: readRedemptions,
};