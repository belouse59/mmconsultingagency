const express = require("express");
const router = express.Router();
const { submitForm } = require("../controllers/formController");
console.log("submitForm in formRoutes");
router.post("/submit", submitForm);

module.exports = router;