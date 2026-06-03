const express = require("express");
const router = express.Router();
const { submitForm } = require("../controllers/formController");
const { verifyContact_Newsletter } = require("../controllers/verificationController");
router.post("/submit", submitForm);
router.get("/verify", verifyContact_Newsletter);

module.exports = router;