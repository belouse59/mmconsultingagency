const express = require("express");
const router = express.Router();
const { getPartnerImages } = require("../controllers/partnerController");

router.get("/images", getPartnerImages);

module.exports = router;