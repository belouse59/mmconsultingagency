function clean(str) {
  return str
    ? String(str)
        .replace(/<[^>]*>/g, "")
        .replace(/^[=+\-@]/, "'")
        .trim()
    : "";
}

module.exports = { clean };