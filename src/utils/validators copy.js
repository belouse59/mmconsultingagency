"use strict";

/**
 * Email: standard RFC 5322 simplified pattern.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

/**
 * Phone: accepts Italian and international formats.
 * +39 090 941 2150 | +34123456789 | 0909412150
 */
function isValidPhone(phone) {
  return /^\+?[\d\s\-().]{7,20}$/.test(String(phone).trim());
}

/**
 * Non-empty string with minimum length.
 */
function isValidName(name, min = 2) {
  return typeof name === "string" && name.trim().length >= min;
}

/**
 * One of a finite set of allowed string values.
 */
function isOneOf(value, allowed = []) {
  return allowed.includes(String(value));
}

module.exports = { isValidEmail, isValidPhone, isValidName, isOneOf };