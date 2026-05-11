const express = require("express");
const router = express.Router();
try {
  const { submitForm } = require("../controllers/formController");
  console.log("submitForm =", typeof submitForm);

  router.post("/submit", submitForm);
} catch (e) {
  console.error("FORM ROUTE LOAD ERROR:");
  console.error(e);
}

module.exports = router;