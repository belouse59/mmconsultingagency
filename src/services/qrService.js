"use strict";

const crypto = require("crypto");
const QRCode = require("qrcode");

function generateQrToken() {
  return crypto.randomBytes(32).toString("hex");
};

async function generateQrImage(token) {
  return QRCode.toDataURL(token, {
    width: 280,
    margin: 2,
  });
};
module.exports ={ generateQrToken, generateQrImage } 