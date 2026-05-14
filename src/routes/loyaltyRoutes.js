"use strict";

const express = require("express");
const controller = require("../controllers/loyaltyController");

const router = express.Router();

router.post("/register", controller.registerCustomer);
router.post("/login", controller.loginCustomer);
router.get("/customer/:token", controller.getCustomerByToken);

router.post("/validate", controller.validateRedemption);

router.get("/admin/customers", controller.getCustomers);
router.get("/admin/redemptions", controller.getRedemptions);
router.post("/admin/offers", controller.createOffer);

module.exports = router;