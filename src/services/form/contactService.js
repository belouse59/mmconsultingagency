"use strict";

const contactRepo =
    require("../../repositories/form/contactsRepository");

const contactRequestRepo =
    require("../../repositories/form/contactRequestsRepository");

const {
    isValidEmail,
    isValidPhone,
} = require("../../utils/validators");

const {
    clean,
} = require("../../utils/sanitizer");

const {
    sendVerificationEmail,
    notifyNewLead,
} = require("../../services/emailService");

async function submit(data = {}) {

    /* -----------------------------
       VALIDATION
    ----------------------------- */

    if (!data.email || !isValidEmail(data.email)) {
        return {
            success: false,
            message: "Indirizzo email non valido.",
        };
    }

    if (!data.firstname || data.firstname.trim().length < 2) {
        return {
            success: false,
            message: "Nome non valido.",
        };
    }

    if (data.phone && !isValidPhone(data.phone)) {
        return {
            success: false,
            message: "Numero di telefono non valido.",
        };
    }

    if (!data.consent) {
        return {
            success: false,
            message: "Consenso obbligatorio.",
        };
    }

    /* -----------------------------
       SANITIZE
    ----------------------------- */

    const email = clean(data.email).trim().toLowerCase();

    const firstName = clean(data.firstname);
    const lastName = clean(data.lastname || "");
    const phone = clean(data.phone || "");

    const energyType = clean(data.energyType || null);
    const preferredContactTime = clean(data.contactTime || "");
    const message = clean(data.messageForm || "");

    /* -----------------------------
       CONTACT
    ----------------------------- */

    let contact = await contactRepo.findByEmail(email);

    if (!contact) {
        contact = await contactRepo.createContact({
            email,
            firstName,
            lastName,
            phone: phone || null,
        });
    }

    /* -----------------------------
       CONTACT REQUEST
    ----------------------------- */

    await contactRequestRepo.createContactRequest({
        contactId: contact.id,
        energyType: energyType || null,
        preferredContactTime: preferredContactTime || null,
        message: message || null,
        consent: true,
    });

    /* -----------------------------
       EMAIL VERIFICATION
    ----------------------------- */

    if (!contact.verified) {
        try {
            await sendVerificationEmail(email, "form", contact.firstName);
        } catch (err) {
            console.error(
                "[contactService/sendVerification]",
                err
            );
        }
    }

    /* -----------------------------
       SALES NOTIFICATION
    ----------------------------- */

    notifyNewLead({
        contactId: contact.id,
        email,
        firstName,
        lastName,
        phone,
        energyType,
        preferredContactTime,
        message,
        formType: "contact"
    }).catch(console.error);

    /* -----------------------------
       RESPONSE
    ----------------------------- */

    return {
        success: true,
        message: contact.verified
            ? "Richiesta ricevuta."
            : "Richiesta ricevuta. Verifica la tua email.",
    };
}

module.exports = {
    submit,
};