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

    // let contact =
    //     await contactRepo.findByEmail(email);

    // if (!contact) {

    //     contact =
    //         await contactRepo.createContact({
    //             email,
    //             firstName: null,
    //             lastName: null,
    //             phone: null,
    //         });
    // }

    await newsletterRepo.subscribe(
        email
    );

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