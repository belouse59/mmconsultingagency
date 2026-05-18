"use strict";

const {
  register,
  login,
  getByToken,
  validateRedemption,
  getCustomers,
  getRedemptions,
  createOffer
} = require("../services/loyaltyService");

const {
  generateQrImage
} = require("../services/qrService.js");

/* ─────────────────────────────────────────────────────────────
   RESPONSE HELPERS
───────────────────────────────────────────────────────────── */
const err = (message = "error") => ({
  success: false,
  message
});

/* ─────────────────────────────────────────────────────────────
   CUSTOMER
───────────────────────────────────────────────────────────── */
async function registerCustomer(req, res, next) {
  try {
    const result = await register(req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function loginCustomer(req, res, next) {
  try {
    const result = await login(req.body);

    if (!result.success) {
      return res.status(401).json(result);
    }

    /* session creation */
    req.session.loyaltyCustomer = {
      sessionId: result.customerId
    };

    return res.json(result);

  } catch (error) {
    return next(error);
  }
}

function getCustomerByToken(req, res, next) {
  try {
    const result = getByToken(req.params.token);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

/* ─────────────────────────────────────────────────────────────
   QR
───────────────────────────────────────────────────────────── */
async function getQrCodeController(req, res, next) {
  try {
    const customer = await getByToken(req.params.token);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const qrImage = await generateQrImage(customer.qrToken);

    return res.json({
      success: true,
      qrImage
    });

  } catch (error) {
    return next(error);
  }
}

/* ─────────────────────────────────────────────────────────────
   PARTNER
───────────────────────────────────────────────────────────── */
async function registerPartner(req, res, next) {
  try {
    return res.json({
      success: true,
      data: []
    });
  } catch (error) {
    return next(error);
  }
}

async function loginPartner(req, res, next) {
  try {
    /* replace with real partner auth later */
    const partner = {
      partnerId: "partner-6"
    };

    req.session.loyaltyPartner = partner;

    return res.json({
      success: true,
      partnerId: partner.partnerId
    });

  } catch (error) {
    return next(error);
  }
}

/* ─────────────────────────────────────────────────────────────
   VALIDATION
───────────────────────────────────────────────────────────── */
async function validateRedemptionController(req, res, next) {
  try {
    const result = await validateRedemption(req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN
───────────────────────────────────────────────────────────── */
async function getCustomersController(req, res, next) {
  try {
    const customers = await getCustomers();

    if (!customers) {
      return res.status(403).json(
        err("Request failed")
      );
    }

    return res.json({
      success: true,
      customers
    });

  } catch (error) {
    return next(error);
  }
}

async function getRedemptionsController(req, res, next) {
  try {
    const redemptions = await getRedemptions();

    return res.json({
      success: true,
      redemptions
    });

  } catch (error) {
    return next(error);
  }
}

async function createOfferController(req, res, next) {
  try {
    const result = await createOffer(req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerCustomer,
  loginCustomer,
  getCustomerByToken,
  validateRedemptionController,
  getCustomersController,
  getRedemptionsController,
  loginPartner,
  registerPartner,
  createOfferController,
  getQrCodeController
};