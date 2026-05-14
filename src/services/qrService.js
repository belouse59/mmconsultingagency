"use strict";

const crypto = require("crypto");

function generateToken() {
    crypto.randomBytes(32).toString("hex")
};
module.exports = { generateToken };