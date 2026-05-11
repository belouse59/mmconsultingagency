"use strict";

const { appendRow, getSheetValues }      = require("../services/sheetsService");
const { isValidEmail, isValidPhone }     = require("../utils/validators");
const { clean }                          = require("../utils/sanitizer");
const { notifyNewLead, notifySimulator } = require("../services/emailService");
const { translateFormData }              = require("../utils/translation");
const { getLocalTimestamp }              = require("../utils/dateFormat");

/* ─────────────────────────────────────────────────────────────
   IN-MEMORY RATE LIMITER
   Replace with Redis (ioredis + rate-limiter-flexible) in
   production for persistence across restarts.
───────────────────────────────────────────────────────────── */
const rateMap = new Map(); // key → { count, resetAt }

function isRateLimited(identifier) {
  const key = String(identifier).replace(/[^a-zA-Z0-9@.]/g, "_").substring(0, 200);
  const now = Date.now();
  const entry = rateMap.get(key);

  if (entry) {
    if (now < entry.resetAt) {
      if (entry.count >= 5) return true;
      entry.count++;
    } else {
      // Window expired — reset
      rateMap.set(key, { count: 1, resetAt: now + 3600_000 });
    }
  } else {
    rateMap.set(key, { count: 1, resetAt: now + 3600_000 });
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────
   RESPONSE HELPERS
───────────────────────────────────────────────────────────── */
const ok  = (message = "ok")    => ({ status: "success", message });
const err = (message = "error") => ({ status: "error",   message });

/* ─────────────────────────────────────────────────────────────
   HANDLERS
───────────────────────────────────────────────────────────── */
async function handleContact(data) {
  // Validate
  if (!data.email || !isValidEmail(data.email))
    return err("Indirizzo email non valido.");

  if (!data.firstname || data.firstname.trim().length < 2)
    return err("Nome non valido (minimo 2 caratteri).");

  if (data.phone && !isValidPhone(data.phone))
    return err("Numero di telefono non valido.");

  // Write to sheet
  await appendRow("ContactUsForm", [
    getLocalTimestamp(),
    clean(data.firstname),
    clean(data.lastname   || ""),
    clean(data.email),
    clean(data.phone      || ""),
    clean(data.energyType || ""),
    clean(data.contactTime || ""),
    clean(data.messageForm || ""),
    "contact",
    clean(data.consent)
  ]);

  // Fire-and-forget — never blocks the API response
  notifyNewLead(data);

  return ok("Richiesta ricevuta con successo.");
}

async function handleNewsletter(data) {
  if (!data.email || !isValidEmail(data.email))
    return err("Indirizzo email non valido.");

  // Duplicate check
  let rows = [];
  try {
    rows = await getSheetValues("NewsLetters");
  } catch {
    // If read fails we still allow the subscription attempt
  }

  const already = rows.some((r) => r[1] === data.email.trim());
  if (already) return err("Already subscribed");

  await appendRow("NewsLetters", [
    getLocalTimestamp(),
    clean(data.email),
    "newsletter",
  ]);

  return ok("Iscrizione completata.");
}

async function handleSimulator(data) {
  // Numeric fields — always coerce, never trust the client
  await appendRow("simulations", [
    getLocalTimestamp(),
    clean(data.selectedHouse      || ""),
    clean(data.locationValue      || ""),
    Math.max(0, Number(data.surface)             || 0),
    clean(data.selectedEnergy     || ""),
    Math.max(0, Number(data.selectedPeople)      || 0),
    clean(data.selectedProvider   || ""),
    Math.max(0, Number(data.bill)                || 0),
    Math.max(0, Number(data.electricityValueKwh) || 0),
    Math.max(0, Number(data.gasValueKwh)         || 0),
    Math.max(0, Number(data.monthlySavings)      || 0),
    "simulator",
  ]);

  // Fire-and-forget notification
  let mail = await notifySimulator(data);

  return ok("Simulazione registrata.");
}

/* ─────────────────────────────────────────────────────────────
   MAIN ROUTE HANDLER
───────────────────────────────────────────────────────────── */
async function submitForm(req, res) {
  
  const data = req.body;
  
  // Basic shape check
  if (!data || typeof data !== "object" || !data.formType) {
    return res.status(400).json(err("Dati non validi."));
  }

  const VALID_TYPES = ["contact", "newsletter", "simulator"];
  if (!VALID_TYPES.includes(data.formType)) {
    return res.status(400).json(err("Tipo di modulo non riconosciuto."));
  }

  if (data.company) {
  // Silent discard — don't tell bots they were detected
  return res.status(200).json(ok("Request processed"));
}

  if (!data || !data.formType || (data.consent !== "SI" && data.formType === "contact")) {
    return res.status(400).json(err("Invalid data"));
  }

  // Rate limit by email (or IP as fallback)
  const identity = data.email || req.ip;
  if (isRateLimited(identity)) {
    return res.status(429).json(err("Troppi tentativi. Riprova tra un'ora."));
  }

  try {
    let result;
    switch (data.formType) {
      case "contact":    result = await handleContact(translateFormData(data));    break;
      case "newsletter": result = await handleNewsletter(translateFormData(data)); break;
      case "simulator":  result = await handleSimulator(translateFormData(data));  break;
    }
    return res.json(result);
  } catch (e) {
    console.error("[formController]", e.message);
    return res.status(500).json(err("Errore interno. Riprova più tardi."));
  }
}

module.exports = { submitForm };