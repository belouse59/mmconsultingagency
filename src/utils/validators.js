function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

function isValidPhone(phone) {
  return /^\+?[\d\s\-]{7,15}$/.test(String(phone));
}

module.exports = { isValidEmail, isValidPhone };