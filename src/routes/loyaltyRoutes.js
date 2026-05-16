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

const router = express.Router();

router.post("/customer/register", registerCustomer);
router.post("/customer/login", loginCustomer);
router.get("/customer/:token", getCustomerByToken);
router.get("/qr/:token", getQrCodeController);

router.post("/validate", validateRedemptionController);

router.get("/admin/customers", getCustomersController);
router.get("/admin/redemptions", getRedemptionsController);
router.post("/admin/offers", createOfferController);

router.post("/partner/register", registerPartner);
router.post("/partner/login", loginPartner);

module.exports = router;
