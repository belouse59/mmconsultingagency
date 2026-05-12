const fs = require("fs");
const path = require("path");

const cache = new Map();

function loadTemplate(filename, variables = {}) {
  if (!cache.has(filename)) {
    const filePath = path.join(__dirname, "..", "templates", filename);
    cache.set(filename, fs.readFileSync(filePath, "utf8"));
  }

  let html = cache.get(filename);
  Object.entries(variables).forEach(([key, value]) => {
    html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] ?? "";
    });
  });

  return html;
}

module.exports = { loadTemplate }