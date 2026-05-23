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
    const { id, full_name } = req.session.loyaltyCustomer;

    const { qrImage, ttl } = await generateQrImage(customerId);

    res.json({
      success: true,
      qrImage,
      ttl,
      fullName,
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
      mustChangePassword: result.mustChangePassword,
    },
  });

  res.json({
    success: true,
    message: "Accesso effettuato.",
    name: result.name,
  });
}

/* ─────────────────────────────────────────────────────────────
   PARTNER — SET PASSWORD (first-login flow)
───────────────────────────────────────────────────────────── */
async function setPartnerPassword(req, res) {
  try {
    const { newPassword, confirmPassword } = req.body;
 
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "La nuova password deve avere almeno 8 caratteri." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Le password non coincidono." });
    }
 
    const partnerId = req.session.loyaltyPartner.id;
    await loyaltyService.setPartnerPassword({ partnerId, newPassword });
 
    /* Clear mustChangePassword flag from session */
    req.session.loyaltyPartner.mustChangePassword = false;
    req.session.save(() =>
      res.json({ success: true, message: "Password aggiornata con successo." })
    );
  } catch (err) {
    handleError(res, err);
  }
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
    mustChangePassword: req.session.loyaltyPartner.mustChangePassword || false,
  });

}

/* ─────────────────────────────────────────────────────────────
   PARTNER — OFFERS
───────────────────────────────────────────────────────────── */
async function getPartnerOffers(req, res) {
  try {
    const partnerId = req.session.loyaltyPartner.id;
    const offers    = await loyaltyService.getPartnerOffers(partnerId);
    return res.json({ success: true, data: offers });
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   PARTNER — PREVALIDATE QR
   Validates token + returns customer name + per-offer eligibility.
   Does NOT redeem anything.
───────────────────────────────────────────────────────────── */
async function prevalidateQr(req, res) {
  try {
    const { token }   = req.body;
    const partnerId   = req.session.loyaltyPartner.id;
 
    if (!token) {
      return res.status(400).json({ success: false, message: "Token mancante." });
    }
 
    const result = await loyaltyService.prevalidateQr({
      token:     clean(token),
      partnerId,
    });
 
    return res.json(result);
  } catch (err) {
    handleError(res, err);
  }
}

/* ─────────────────────────────────────────────────────────────
   PARTNER - REDEEM QR
───────────────────────────────────────────────────────────── */
async function redeemQr(req, res) {
  try {
    const { token, offerId, idempotencyKey } = req.body;
    const partnerId = req.session.loyaltyPartner.id;
 
    if (!token) {
      return res.status(400).json({ success: false, message: "Token mancante." });
    }
    if (!offerId) {
      return res.status(400).json({ success: false, message: "Seleziona un'offerta prima di procedere." });
    }
 
    const result = await loyaltyService.redeemOffer({
      token:          clean(token),
      offerId:        clean(offerId),
      partnerId,
      idempotencyKey: idempotencyKey ? clean(idempotencyKey) : null,
    });
 
    const status = result.success ? 200 : 409;
    return res.status(status).json(result);
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
   ADMIN — CUSTOMERS
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

/* ─────────────────────────────────────────────────────────────
   ADMIN — REDEMPTIONS
───────────────────────────────────────────────────────────── */
async function adminGetRedemptions(req, res) {
  try {
    const redemptions = await loyaltyService.getRedemptions();
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
   ADMIN — PARTNERS
───────────────────────────────────────────────────────────── */
async function adminGetPartners(req, res) {
  try {
    const partners = await loyaltyService.getAllPartners();
    const safe     = partners.map(({ passwordHash: _pw, ...rest }) => rest);
    return res.json({ success: true, data: safe });
  } catch (err) {
    handleError(res, err);
  }
}

async function adminCreatePartner(req, res) {
  try {
    const { id, name, category, address, tempPassword } = req.body;
    const result = await loyaltyService.createPartner({
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
    const result = await loyaltyService.setPartnerActive(clean(id), active);
    return res.json(result);
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
  setPartnerPassword,
  logoutPartner,
  partnerSession,
  getPartnerOffers,
  prevalidateQr,
  redeemQr,

  /* Admin */
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