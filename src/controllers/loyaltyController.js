"use strict";

const { register, login, getByToken, validateRedemption, getCustomers, getRedemptions, createOffer } = require("../services/loyaltyService");

function registerCustomer(req, res) {
    const result = register(req.body);
    res.json(result);
};

function loginCustomer(req, res) {
    const result = login(req.body);
    res.json(result);
};

function getCustomerByToken(req, res) {
    const result = getByToken(req.params.token);
    res.json(result);
};

function validateRedemptionController(req, res) {
    const result = validateRedemption(req.body);
    res.json(result);
};

function getCustomersController(req, res) {
    res.json(getCustomers());
};

function getRedemptionsController(req, res) {
    res.json(getRedemptions());
};

function createOfferController(req, res) {
    res.json(createOffer(req.body));
};

module.exports = {
    registerCustomer,
    loginCustomer,
    getCustomerByToken,
    validateRedemptionController,
    getCustomersController,
    getRedemptionsController,
    createOfferController
};