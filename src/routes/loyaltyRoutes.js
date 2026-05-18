"use strict";

const express = require("express");

const {
  registerCustomer,
  loginCustomer,
  getCustomerByToken,
  validateRedemptionController,
  getCustomersController,
  registerPartner,
  loginPartner,
  getRedemptionsController,
  createOfferController,
  getQrCodeController
} = require("../controllers/loyaltyController");

const {
  requireCustomerAPI,
  requirePartnerAPI,
  requireAdminAPI
} = require("../middleware/loyaltySession");

const router = express.Router();

/* ==========================================
   CUSTOMER
========================================== */

router.post("/customer/register", registerCustomer);
router.post("/customer/login", loginCustomer);

/* protected customer routes */
router.get(
  "/customer/:token",
  requireCustomerAPI,
  getCustomerByToken
);

router.get(
  "/qr/:token",
  requireCustomerAPI,
  getQrCodeController
);

/* ==========================================
   PARTNER
========================================== */

router.post("/partner/register", registerPartner);
router.post("/partner/login", loginPartner);

/* protected partner route */
router.post(
  "/validate",
  requirePartnerAPI,
  validateRedemptionController
);

/* ==========================================
   ADMIN
========================================== */

router.get(
  "/admin/customers",
  requireAdminAPI,
  getCustomersController
);

router.get(
  "/admin/redemptions",
  requireAdminAPI,
  getRedemptionsController
);

router.post(
  "/admin/offers",
  requireAdminAPI,
  createOfferController
);

module.exports = router;