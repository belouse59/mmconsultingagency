"use strict";

const contactRepo =
    require("../repositories/form/contactsRepository");

const newsletterRepo =
    require("../repositories/form/newslettersRepository");

const customerRepo =
    require("../repositories/loyalty/customersRepository");

const {
    verifyToken,
} = require("./tokenService");

const { makeError } = require("../utils/errorHandler");

async function verifyEmailContact_Newsletter(token) {

    const payload =
        verifyToken(token);

    const contact =
        await contactRepo.findByEmail(
            payload.email
        );

    const newsletterContact =
        await newsletterRepo.findByEmail(
            payload.email
        );

    if (!contact && !newsletterContact) {
        throw makeError(
            "Validation Not Processed",
            404
        );
    }

    let alreadyVerified = false;

    if (contact) {

        if (contact.verified) {
            alreadyVerified = true;
        } else {
            await contactRepo.markVerified(
                contact.id
            );
        }
    }

    if (newsletterContact) {

        if (newsletterContact.verified) {
            alreadyVerified = true;
        } else {
            await newsletterRepo.markVerified(
                newsletterContact.id
            );
        }
    }

    return {
        alreadyVerified,
        email: payload.email
    };
}

async function verifyCustomer(token) {

    const payload =
        verifyToken(token);

    const customer =
        await customerRepo.findCustomerByIdentifier(
            payload.email
        );


    if (!customer) {
        throw makeError(
            "Validation Not Processed",
            404
        );
    }

    let alreadyVerified = false;

    if (customer.verified) {
        alreadyVerified = true;
    } else {
        await customerRepo.markVerified(
            customer.id
        );
    }


    return {
        alreadyVerified,
        email: payload.email
    };
}


module.exports = {
    verifyEmailContact_Newsletter,
    verifyCustomer
};