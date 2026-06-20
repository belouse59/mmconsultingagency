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

/**
 * Handles both the homepage energy form and the loyalty
 * contact form (and any future contact-style form). Both
 * write to the same `contacts` + `contact_requests` tables —
 * a contact request is the same entity regardless of which
 * page it came from, only `source`/`category` differ.
 *
 * Notification timing (changed from previous version):
 *   - contact already verified (returning contact) →
 *     notifyNewLead fires immediately, as before.
 *   - contact new / not yet verified →
 *     ONLY the verification email is sent here.
 *     notifyNewLead does NOT fire on submission — it fires
 *     once, when the contact clicks the verification link.
 *     See verificationService.verifyEmailContact_Newsletter.
 *
 * This keeps sales notified instantly for known-good repeat
 * contacts, while first-time/unconfirmed emails only generate
 * a notification once proven deliverable — avoiding notifying
 * on typos, bot submissions, and throwaway addresses.
 */
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
    const lastName  = clean(data.lastname || "");
    const phone     = clean(data.phone || "");

    const source = clean(data.source || "home");

    const category = clean(data.category || data.energyType || "");

    const energyType = source === "home" ? (category || null) : null;

    const preferredContactTime = clean(data.contactTime || "");
    const message               = clean(data.messageForm || "");

    /* -----------------------------
       CONTACT
    ----------------------------- */

    let contact = await contactRepo.findByEmail(email);
    const isNewContact = !contact;

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
       Stored regardless of verification state — every
       submission is recorded. Verification only gates
       the internal notification, not the data capture.
    ----------------------------- */

    await contactRequestRepo.createContactRequest({
        contactId:             contact.id,
        energyType:            energyType,
        source:                source,
        category:              category || null,
        preferredContactTime:  preferredContactTime || null,
        message:               message || null,
        consent:               true,
    });

    /* -----------------------------
       VERIFICATION EMAIL
       Only sent to genuinely new/unverified contacts.
       A contact that's already verified from a previous
       submission never needs to re-verify.
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
       Fires immediately ONLY if the contact was already
       verified before this submission. For new/unverified
       contacts, notifyNewLead is deferred until they click
       the verification link — see
       verificationService.verifyEmailContact_Newsletter,
       which calls notifyNewLead itself once verified=true
       is set, using contactRequestRepo.findLatestByContactId()
       to recover this submission's content.
    ----------------------------- */

    if (contact.verified) {
        notifyNewLead({
            contactId:             contact.id,
            email,
            firstName,
            lastName,
            phone,
            energyType,
            category,
            source,
            preferredContactTime,
            message,
            formType: data.formType || "contact",
        }).catch(console.error);
    }

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