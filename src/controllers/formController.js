"use strict";

const contactService = require("../services/form/contactService");
const newsletterService = require("../services/form/newsletterService");
const simulatorService = require("../services/form/simulatorService");

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

module.exports = {
  submitForm
};