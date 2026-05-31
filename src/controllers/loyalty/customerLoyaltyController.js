
const customerLoyaltyService = require("../../services/loyalty/customerLoyaltyService");
const offerLoyaltyService = require("../../services/loyalty/offerLoyaltyService");
const { generateQrImage } = require("../../services/qrService");
const { clean } = require("../../utils/sanitizer");
const { establishSession, destroySession } = require("../../services/sessionService");
const { handleError } = require("./helper")
/* ─────────────────────────────────────────────────────────────
   CUSTOMER — REGISTER
───────────────────────────────────────────────────────────── */
async function registerCustomer(req, res) {
  try {
    const { full_name, identifier, password } = req.body;

    const result = await customerLoyaltyService.register({
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

    const result = await customerLoyaltyService.login({
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

    const { qrImage, ttl } = await generateQrImage(id);

    res.json({
      success: true,
      qrImage,
      ttl,
      full_name,
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
    const offers = await offerLoyaltyService.getActiveOffers();
    res.json({ success: true, data: offers });
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
  getOffers
}