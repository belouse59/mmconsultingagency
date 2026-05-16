"use strict";

const express = require("express");
const {
    registerCustomer, 
    loginCustomer, 
    getCustomerByToken, 
    validateRedemptionController, 
    getCustomersController,
    getRedemptionsController,
    createOfferController,
    getQrCodeController
} = require("../controllers/loyaltyController");

const router = express.Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.get("/customer/:token", getCustomerByToken);
router.get("/qr/:token", getQrCodeController);

router.post("/validate", validateRedemptionController);

router.get("/admin/customers", getCustomersController);
router.get("/admin/redemptions", getRedemptionsController);
router.post("/admin/offers", createOfferController);

module.exports = router;
