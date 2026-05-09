const { appendRow, getSheetValues } = require("../services/sheetsService");
const { isValidEmail, isValidPhone } = require("../utils/validators");
const { clean } = require("../utils/sanitizer");

// simple in-memory rate limit (replace with Redis later if needed)
const rateMap = new Map();

function isRateLimited(email) {
  const key = email.replace(/[^a-zA-Z0-9]/g, "_");
  const count = rateMap.get(key) || 0;

  if (count >= 5) return true;

  rateMap.set(key, count + 1);
  setTimeout(() => rateMap.delete(key), 3600 * 1000);

  return false;
}

function respond(status, message) {
  return { status, message };
}

/* ---------------- CONTACT ---------------- */
async function handleContact(data) {
  if (!data.email || !isValidEmail(data.email)) {
    return respond("error", "Invalid email");
  }

  if (!data.firstname || data.firstname.trim().length < 2) {
    return respond("error", "Invalid name");
  }

  if (data.phone && !isValidPhone(data.phone)) {
    return respond("error", "Invalid phone");
  }

  await appendRow("ContactUsForm", [
    new Date(),
    clean(data.firstname),
    clean(data.lastname),
    clean(data.email),
    clean(data.phone),
    clean(data.energyType),
    clean(data.contactTime),
    clean(data.messageForm),
    "contact",
  ]);

  return respond("success", "Contact created");
}

/* ---------------- NEWSLETTER ---------------- */
async function handleNewsletter(data) {
  if (!data.email || !isValidEmail(data.email)) {
    return respond("error", "Invalid email");
  }

  const rows = await getSheetValues("NewsLetters");

  const alreadySubscribed = rows.some((r) => r[1] === data.email);

  if (alreadySubscribed) {
    return respond("error", "Already subscribed");
  }

  await appendRow("NewsLetters", [
    new Date(),
    clean(data.email),
    "newsletter",
  ]);

  return respond("success", "Subscribed");
}

/* ---------------- SIMULATOR ---------------- */
async function handleSimulator(data) {
  await appendRow("simulations", [
    new Date(),
    clean(data.selectedHouse),
    clean(data.locationValue),
    Number(data.surface) || 0,
    clean(data.selectedEnergy),
    Number(data.selectedPeople) || 0,
    clean(data.selectedProvider),
    Number(data.bill) || 0,
    Number(data.electricityValueKwh) || 0,
    Number(data.gasValueKwh) || 0,
    Number(data.monthlySavings) || 0,
    "simulator",
  ]);

  return respond("success", "Simulation registered");
}

/* ---------------- MAIN ROUTER ---------------- */
async function submitForm(req, res) {
  const data = req.body;

  if (!data || !data.formType) {
    return res.json(respond("error", "Invalid data"));
  }

  if (data.email && isRateLimited(data.email)) {
    return res.json(respond("error", "Too many requests"));
  }

  switch (data.formType) {
    case "contact":
      return res.json(await handleContact(data));

    case "newsletter":
      return res.json(await handleNewsletter(data));

    case "simulator":
      return res.json(await handleSimulator(data));

    default:
      return res.json(respond("error", "Invalid form type"));
  }
}

module.exports = { submitForm };