"use strict";

const { loyaltyService } = require("../services/loyaltyService");

function registerCustomer(req, res) {
    const result = loyaltyService.register(req.body);
    res.json(result);
};

function loginCustomer(req, res) {
    const result = loyaltyService.login(req.body);
    res.json(result);
};

function getCustomerByToken(req, res) {
    const result = loyaltyService.getByToken(req.params.token);
    res.json(result);
};

function validateRedemption(req, res) {
    const result = loyaltyService.validate(req.body);
    res.json(result);
};

function getCustomers(req, res) {
    res.json(loyaltyService.getCustomers());
};

function getRedemptions(req, res) {
    res.json(loyaltyService.getRedemptions());
};

function createOffer(req, res) {
    res.json(loyaltyService.createOffer(req.body));
};

module.exports = {
    registerCustomer,
    loginCustomer,
    getCustomerByToken,
    validateRedemption,
    getCustomers,
    getRedemptions,
    createOffer
};