"use strict";

const fs   = require("fs");
const path = require("path");

const PROVIDERS_DIR  = path.join(__dirname, "../../public/assets/sim-providers");
const PROVIDERS_DATA = path.join(__dirname, "../data/providers.json");
const IMAGE_EXT      = /\.(png|jpg|jpeg|webp|svg)$/i;

let _cache = null;

function getProviders(req, res) {
  if (_cache) return res.json(_cache);

  // Load name/key metadata from JSON if it exists
  let meta = {};
  if (fs.existsSync(PROVIDERS_DATA)) {
    try {
      const raw = fs.readFileSync(PROVIDERS_DATA, "utf-8");
      const arr = JSON.parse(raw);
      arr.forEach((p) => { meta[p.key] = p; });
    } catch (e) {
      console.warn("[providerController] Could not parse providers.json:", e.message);
    }
  }

  fs.readdir(PROVIDERS_DIR, (err, files) => {
    if (err) {
      console.error("[providerController] Cannot read providers dir:", err.message);
      return res.status(500).json({ error: "Cannot read providers folder." });
    }

    const providers = files
      .filter((f) => IMAGE_EXT.test(f))
      .sort()
      .map((file) => {
        const key  = file.replace(IMAGE_EXT, "").toLowerCase();
        const info = meta[key] || {};
        return {
          key,
          name:  info.name  || key.toUpperCase(),
          image: `/assets/sim-providers/${file}`,
        };
      });

    _cache = providers;
    res.json(providers);
  });
}

module.exports = { getProviders };