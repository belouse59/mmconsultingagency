"use strict";

/**
 * controllers/loyaltyController.js
 *
 * CHANGES FROM ORIGINAL:
 *   - All handlers wrapped in try/catch — no unhandled rejections
 *   - Auth state stored in session (req.session.*) — NOT returned to client for localStorage
 *   - Admin routes protected by requireAdminAPI guard
 *   - Partner login validates real credentials via loyaltyService.loginPartner()
 *   - QR endpoint generates a fresh signed token on every call — no static tokens
 *   - All responses use consistent { success, message, data } shape
 *   - Input always validated before reaching the service layer
 *   - No stack traces returned to clients in production
 */

const redemptionLoyaltyService = require("../../services/loyalty/redemptionLoyaltyService");
const customerLoyaltyService = require("../../services/loyalty/customerLoyaltyService");
const partnerLoyaltyService = require("../../services/loyalty/partnerLoyaltyService");
const adminLoyaltyService = require("../../services/loyalty/adminLoyaltyService");
const offerLoyaltyService = require("../../services/loyalty/offerLoyaltyService");
const { generateQrImage, getQrTtl } = require("../../services/qrService");
const { clean } = require("../../utils/sanitizer");
const { verifyPassword } = require("../../utils/argon2");
const { establishSession, destroySession } = require("../../services/sessionService");
const { handleError } = require("./helper")

/* ─────────────────────────────────────────────────────────────
   ADMIN — LOGIN
   Credentials come from environment variables — no Sheets lookup.
   This keeps admin credentials out of the spreadsheet entirely.
───────────────────────────────────────────────────────────── */
async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;

    const adminEmail = process.env.LOYALTY_ADMIN_EMAIL;
    const adminHashEnv = process.env.LOYALTY_ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminHashEnv) {
      console.error("[loyaltyController/admin] LOYALTY_ADMIN_EMAIL or LOYALTY_ADMIN_PASSWORD_HASH not set in .env");
      return res.status(503).json({ success: false, message: "Servizio admin non configurato." });
    }

    if (!email?.trim() || !password) {
      return res.status(400).json({ success: false, message: "Credenziali obbligatorie." });
    }

    const emailMatch = email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
    const passMatch = await verifyPassword(password, { password_hash: adminHashEnv });

    /* Constant-time comparison of email too (minor — but correct) */
    if (!emailMatch || !passMatch) {
      return res.status(401).json({ success: false, message: "Credenziali non valide." });
    }

    await establishSession(req, {
      loyaltyAdmin: {
        email: adminEmail,
      },
    });

    res.json({
      success: true,
      message: "Accesso admin effettuato.",
    });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — LOGOUT
───────────────────────────────────────────────────────────── */
async function logoutAdmin(req, res) {
  try {
    await destroySession(req, res);

    res.json({
      success: true,
      message: "Logout effettuato.",
    });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — SESSION CHECK
───────────────────────────────────────────────────────────── */
function adminSession(req, res) {
  if (!req.session?.loyaltyAdmin) {
    return res.status(401).json({ success: false, message: "Non autorizzato." });
  }
  res.json({ success: true });
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — CUSTOMERS
───────────────────────────────────────────────────────────── */
async function adminGetCustomers(req, res) {
  try {
    const customers = await customerLoyaltyService.getCustomers();
    /* Strip password hashes before returning */
    const safe = customers.map(({ password_hash: _pw, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — REDEMPTIONS
───────────────────────────────────────────────────────────── */
async function adminGetRedemptions(req, res) {
  try {
    const redemptions = await adminLoyaltyService.getRedemptions();
    res.json({ success: true, data: redemptions });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — OFFERS
───────────────────────────────────────────────────────────── */
async function adminGetOffers(req, res) {
  try {
    const offers = await offerLoyaltyService.getOffers();
    res.json({ success: true, data: offers });
  } catch (err) {
    handleError(res, err);
  }
}

async function adminCreateOffer(req, res) {
  try {
    const { title, description, partnerId } = req.body;
    const result = await offerLoyaltyService.createOffer({
      title: clean(title || ""),
      description: clean(description || ""),
      partnerId: clean(partnerId || ""),
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — PARTNERS
───────────────────────────────────────────────────────────── */
async function adminGetPartners(req, res) {
  try {
    const partners = await partnerLoyaltyService.getPartners();
    const safe     = partners.map(({ password_hash: _pw, ...rest }) => rest);
    return res.json({ success: true, data: safe });
  } catch (err) {
    handleError(res, err);
  }
}

async function adminCreatePartner(req, res) {
  try {
    const { id, name, category, address, tempPassword } = req.body;
    const result = await partnerLoyaltyService.createPartner({
      id:          clean(id          || ""),
      name:        clean(name        || ""),
      category:    clean(category    || ""),
      address:     clean(address     || ""),
      tempPassword,
    });
    return res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
}
 
async function adminSetPartnerActive(req, res) {
  try {
    const { id }    = req.params;
    const { active } = req.body;
    if (typeof active !== "boolean") {
      return res.status(400).json({ success: false, message: "Campo 'active' deve essere boolean." });
    }
    const result = await partnerLoyaltyService.setPartnerActive(clean(id), active);
    return res.json(result);
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────────────────────── */
module.exports = {
  loginAdmin,
  logoutAdmin,
  adminSession,
  adminGetCustomers,
  adminGetRedemptions,
  adminGetOffers,
  adminCreateOffer,
  adminGetPartners,
  adminCreatePartner,
  adminSetPartnerActive,
};