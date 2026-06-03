"use strict";

const contactRepo =
    require("../../repositories/form/contactsRepository");

const newsletterRepo =
    require("../../repositories/form/newslettersRepository");

const {
    isValidEmail,
} = require("../../utils/validators");

const {
    clean,
} = require("../../utils/sanitizer");

const { sendVerificationEmail } = require("../../services/emailService");

async function subscribe(data = {}) {

    if (
        !data.email ||
        !isValidEmail(data.email)
    ) {
        return {
            success: false,
            message: "Indirizzo email non valido.",
        };
    }

    const email =
        clean(data.email)
            .trim()
            .toLowerCase();


    const contactNewsletters = await newsletterRepo.subscribe(
        email
    );
    const contact =
         await contactRepo.findByEmail(email);

        /* -----------------------------
       EMAIL VERIFICATION
    ----------------------------- */

    if (!contactNewsletters?.verified && !contact?.verified) {
        try {
            await sendVerificationEmail(email, "form", "");
        } catch (err) {
            console.error(
                "[contactService/sendVerification]",
                err
            );
        }
    } else if(contactNewsletters?.verified || contact?.verified) {
        if(contactNewsletters && !contactNewsletters?.verified) newsletterRepo.markVerified(contactNewsletters.id);
        if(contact && !contact?.verified) contactRepo.markVerified(contact.id);
    }


    return {
        success: true,
        message: "Iscrizione completata.",
    };
}

async function unsubscribe(data = {}) {

    if (
        !data.email ||
        !isValidEmail(data.email)
    ) {
        return {
            success: false,
            message: "Indirizzo email non valido.",
        };
    }

    const email =
        clean(data.email)
            .trim()
            .toLowerCase();

    await newsletterRepo.unsubscribe(
        email
    );

    return {
        success: true,
        message: "Iscrizione completata.",
    };
}

module.exports = {
    subscribe,
    unsubscribe
};