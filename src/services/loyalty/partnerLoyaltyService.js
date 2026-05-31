"use strict"

const partnerRepo = require("../../repositories/partnersRepository");
const { hashPassword, verifyPassword } = require("../../utils/argon2");
const { makeError } = require("../../utils/errorHandler");
const { clean } = require("../../utils/sanitizer");

async function getPartners() {
  const result = await partnerRepo.findPartners();
  if (!result) throw makeError("Partner non trovato.", 404);
  return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            category: row.category,
            address: row.address,
            passwordHash: row.password_hash,
            mustChangePassword: row.must_change_password,
            active: row.active,
            createdAt: row.created_at,
        }));
}

async function createPartner({ id, name, category, address, tempPassword }) {
  if (!id?.trim() || !name?.trim() || !tempPassword) {
    throw makeError(
      "ID, nome e password temporanea sono obbligatori.",
      400
    );
  }

  const cleanId = clean(id).toLowerCase().replace(/\s+/g, "-");

  /* ─────────────────────────────────────────────
     1. CHECK EXISTING PARTNER (DB IS SOURCE OF TRUTH)
  ───────────────────────────────────────────── */
  const existing = await partnerRepo.findPartnerById(cleanId);

  if (existing.rowCount > 0) {
    throw makeError("Un partner con questo ID esiste già.", 409);
  }

  /* ─────────────────────────────────────────────
     2. VALIDATE PASSWORD
  ───────────────────────────────────────────── */
  if (tempPassword.length < 8) {
    throw makeError(
      "La password temporanea deve avere almeno 8 caratteri.",
      400
    );
  }

  const hash = await hashPassword(tempPassword);

  const nowIso = new Date().toISOString();

  /* ─────────────────────────────────────────────
     3. INSERT INTO POSTGRES (SOURCE OF TRUTH)
  ───────────────────────────────────────────── */
  let result = await partnerRepo.createPartner(cleanId, clean(name), clean(category || "Generico"), clean(address || ""), hash);

  /* ─────────────────────────────────────────────
     5. RESPONSE
  ───────────────────────────────────────────── */
  return {
    success: true,
    partnerId: cleanId,
  };
}

async function loginPartner({ partnerId, password }) {
  if (!partnerId?.trim() || !password) throw makeError("Credenziali non valide.", 401);

  /* Partners loaded from JSON file — avoids a Sheets call on every login */
  let partner = null;
  try {
    const result = await partnerRepo.findPartnerById(partnerId.trim());
    if (result.rows.length) partner = result.rows[0];
  } catch (e) {
    console.log(e);
    throw makeError("Servizio temporaneamente non disponibile.", 503);
  }

  const match = await verifyPassword(password, partner);

  if (!partner || !match) throw makeError("Credenziali non valide.", 401);

  if (!partner.active) throw makeError("Account sospeso.", 403);

  return {
    success: true,
    partnerId: partner.id,
    name: partner.name,
    mustChangePassword: partner.mustChangePassword === true
  };
}

/* ─────────────────────────────────────────────────────────────
   PARTNER — SET PASSWORD (first login flow)
───────────────────────────────────────────────────────────── */

async function setPartnerPassword({ partnerId, newPassword }) {
  if (!newPassword || newPassword.length < 8) {
    throw makeError("La nuova password deve avere almeno 8 caratteri.", 400);
  }

  const partner = await partnerRepo.findPartnerById(partnerId);
  if (!partner) throw makeError("Partner non trovato.", 404);

  const hash = await hashPassword(newPassword);
  const updated = { ...partner, passwordHash: hash, mustChangePassword: false };
  let result = await partnerRepo.updatePartnerById(partnerId, updated);
  return { success: true };
}

/* ─────────────────────────────────────────────────────────────
   PARTNER — UPDATE ACTIVE STATUS (admin)
───────────────────────────────────────────────────────────── */
async function setPartnerActive(partnerId, active) {
  const partner = await partnerRepo.findPartnerById(partnerId);
  if (!partner) throw makeError("Partner non trovato.", 404);
  const updated = { ...partner.rows[0], active };
  let result = await partnerRepo.updatePartnerById(partnerId, updated);
  return { success: true };
}

module.exports = {
  getPartners,
  loginPartner,
  setPartnerPassword,
  createPartner,
  setPartnerActive,
}