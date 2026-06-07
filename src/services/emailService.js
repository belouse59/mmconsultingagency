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

async function sendCustomerPasswordReset({user, token, expiresAt, origin}) {
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
    to: user.identifier,
    subject: "Conferma la tua richiesta",
    html
  });
}

/**
 * Send notification when a new contact form is submitted.
 * Fails silently — never blocks API response.
 */
async function notifyNewLead(data) {
  if (!process.env.NOTIFY_TO) return;
  try {
    const html = loadTemplate("new-lead-email.html", {
      DATE: getLocalTimestamp() || "",

      FIRSTNAME: data.firstName || "",
      LASTNAME: data.lastName || "",
      EMAIL: data.email || "",

      PHONE: data.phone || "Non fornito",
      ENERGY_TYPE: data.energyType || "Non specificato",
      CONTACT_TIME: data.preferredContactTime || "Non specificato",
      MESSAGE: data.message || "Nessun messaggio",
      FORM_TYPE: data.formType || "contact",
    },
      true
    );

    await resend.emails.send({
      from: `${process.env.BRAND_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: process.env.NOTIFY_TO,
      subject: `Nuova richiesta da ${data.firstname || ""} ${data.lastname || ""}`,
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

module.exports = {
  sendVerificationEmail,
  sendCustomerPasswordReset,
  notifyNewLead,
  notifySimulator,
};