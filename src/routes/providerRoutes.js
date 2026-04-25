const express = require("express");
const router = express.Router();
const { getProviders } = require("../controllers/providerController");

router.get("/", getProviders);

module.exports = router;