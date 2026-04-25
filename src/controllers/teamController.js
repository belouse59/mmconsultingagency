const fs = require("fs");
const path = require("path");

const getTeam = (req, res) => {
  const filePath = path.join(__dirname, "../data/team.json");

  fs.readFile(filePath, "utf-8", (err, data) => {
    if (err) return res.status(500).json({ error: "Cannot load team" });

    const team = JSON.parse(data);
    res.json(team);
  });
};

module.exports = { getTeam };