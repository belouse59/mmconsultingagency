"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { generateToken } = require("./qrService");

const customersPath = path.join(__dirname, "../data/loyalty-customers.json");
const redemptionsPath = path.join(__dirname, "../data/loyalty-redemptions.json");
const offersPath = path.join(__dirname, "../data/loyalty-offers.json");

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) =>
    fs.writeFileSync(file, JSON.stringify(data, null, 2));

const hash = (value) =>
    crypto.createHash("sha256").update(value).digest("hex");

function register({ email, password }) {
    const customers = read(customersPath);

    if (customers.find((u) => u.email === email)) {
        throw new Error("User already exists");
    }

    const customer = {
        id: Date.now().toString(),
        email,
        password: hash(password),
        qrToken: generateToken(),
        createdAt: new Date().toISOString(),
    };

    customers.push(customer);
    write(customersPath, customers);

    return {
        success: true,
        customer,
    };
};

function login({ email, password }) {
    const customers = read(customersPath);

    const user = customers.find(
        (u) => u.email === email && u.password === hash(password)
    );

    if (!user) throw new Error("Invalid credentials");

    return {
        success: true,
        customer: user,
    };
};

function getByToken(token) {
    const customers = read(customersPath);
    return customers.find((u) => u.qrToken === token);
};

function validate({ token, offerId, partnerId }) {
    const customer = exports.getByToken(token);

    if (!customer) {
        return { success: false, message: "Invalid QR" };
    }

    const redemptions = read(redemptionsPath);

    const today = new Date().toISOString().slice(0, 10);

    const alreadyUsed = redemptions.find(
        (r) =>
            r.customerId === customer.id &&
            r.offerId === offerId &&
            r.date === today
    );

    if (alreadyUsed) {
        return {
            success: false,
            message: "Offer already redeemed today",
        };
    }

    redemptions.push({
        id: Date.now().toString(),
        customerId: customer.id,
        partnerId,
        offerId,
        date: today,
        createdAt: new Date().toISOString(),
    });

    write(redemptionsPath, redemptions);

    return {
        success: true,
        message: "Discount validated",
        customer,
    };
};

function getCustomers() {
    read(customersPath)
};
function getRedemptions() {
    read(redemptionsPath)
};

function createOffer({ title }) {
    const offers = read(offersPath);

    const offer = {
        id: Date.now().toString(),
        title,
        active: true,
    };

    offers.push(offer);
    write(offersPath, offers);

    return offer;
};

module.exports = { register, login, getByToken, validate, getCustomers, getRedemptions, createOffer }