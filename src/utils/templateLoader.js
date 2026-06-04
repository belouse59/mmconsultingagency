const fs = require("fs");
const path = require("path");

const cache = new Map();

function loadTemplate(filename, variables = {}, isEmail) {
  const path = isEmail ? "templates/emails" : "templates"
  if (!cache.has(filename)) {
    const filePath = path.join(__dirname, "..", path, filename);
    cache.set(filename, fs.readFileSync(filePath, "utf8"));
  }

  const template = cache.get(filename);

  const normalized = {};
  for (const [k, v] of Object.entries(variables)) {
    normalized[k.toUpperCase()] = v;
  }

  return template.replace(/\{\{([\w.-]+)\}\}/g, (_, key) => {
    return normalized[key] ?? "";
  });
}

module.exports = { loadTemplate }