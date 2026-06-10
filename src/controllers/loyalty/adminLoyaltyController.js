"use strict";

const redemptionLoyaltyService = require("../../services/loyalty/redemptionLoyaltyService");
const customerLoyaltyService   = require("../../services/loyalty/customerLoyaltyService");
const partnerLoyaltyService    = require("../../services/loyalty/partnerLoyaltyService");
const adminLoyaltyService      = require("../../services/loyalty/adminLoyaltyService");
const offerLoyaltyService      = require("../../services/loyalty/offerLoyaltyService");

const { generateQrImage }      = require("../../services/qrService");
const { clean }               = require("../../utils/sanitizer");
const { verifyPassword }      = require("../../utils/argon2");

const { establishSession, destroySession } = require("../../services/sessionService");
const { handleError } = require("./helper");

/* ─────────────────────────────────────────────
   ADMIN LOGIN
───────────────────────────────────────────── */

async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;

    const adminEmail = process.env.LOYALTY_ADMIN_EMAIL;
    const adminHash  = process.env.LOYALTY_ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminHash) {
      return res.status(503).json({
        success: false,
        message: "Admin non configurato.",
      });
    }

    if (!email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Credenziali obbligatorie.",
      });
    }

    const emailOk = email.trim().toLowerCase() === adminEmail.toLowerCase();
    const passOk  = await verifyPassword(password, adminHash);

    if (!emailOk || !passOk) {
      return res.status(401).json({
        success: false,
        message: "Credenziali non valide.",
      });
    }

    await establishSession(req, {
      loyaltyAdmin: {
        email: adminEmail,
      },
    });

    return res.json({
      success: true,
      message: "Login effettuato.",
    });

  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────
   SESSION
───────────────────────────────────────────── */

function adminSession(req, res) {
  if (!req.session?.loyaltyAdmin) {
    return res.status(401).json({
      success: false,
      message: "Non autorizzato.",
    });
  }

  return res.json({
    success: true,
    data: req.session.loyaltyAdmin,
  });
}

/* ─────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────── */

async function logoutAdmin(req, res) {
  try {
    await destroySession(req, res);

    return res.json({
      success: true,
      message: "Logout effettuato.",
    });

  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────
   CUSTOMERS
───────────────────────────────────────────── */

async function adminGetCustomers(req, res) {
  try {
    const customers = await adminLoyaltyService.getCustomers();

    return res.json({
      success: true,
      ...customers
    });

  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────
   PARTNERS
───────────────────────────────────────────── */

async function adminGetPartners(req, res) {
  try {
    const partners = await adminLoyaltyService.getPartners();

    return res.json({
      success: true,
      data: partners,
    });

  } catch (err) {
    handleError(res, err);
  }
}

async function adminCreatePartner(req, res) {
  try {
    const { id, name, category, address, tempPassword } = req.body;

    const result = await partnerLoyaltyService.createPartner({
      id: clean(id || ""),
      name: clean(name || ""),
      category: clean(category || ""),
      address: clean(address || ""),
      tempPassword,
    });

    return res.status(201).json(result);

  } catch (err) {
    handleError(res, err);
  }
}

async function adminSetPartnerActive(req, res) {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "active must be boolean",
      });
    }

    const result = await partnerLoyaltyService.setPartnerActive(
      clean(id),
      active
    );

    return res.json(result);

  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────
   OFFERS
───────────────────────────────────────────── */

async function adminGetOffers(req, res) {
  try {
    const offers = await adminLoyaltyService.getOffers();

    return res.json({
      success: true,
      ...offers,
    });

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

    return res.status(201).json(result);

  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────
   REDEMPTIONS
───────────────────────────────────────────── */

async function adminGetRedemptions(req, res) {
  try {
    const redemptions = await adminLoyaltyService.getRedemptions();

    return res.json({
      success: true,
      data: redemptions,
    });

  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */

module.exports = {
  loginAdmin,
  logoutAdmin,
  adminSession,

  adminGetCustomers,
  adminGetPartners,
  adminCreatePartner,
  adminSetPartnerActive,

  adminGetOffers,
  adminCreateOffer,

  adminGetRedemptions,
};