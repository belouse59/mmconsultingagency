"use strict";

const verificationService =
  require("../services/verificationService");
  const { loadTemplate } = require("../utils/templateLoader");

async function verifyContact_Newsletter(req, res) {

  const { token } = req.query;
  const APP_URL = process.env.APP_URL;

  if (!token) {
    const html = loadTemplate(
        "verify-missing.html",
        { APP_URL: APP_URL }
    )
    return res.status(400).send(html);
  }

  try {
    await verificationService
      .verifyEmailContact_Newsletter(token);
       const html = loadTemplate(
        "verify-success.html",
        { APP_URL: APP_URL }
    )
    return res.status(200).send(html);

  } catch (err) {
       const html = loadTemplate(
        "verify-error.html",
        { APP_URL: APP_URL }
    )
    return res.status(500).send(html);
  }
}

async function verifyCustomer(req, res) {

  const { token } = req.query;
  const APP_URL = process.env.APP_URL;

  if (!token) {
    const html = loadTemplate(
        "verify-missing.html",
        { APP_URL: APP_URL }
    )
    return res.status(400).send(html);
  }

  try {
    await verificationService
      .verifyCustomer(token);
       const html = loadTemplate(
        "verify-success.html",
        { APP_URL: APP_URL }
    )
    return res.status(200).send(html);

  } catch (err) {
       const html = loadTemplate(
        "verify-error.html",
        { APP_URL: APP_URL }
    )
    return res.status(500).send(html);
  }
}

async function verifyPartner(req, res) {

  const { token } = req.query;
  const APP_URL = process.env.APP_URL;

  if (!token) {
    const html = loadTemplate(
        "verify-missing.html",
        { APP_URL: APP_URL }
    )
    return res.status(400).send(html);
  }

  try {
    await verificationService
      .verifyPartner(token);
       const html = loadTemplate(
        "verify-success.html",
        { APP_URL: APP_URL }
    )
    return res.status(200).send(html);

  } catch (err) {
       const html = loadTemplate(
        "verify-error.html",
        { APP_URL: APP_URL }
    )
    return res.status(500).send(html);
  }
}

module.exports = {
  verifyContact_Newsletter,
  verifyCustomer,
  verifyPartner
};