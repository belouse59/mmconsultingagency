"use strict";

const contactService    = require("../services/form/contactService");
const newsletterService = require("../services/form/newsletterService");
const simulatorService  = require("../services/form/simulatorService");
const { verifyToken }   = require("../services/tokenService");

async function submitForm(req, res) {
  try {

    const { formType } = req.body;

    let result;

    switch (formType) {

      case "contact":
        result = await contactService.submit(req.body);
        break;

      case "newsletter":
        result = await newsletterService.subscribe(req.body);
        break;

      case "simulator":
        result = await simulatorService.submit(req.body);
        break;

      default:
        return res.status(400).json({
          success:false,
          message:"Tipo modulo non valido"
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