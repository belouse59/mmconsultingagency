"use strict";

const contactService    = require("../services/form/contactService");
const newsletterService = require("../services/form/newsletterService");
const simulatorService  = require("../services/form/simulatorService");
const { verifyToken }   = require("../services/tokenService");

/**
 * A "loyalty" contact form submission is the same underlying
 * entity as a "contact" submission — a contacts row + a
 * contact_requests row — just from a different page with a
 * different category vocabulary (Cliente/Partner/Info instead
 * of Gas/Elettricità/Entrambi). Both route to the same service;
 * contactService.submit() reads `source`/`category` generically
 * to tell them apart.
 *
 * Any future contact-style form (e.g. a partner-page contact
 * form) can be added to this same list without a new service.
 */
const CONTACT_FORM_TYPES = ["contact", "loyalty", "energy"];

async function submitForm(req, res) {
  try {

    const { formType } = req.body;

    let result;

    if (CONTACT_FORM_TYPES.includes(formType)) {
      result = await contactService.submit(req.body);

    } else if (formType === "newsletter") {
      result = await newsletterService.subscribe(req.body);

    } else if (formType === "simulator") {
      result = await simulatorService.submit(req.body);

    } else {
      return res.status(400).json({
        success:  false,
        message:  "Tipo modulo non valido",
      });
    }

    return res.json(result);

  } catch (err) {

    console.error(err);

    return res.status(
      err.status || 500
    ).json({
      success:false,
      message: err.message
    });
  }
}

async function verifyEmail(req, res) {
  const { token } = req.query;

  const result = verifyToken(token);

  if (!result) {
    const html = loadTemplate(
      "verify-error.html",
      {
        APP_URL: process.env.APP_URL
      }
    );

    return res.status(400).send(html);
  }
  let updated = false;
  try {
    updated = await markEmailVerified(
      process.env.SHEET_NAME_CONTACT,
      result.email
    );
  } catch (err) {
    console.error(err);
  }

  if (!updated) {
    return res.status(404).send(
      loadTemplate("verify-missing.html", {
        APP_URL: process.env.APP_URL
      })
    );
  }

  return res.send(
    loadTemplate("verify-success.html", {
      APP_URL: process.env.APP_URL
    })
  );
}

module.exports = {
  submitForm,
  verifyEmail
};