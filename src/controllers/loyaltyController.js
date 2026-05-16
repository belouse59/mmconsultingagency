"use strict";

const { register, login, getByToken, validateRedemption, getCustomers, getRedemptions, createOffer } = require("../services/loyaltyService");
const {generateQrToken, generateQrImage} = require("../services/qrService.js");
/* ─────────────────────────────────────────────────────────────
   RESPONSE HELPERS
───────────────────────────────────────────────────────────── */
const ok = (message = "ok") => ({ status: "success", message });
const err = (message = "error") => ({ status: "error", message });

async function registerCustomer(req, res) {
    const result = await register(req.body);
    res.json(result);
};

async function loginCustomer(req, res) {
    const result = await login(req.body);
    res.json(result);
};

function getCustomerByToken(req, res) {
    const result = getByToken(req.params.token);
    res.json(result);
};

async function validateRedemptionController(req, res) {
    const result = await validateRedemption(req.body);
    res.json(result);
};

async function getCustomersController(req, res) {
        const customers = await getCustomers()
        if (customers) return res.json({success: true, customers});

        return res.status(403).json(err("Request Failed"));
};

async function registerPartner(req, res) {
    //const result = await register(req.body);
    return res.json({success: true, data:[]});
};

async function loginPartner(req, res) {
   // const result = await login(req.body);
   return res.json({success: true, partnerId:"partner-6"});
};

async function getRedemptionsController(req, res) {
    const redemptions = await getRedemptions()
    return res.json({success: true, redemptions});
};

async function createOfferController(req, res) {
    res.json(await createOffer(req.body));
};

async function getQrCodeController  (req, res){
  const customer = await getByToken(req.params.token);

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found",
    });
  }

  const qrImage = await generateQrImage(customer.qrToken);

  res.json({
    success: true,
    qrImage,
  });
};

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