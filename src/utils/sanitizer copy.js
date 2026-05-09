"use strict";

/**
 * Sanitize a string for safe storage in Google Sheets.
 *
 * Protections applied:
 *  1. Strip all HTML/XML tags.
 *  2. Prepend a single-quote to neutralize spreadsheet formula injection
 *     (=, +, -, @, tab, carriage-return starters).
 *  3. Trim whitespace.
 *  4. Cap length to avoid absurdly large payloads in cells.
 *
 * @param {*}      input    - Any value (will be coerced to string)
 * @param {number} maxLen   - Maximum allowed length (default 2000)
 * @returns {string}
 */
function clean(input, maxLen = 2000) {
  if (input === null || input === undefined) return "";

  let s = String(input)
    .replace(/<[^>]*>/g, "")           // strip HTML tags
    .replace(/[\u0000-\u001F\u007F]/g, " ") // strip control characters
    .trim();

  // Formula injection guard
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

  // Length cap
  if (s.length > maxLen) s = s.substring(0, maxLen);

  return s;
}

module.exports = { clean };