const redemptionLoyaltyService = require("../../services/loyalty/redemptionLoyaltyService");
const partnerLoyaltyService = require("../../services/loyalty/partnerLoyaltyService");
const offerLoyaltyService = require("../../services/loyalty/offerLoyaltyService");
const { clean } = require("../../utils/sanitizer");
const { establishSession, destroySession } = require("../../services/sessionService");
const { handleError } = require("./helper")

/* ─────────────────────────────────────────────────────────────
   PARTNER — LOGIN
───────────────────────────────────────────────────────────── */
async function loginPartner(req, res) {
  const { partnerId, password } = req.body;

  const result = await partnerLoyaltyService.loginPartner({
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
  const {success, ...safe} = result;
  res.json({
    success,
    message: "Accesso effettuato.",
    partner: safe
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
    await partnerLoyaltyService.setPartnerPassword({ partnerId, newPassword });
 
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
    const result    = await offerLoyaltyService.getPartnerOffers(partnerId);
    let offers = null;
    if(result.rows.length) offers = result.rows; 
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
 
    const result = await redemptionLoyaltyService.prevalidateQr({
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
 
    const result = await redemptionLoyaltyService.redeemOffer({
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
   EXPORTS
───────────────────────────────────────────────────────────── */
module.exports = {
  loginPartner,
  setPartnerPassword,
  logoutPartner,
  partnerSession,
  getPartnerOffers,
  prevalidateQr,
  redeemQr
}