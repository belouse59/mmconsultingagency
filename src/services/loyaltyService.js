"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { generateToken } = require("./qrService");

const customersPath = path.join(__dirname, "../data/loyalty-customers.json");
const redemptionsPath = path.join(__dirname, "../data/loyalty-redemptions.json");
const offersPath = path.join(__dirname, "../data/loyalty-offers.json");

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) =>
    fs.writeFileSync(file, JSON.stringify(data, null, 2));

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

function register({ identifier, password }) {
    if (!identifier || !password) {
    throw new Error("Missing required fields");
  }

  const customers = read(customersPath);

  const normalizedIdentifier = normalizeIdentifier(identifier);

  const existing = customers.find(
    (c) => c.identifier === normalizedIdentifier
  );

  if (existing) {
    throw new Error("Customer already exists");
  }

  const customer = {
    id: Date.now().toString(),
    identifier: normalizedIdentifier,
    identifierType: detectIdentifierType(normalizedIdentifier),
    passwordHash: hashPassword(password),
    qrToken: generateToken(),
    active: true,
    createdAt: new Date().toISOString(),
  };

  customers.push(customer);
  write(customersPath, customers);

  return {
    success: true,
    customer,
  };
};

function login({ identifier, password }) {
  const customers = read(customersPath);

  const normalizedIdentifier = normalizeIdentifier(identifier);

  const customer = customers.find(
    (c) =>
      c.identifier === normalizedIdentifier &&
      c.passwordHash === hashPassword(password)
  );

  if (!customer) {
    throw new Error("Invalid credentials");
  }

  return {
    success: true,
    customer,
  };
};

function createOffer({ title, description = "" }) {
  const offers = read(offersPath);

  const offer = {
    id: Date.now().toString(),
    title,
    description,
    active: true,
    createdAt: new Date().toISOString(),
  };

  offers.push(offer);
  write(offersPath, offers);

  return offer;
};
function getByToken (token) {
  const customers = read(customersPath);
  return customers.find((c) => c.qrToken === token);
};

function validateRedemption ({ token, offerId, partnerId } = {}) {
  if (!token || !offerId || !partnerId) {
    return {
      success: false,
      message: "Missing token, offerId or partnerId",
    };
  }
  const customer = getByToken(token);

  if (!customer) {
    return {
      success: false,
      message: "Invalid QR code",
    };
  }
  const redemptions = read(redemptionsPath);

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

  redemptions.push(redemption);
  write(redemptionsPath, redemptions);

  return {
    success: true,
    message: "Discount validated",
    customer,
  };
};

function getCustomers() {read(customersPath)};
function getRedemptions() {read(redemptionsPath)};

module.exports = { register, login, getByToken, validateRedemption, getCustomers, getRedemptions, createOffer }