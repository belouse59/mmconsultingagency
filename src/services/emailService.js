const { Resend } = require("resend");
const { loadTemplate } = require("../utils/templateLoader");
const { getLocalTimestamp } = require("../utils/dateFormat");
const {
  generateToken,
} = require("../services/tokenService");


const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email, route, name) {
  const token = generateToken(email);
  const verifyUrl =
    `${process.env.APP_URL}/api/${route}/verify?token=${token}`;

  const html = loadTemplate(
    "verification-email.html",
    {
      VERIFY_URL: verifyUrl,
      FULL_NAME: name
    },
    true
  );

  return resend.emails.send({
    from: `${process.env.BRAND_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
    to: email,
    subject: "Conferma la tua richiesta",
    html
  });
}

async function sendCustomerPasswordReset({ user, token, expiresAt, origin }) {
  const resetUrl = `${process.env.APP_URL}/api/loyalty/${origin}/reset-password?token=${token}`;

  const html = loadTemplate(
    "forgot-password-email.html",
    {
      RESET_LINK: resetUrl,
      YEAR: new Date().YEAR
    },
    true
  );

  return resend.emails.send({
    from: `${process.env.BRAND_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
    to: user.identifier || user.email,
    subject: "Conferma la tua richiesta",
    html
  });
}

/**
 * Send notification when a new contact form is submitted.
 * Fails silently — never blocks API response.
 *
 * Changes from previous version:
 *   - Fixed subject line: was reading data.firstname/lastname
 *     (lowercase) but the payload from contactService.submit()
 *     sends firstName/lastName (camelCase) — the subject was
 *     always rendering as "Nuova richiesta da  " (empty).
 *   - Added SOURCE_LABEL + CATEGORY_LABEL template variables so
 *     the email distinguishes "Energia: Gas" (home) from
 *     "Richiesta: Partner" (loyalty) at a glance, instead of
 *     always showing a row labelled "Energia" regardless of
 *     where the lead came from.
 */
async function notifyNewLead(data) {
  if (!process.env.NOTIFY_TO) return;
  try {
    const source = data.source || "home";

    // Per-source row label and value — keeps a single template
    // working correctly for every lead source without hardcoding
    // "Energia" for non-energy leads.
    const CATEGORY_ROW_LABEL = source === "loyalty" ? "Richiesta" : "Energia";
    const categoryValue = data.category || data.energyType || "Non specificato";

    const html = loadTemplate("new-lead-email.html", {
      DATE: getLocalTimestamp() || "",

      FIRSTNAME: data.firstName || "",
      LASTNAME: data.lastName || "",
      EMAIL: data.email || "",

      PHONE: data.phone || "Non fornito",

      // New — works for every source. Use these two in the template
      // instead of the hardcoded "Energia" row (see updated HTML below).
      CATEGORY_ROW_LABEL: CATEGORY_ROW_LABEL,
      CATEGORY: categoryValue,

      SOURCE: source === "loyalty" ? "Loyalty (Energy Club)" : "Sito — Homepage",

      CONTACT_TIME: data.preferredContactTime || "Non specificato",
      MESSAGE: data.message || "Nessun messaggio",
      FORM_TYPE: data.formType || "contact",
    },
      true
    );

    // Fixed: was data.firstname/data.lastname (lowercase) which
    // never existed on the payload — subject always rendered blank.
    const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();

    await resend.emails.send({
      from: `${process.env.BRAND_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: process.env.NOTIFY_TO,
      subject: fullName
        ? `Nuova richiesta da ${fullName}`
        : "Nuova richiesta di contatto",
      html,
    }).then(email => console.log(email));
  } catch (err) {
    console.error(
      "[emailService] Failed to send lead notification:",
      err.message
    );
  }
}

/**
 * Send notification when simulator is completed.
 * Fails silently.
 */
async function notifySimulator(data) {
  if (!process.env.NOTIFY_TO) return;
  try {
    const html = loadTemplate("simulator-email.html", {
      DATE: getLocalTimestamp() || "",

      MONTHLY_SAVINGS: data.monthlySavings || 0,
      ENERGY_TYPE: data.selectedEnergy || "Non specificato",
      HOUSE_TYPE: data.selectedHouse || "Non specificato",
      LOCATION: data.locationValue || "Non specificato",
      SURFACE: data.surface || 0,
      PEOPLE: data.selectedPeople || "Non specificato",
      PROVIDER: data.selectedProvider || "Non specificato",
      BILL: data.bill || 0,

      ELECTRICITY_KWH: data.electricityValueKwh || 0,
      GAS_KWH: data.gasValueKwh || 0,
      ESTIMATION_TYPE: data.estimationType || "unknown",
      FORM_TYPE: data.formType || "simulator",
    }, true
    );

    await resend.emails.send({
      from: `${process.env.BRAND_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: process.env.NOTIFY_TO,
      subject: `Nuova simulazione — risparmio ${data.monthlySavings || "?"}€/mese`,
      html,
    }).then(mail => console.log(mail));
  } catch (err) {
    console.error(
      "[emailService] Failed to send simulator notification:",
      err.message
    );
  }
}

/**
 * Send notification when a new partner request is submitted
 * via the loyalty landing page ("Richiedi di diventare Partner").
 * Fails silently — never blocks the API response.
 *
 * @param {{
 *   businessName: string,
 *   vatNumber?:    string|null,
 *   email:        string,
 *   phone?:        string|null,
 *   category:     string,
 *   description?:  string|null,
 *   submittedAt?:  string|Date,
 * }} data — the created loyalty_partner_requests row
 *           (camelCase, as returned by
 *           partnerRequestsRepository.mapPartnerRequest)
 */
async function notifyPartnerRequest(data) {
  if (!process.env.NOTIFY_TO) return;
  try {
    const html = loadTemplate("partner-request-email.html", {
      DATE: getLocalTimestamp() || "",

      BUSINESS_NAME: data.businessName || "",
      VAT_NUMBER: data.vatNumber || "Non fornita",
      EMAIL: data.email || "",
      PHONE: data.phone || "Non fornito",
      CATEGORY: data.category || "Non specificata",
      DESCRIPTION: data.description || "Nessuna descrizione fornita",
      FORM_TYPE: "partner-request",
    }, true
    );

    await resend.emails.send({
      from: `${process.env.BRAND_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: process.env.NOTIFY_TO,
      subject: `Nuova richiesta partner — ${data.businessName || "Attività"}`,
      html,
    }).then(mail => console.log(mail));
  } catch (err) {
    console.error(
      "[emailService] Failed to send partner request notification:",
      err.message
    );
  }
}

module.exports = {
  sendVerificationEmail,
  sendCustomerPasswordReset,
  notifyNewLead,
  notifySimulator,
  notifyPartnerRequest,
};