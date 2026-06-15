"use strict";

const partnerRepo = require("../../repositories/loyalty/partnersRepository");

const {
  hashPassword,
  verifyPassword,
} = require("../../utils/argon2");

const { makeError } = require("../../utils/errorHandler");
const { generateUUID } = require("../../utils/generateUUID");
const { clean }     = require("../../utils/sanitizer");

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

/**
 * Fixed category whitelist.
 *
 * Matches the categories offered on the loyalty landing page
 * partner request form (public/loyalty/index.html → #pf-category)
 * so that a partner created here always corresponds to a category
 * the public-facing form could also produce.
 */
const PARTNER_CATEGORIES = [
  "ristorante",
  "bar",
  "palestra",
  "negozio",
  "servizi",
  "beauty",
  "altro",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function normalizePartnerId(value = "") {
  return clean(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

function validatePassword(password, field = "password") {
  if (!password || password.length < 8) {
    throw makeError(
      field === "temp"
        ? "La password temporanea deve avere almeno 8 caratteri."
        : "La nuova password deve avere almeno 8 caratteri.",
      400
    );
  }
}

/**
 * Category is mandatory for both create and update.
 */
function validateCategory(category) {
  if (!category?.trim()) {
    throw makeError("La categoria è obbligatoria.", 400);
  }

  if (!PARTNER_CATEGORIES.includes(category.trim())) {
    throw makeError("Categoria non valida.", 400);
  }
}

/**
 * Email is optional everywhere — only validated when provided.
 */
function validateEmail(email) {
  if (!email) return;

  if (!EMAIL_RE.test(email)) {
    throw makeError("Email non valida.", 400);
  }
}

/**
 * Normalizes an optional string field for storage:
 *   - undefined → undefined  (field untouched — for partial updates)
 *   - null      → null
 *   - ""        → null       (explicitly cleared)
 *   - "value"   → clean("value")
 */
function normalizeOptional(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = clean(String(value)).trim();
  return trimmed === "" ? null : trimmed;
}

/* ─────────────────────────────────────────────
   GET PARTNERS (flat — existing, unchanged)
───────────────────────────────────────────── */

async function getPartners() {
  const partners = await partnerRepo.findPartners();

  return partners.map((partner) => ({
    id:                 partner.id,
    name:               partner.name,
    category:           partner.category,
    address:            partner.address,
    active:             partner.active,
    mustChangePassword: Boolean(partner.mustChangePassword),
    createdAt:          partner.createdAt,
  }));
}

/* ─────────────────────────────────────────────
   CREATE PARTNER
   Extended with business / contact / location /
   loyalty-program fields collected by the admin
   partner creation drawer.
───────────────────────────────────────────── */

async function createPartner({
  id,
  name,
  legalName,
  vatNumber,
  email,
  phone,
  website,
  category,
  address,
  city,
  postalCode,
  description,
  offerDescription,
  notes,
  tempPassword,
}) {
  if (!name?.trim() || !tempPassword) {
    throw makeError(
      "ID, nome e password temporanea sono obbligatori.",
      400
    );
  }

  validatePassword(tempPassword, "temp");
  validateCategory(category);

  const normalizedEmail = email
    ? clean(email).toLowerCase().trim()
    : null;

  validateEmail(normalizedEmail);

  const partnerId    = generateUUID('p')
  const passwordHash = await hashPassword(tempPassword);

  try {
    await partnerRepo.createPartner({
      id:               partnerId,
      name:             clean(name).trim(),
      legalName:        normalizeOptional(legalName),
      vatNumber:        normalizeOptional(vatNumber),
      email:            normalizedEmail,
      phone:            normalizeOptional(phone),
      website:          normalizeOptional(website),
      category:         clean(category).trim(),
      address:          normalizeOptional(address),
      city:             normalizeOptional(city),
      postalCode:       normalizeOptional(postalCode),
      description:      normalizeOptional(description),
      offerDescription: normalizeOptional(offerDescription),
      notes:            normalizeOptional(notes),
      passwordHash,
    });

  } catch (err) {
    if (err.code === "23505") {
      throw makeError("Un partner con questo ID esiste già.", 409);
    }
    throw err;
  }

  return {
    success:   true,
    partnerId,
  };
}

/* ─────────────────────────────────────────────
   UPDATE PARTNER  ← NEW
   Partial update of business / contact / location /
   loyalty-program / admin fields, plus active status.

   NOT editable here (by design — separate flows exist):
     - id                (immutable after creation)
     - password          (setPartnerPassword)
     - mustChangePassword (set internally on password change)

   @param {string} partnerId
   @param {object} fields — any subset of:
     name, legalName, vatNumber, category,
     email, phone, website,
     address, city, postalCode,
     description, offerDescription, notes,
     active
   @returns {{ success: true, partner: Partner }}
───────────────────────────────────────────── */

async function updatePartner(partnerId, fields = {}) {
  if (!partnerId) {
    throw makeError("ID partner mancante.", 400);
  }

  const existing = await partnerRepo.findPartnerById(partnerId);

  if (!existing) {
    throw makeError("Partner non trovato.", 404);
  }

  const updates = {};

  if (fields.name !== undefined) {
    if (!fields.name?.trim()) {
      throw makeError("Il nome attività è obbligatorio.", 400);
    }
    updates.name = clean(fields.name).trim();
  }

  if (fields.category !== undefined) {
    validateCategory(fields.category);
    updates.category = clean(fields.category).trim();
  }

  if (fields.email !== undefined) {
    const normalizedEmail = fields.email
      ? clean(fields.email).toLowerCase().trim()
      : null;
    validateEmail(normalizedEmail);
    updates.email = normalizedEmail;
  }

  // Simple optional passthrough fields — normalize "" → null
  const passthroughFields = [
    "legalName",
    "vatNumber",
    "phone",
    "website",
    "address",
    "city",
    "postalCode",
    "description",
    "offerDescription",
    "notes",
  ];

  for (const key of passthroughFields) {
    if (fields[key] !== undefined) {
      updates[key] = normalizeOptional(fields[key]);
    }
  }

  if (fields.active !== undefined) {
    updates.active = Boolean(fields.active);
  }

  const updated = await partnerRepo.updatePartner(partnerId, updates);

  return {
    success: true,
    partner: updated,
  };
}

/* ─────────────────────────────────────────────
   LOGIN (existing — unchanged)
───────────────────────────────────────────── */

async function loginPartner({ email, password }) {
  if (!email?.trim() || !password) {
    throw makeError("Credenziali non valide.", 401);
  }

  const partner = await partnerRepo.findPartnerByIdentifier(
    normalizePartnerId(email)
  );

  if (!partner) {
    throw makeError("Credenziali non valide.", 401);
  }

  const match = await verifyPassword(password, partner.passwordHash);

  if (!match) {
    throw makeError("Credenziali non valide.", 401);
  }

  if (!partner.active) {
    throw makeError("Account sospeso.", 403);
  }

  return {
    success:            true,
    partnerId:          partner.id,
    name:               partner.name,
    mustChangePassword: Boolean(partner.mustChangePassword),
  };
}

/* ─────────────────────────────────────────────
   SET PASSWORD (existing — unchanged)
───────────────────────────────────────────── */

async function setPartnerPassword({ partnerId, newPassword }) {
  validatePassword(newPassword);

  const partner = await partnerRepo.findPartnerById(partnerId);

  if (!partner) {
    throw makeError("Partner non trovato.", 404);
  }

  await partnerRepo.updatePartnerPassword({
    partnerId,
    passwordHash:       await hashPassword(newPassword),
    mustChangePassword: false,
  });

  return { success: true };
}

/* ─────────────────────────────────────────────
   ADMIN — SET ACTIVE (existing — unchanged)
───────────────────────────────────────────── */

async function setPartnerActive(partnerId, active) {
  const partner = await partnerRepo.findPartnerById(partnerId);

  if (!partner) {
    throw makeError("Partner non trovato.", 404);
  }

  await partnerRepo.setPartnerActive(partnerId, Boolean(active));

  return { success: true };
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  getPartners,
  createPartner,
  updatePartner,         // ← new
  loginPartner,
  setPartnerPassword,
  setPartnerActive,

  // Exported for reuse — e.g. shared frontend/validator constants
  PARTNER_CATEGORIES,
};