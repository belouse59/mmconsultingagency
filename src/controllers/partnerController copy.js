"use strict";

const fs   = require("fs");
const path = require("path");

const PARTNERS_DIR = path.join(__dirname, "../../public/assets/partners");
const IMAGE_EXT    = /\.(png|jpg|jpeg|webp|svg)$/i;

// Simple in-memory cache — invalidated when server restarts (fine for static assets)
let _cache = null;

function getPartnerImages(req, res) {
  if (_cache) return res.json(_cache);

  fs.readdir(PARTNERS_DIR, (err, files) => {
    if (err) {
      console.error("[partnerController] Cannot read partners dir:", err.message);
      return res.status(500).json({ error: "Cannot read partners folder." });
    }

    const urls = files
      .filter((f) => IMAGE_EXT.test(f))
      .sort()
      .map((f) => `/assets/partners/${f}`);

    _cache = urls;
    res.json(urls);
  });
}

module.exports = { getPartnerImages };