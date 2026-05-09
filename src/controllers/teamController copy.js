"use strict";

const fs   = require("fs");
const path = require("path");

const TEAM_FILE = path.join(__dirname, "../data/team.json");

function getTeam(req, res) {
  fs.readFile(TEAM_FILE, "utf-8", (err, data) => {
    if (err) {
      console.error("[teamController] Cannot read team.json:", err.message);
      return res.status(500).json({ error: "Cannot load team data." });
    }

    try {
      const team = JSON.parse(data);
      res.json(team);
    } catch (parseErr) {
      console.error("[teamController] Invalid JSON in team.json:", parseErr.message);
      res.status(500).json({ error: "Team data is malformed." });
    }
  });
}

module.exports = { getTeam };