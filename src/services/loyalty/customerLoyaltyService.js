"use strict"

const customerRepo                        = require("../../repositories/customersRepository");
const { hashPassword, verifyPassword }    = require("../../utils/argon2");
const { generateCustomerId }              = require("../qrService");
const { makeError }                       = require("../../utils/errorHandler");
const { clean }                           = require("../../utils/sanitizer");


async function getCustomers() {
  return customerRepo.findCustomers();
}

async function getActiveCustomers() {
  return customerRepo.findActiveCustomers();
}

async function getCustomerByIdentifier(identfier) {
  return customerRepo.findCustomerByIdentifier(identfier);
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER — REGISTER
───────────────────────────────────────────────────────────── */

/**
 * Register a new customer.
 * Returns { success: true, customerId } or throws with a safe message.
 */
async function register({ full_name, identifier, password }) {
  if (!full_name?.trim() || !identifier?.trim() || !password) {
    throw makeError("Tutti i campi sono obbligatori.", 400);
  }

  if (password.length < 8) {
    throw makeError("La password deve avere almeno 8 caratteri.", 400);
  }

  const normalized = normalizeIdentifier(identifier);
  const hash = await hashPassword(password);
  const customerId = generateCustomerId();
  const nowIso = new Date().toISOString();

  const identifierType = detectIdentifierType(normalized);

  /* ─────────────────────────────────────────────
     1. INSERT (DB IS SOURCE OF TRUTH)
     Handles race conditions via UNIQUE constraint
  ───────────────────────────────────────────── */
  const result = await customerRepo.createCustomer(customerId, clean(full_name), normalized, identifierType, hash, true);
  /* ─────────────────────────────────────────────
     3. RESPONSE
  ───────────────────────────────────────────── */
  return result;
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER - LOGIN
───────────────────────────────────────────────────────────── */

/**
 * Authenticate a customer.
 * Returns { success: true, customerId, full_name } or throws.
 * Uses constant-time comparison to prevent timing attacks.
 */
async function login({ identifier, password }) {
  if (!identifier?.trim() || !password) {
    throw makeError("Credenziali non valide.", 401);
  }

  const normalized = normalizeIdentifier(identifier);
  const customer  = await customerRepo.findCustomerByIdentifier(normalized);
  const match = await verifyPassword(password, customer);

  if (!customer || !match) throw makeError("Credenziali non valide.", 401);


  if (!customer.active) throw makeError("Account sospeso. Contatta il supporto.", 403);

  return {
    success:    true,
    customerId: customer.id,
    full_name:  customer.full_name,
  };
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

function normalizeIdentifier(identifier) {
  const trimmed = identifier.trim().toLowerCase();
  return trimmed.includes("@")
    ? trimmed
    : trimmed.replace(/[^\d+]/g, "");
}

function detectIdentifierType(identifier) {
  return identifier.includes("@") ? "email" : "phone";
}

module.exports = {
  register,
  login,
  getCustomers,
  getCustomerByIdentifier,
  getActiveCustomers
};