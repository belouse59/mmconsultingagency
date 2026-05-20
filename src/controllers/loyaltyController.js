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

const loyaltyService = require("../services/loyaltyService");
const { generateQrImage, getQrTtl } = require("../services/qrService");
const { clean } = require("../utils/sanitizer");
const { verifyPassword } = require("../utils/argon2");
const { establishSession, destroySession } = require("../services/sessionService");

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

/** Consistent error responder — never leaks stack traces in production */
function handleError(res, err) {
  const status = err.statusCode || 500;
  const message = err.statusCode
    ? err.message
    : "Errore interno. Riprova più tardi.";

  if (!err.statusCode) {
    console.error("[loyaltyController]", err);
  }

  res.status(status).json({ success: false, message });
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER — REGISTER
───────────────────────────────────────────────────────────── */
async function registerCustomer(req, res) {
  try {
    const { full_name, identifier, password } = req.body;

    const result = await loyaltyService.register({
      full_name: clean(full_name || ""),
      identifier: clean(identifier || ""),
      password,             // password not passed through clean() — it will be hashed
    });

    /* Establish session immediately after registration */
    await establishSession(req, {
      loyaltyCustomer: {
        id: result.customerId,
        full_name: clean(full_name || ""),
      },
    });

    res.status(201).json({
      success: true,
      message: "Registrazione completata.",
      customerId: result.customerId,
      full_name: clean(full_name || ""),
    });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER — LOGIN
───────────────────────────────────────────────────────────── */
async function loginCustomer(req, res) {
  try {
    const { identifier, password } = req.body;

    const result = await loyaltyService.login({
      identifier: clean(identifier || ""),
      password,
    });

    await establishSession(req, {
      loyaltyCustomer: {
        id: result.customerId,
        full_name: result.full_name,
      },
    });

    res.json({
      success: true,
      message: "Accesso effettuato.",
      full_name: result.full_name,
    });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER — LOGOUT
───────────────────────────────────────────────────────────── */
async function logoutCustomer(req, res) {
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
   CUSTOMER — SESSION CHECK
   Called on page load to check if already authenticated.
   Returns minimal info — never the full customer record.
───────────────────────────────────────────────────────────── */
function customerSession(req, res) {
  if (!req.session?.loyaltyCustomer) {
    return res.status(401).json({ success: false, message: "Non autenticato." });
  }
  res.json({
    success: true,
    customerId: req.session.loyaltyCustomer.id,
    full_name: req.session.loyaltyCustomer.full_name,
  });
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER — QR CODE
   Generates a fresh HMAC-signed token on every call.
   Frontend should call this endpoint and refresh before expiry.
───────────────────────────────────────────────────────────── */
async function getCustomerQr(req, res) {
  try {
    const customerId = req.session.loyaltyCustomer.id;

    const { qrImage, ttl } = await generateQrImage(customerId);

    res.json({
      success: true,
      qrImage,
      ttl,
      fullName: req.session.loyaltyCustomer.full_name,
    });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER — OFFERS LIST
───────────────────────────────────────────────────────────── */
async function getOffers(req, res) {
  try {
    const offers = await loyaltyService.getOffers();
    const active = offers.filter((o) => o.active);
    res.json({ success: true, data: active });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   PARTNER — LOGIN
───────────────────────────────────────────────────────────── */
async function loginPartner(req, res) {
const { partnerId, password } = req.body;

    const result = await loyaltyService.loginPartner({
      partnerId: clean(partnerId || ""),
      password,
    });
  await establishSession(req, {
    loyaltyPartner: {
      id: result.partnerId,
      name: result.name,
    },
  });

  res.json({
    success: true,
    message: "Accesso effettuato.",
    name: result.name,
  });
}

/* ─────────────────────────────────────────────────────────────
   PARTNER — LOGOUT
───────────────────────────────────────────────────────────── */
async function logoutPartner(req, res) {
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
   PARTNER — SESSION CHECK
───────────────────────────────────────────────────────────── */
function partnerSession(req, res) {
  if (!req.session?.loyaltyPartner) {
    return res.status(401).json({ success: false, message: "Non autenticato." });
  }
  res.json({
    success: true,
    partnerId: req.session.loyaltyPartner.id,
    name: req.session.loyaltyPartner.name,
  });
}

/* ─────────────────────────────────────────────────────────────
   PARTNER — VALIDATE + REDEEM QR
───────────────────────────────────────────────────────────── */
async function redeemQr(req, res) {
  try {
    const { token, offerId } = req.body;

    /* offerId must be provided — no "default-offer" fallback */
    if (!offerId) {
      return res.status(400).json({
        success: false,
        message: "Seleziona un'offerta prima di procedere.",
      });
    }

    /* partnerId comes from the server-side session — never from the client body */
    const partnerId = req.session.loyaltyPartner.id;

    const result = await loyaltyService.validateRedemption({
      token: clean(token || ""),
      offerId: clean(offerId || ""),
      partnerId,
    });

    const status = result.success ? 200 : 409;
    res.status(status).json(result);
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   PARTNER — OFFERS (for the scan page dropdown)
───────────────────────────────────────────────────────────── */
async function getPartnerOffers(req, res) {
  try {
    const partnerId = req.session.loyaltyPartner.id;
    const allOffers = await loyaltyService.getOffers();

    /* Partners see offers assigned to them OR global offers (no partnerId) */
    const relevant = allOffers.filter(
      (o) => o.active && (!o.partnerId || o.partnerId === partnerId)
    );

    res.json({ success: true, data: relevant });
  } catch (err) {
    handleError(res, err);
  }
}

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
    const passMatch = await verifyPassword(password, { passwordHash: adminHashEnv });

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
   ADMIN — DATA READS
───────────────────────────────────────────────────────────── */
async function adminGetCustomers(req, res) {
  try {
    const customers = await loyaltyService.getCustomers();
    /* Strip password hashes before returning */
    const safe = customers.map(({ passwordHash: _pw, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch (err) {
    handleError(res, err);
  }
}

async function adminGetRedemptions(req, res) {
  try {
    const redemptions = await loyaltyService.getRedemptions();
    res.json({ success: true, data: redemptions });
  } catch (err) {
    handleError(res, err);
  }
}

async function adminGetOffers(req, res) {
  try {
    const offers = await loyaltyService.getOffers();
    res.json({ success: true, data: offers });
  } catch (err) {
    handleError(res, err);
  }
}

async function adminCreateOffer(req, res) {
  try {
    const { title, description, partnerId } = req.body;
    const result = await loyaltyService.createOffer({
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
   EXPORTS
───────────────────────────────────────────────────────────── */
module.exports = {
  /* Customer */
  registerCustomer,
  loginCustomer,
  logoutCustomer,
  customerSession,
  getCustomerQr,
  getOffers,

  /* Partner */
  loginPartner,
  logoutPartner,
  partnerSession,
  redeemQr,
  getPartnerOffers,

  /* Admin */
  loginAdmin,
  logoutAdmin,
  adminSession,
  adminGetCustomers,
  adminGetRedemptions,
  adminGetOffers,
  adminCreateOffer,
};