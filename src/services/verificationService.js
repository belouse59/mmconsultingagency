"use strict";

const contactRepo =
    require("../repositories/form/contactsRepository");

const contactRequestRepo =
    require("../repositories/form/contactRequestsRepository");

const newsletterRepo =
    require("../repositories/form/newslettersRepository");

const customerRepo =
    require("../repositories/loyalty/customersRepository");

const {
    verifyToken,
} = require("./tokenService");

const {
    notifyNewLead,
} = require("./emailService");

const { makeError } = require("../utils/errorHandler");

/**
 * Changes from previous version:
 *   - When a contact is verified for the first time (not
 *     already verified), this now triggers notifyNewLead —
 *     this is the ONLY point at which a new/unverified
 *     contact's lead notification fires. See
 *     contactService.submit(), which deliberately does NOT
 *     call notifyNewLead for unverified contacts.
 *   - Uses contactRequestRepo.findLatestByContactId() to
 *     recover the actual submission content (message,
 *     category, source) via the contact_id FK, so the
 *     notification shows what they asked about — not just
 *     the bare email address.
 *   - Guarded by `alreadyVerified`: clicking an old/repeat
 *     verification link never re-sends the notification.
 *   - notifyNewLead failures are caught and swallowed —
 *     verification succeeding is the priority; a failed
 *     internal notification should never surface as an
 *     error to the person verifying their email.
 */
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

            // First-time verification — this is where the sales
            // notification fires for new/unverified contacts.
            // contactService.submit() deliberately skipped it.
            await _notifyVerifiedLead(contact);
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

/* ─────────────────────────────────────────────
   INTERNAL — fire notifyNewLead on first verification
   Uses contact_id to recover the most recent
   contact_request so the notification reflects what
   the person actually submitted.
───────────────────────────────────────────── */

async function _notifyVerifiedLead(contact) {
    try {
        const request =
            await contactRequestRepo.findLatestByContactId(
                contact.id
            );

        // Defensive — should always exist (created in the same
        // flow that led to this verification), but a contact
        // record without any request should never block
        // verification from succeeding.
        if (!request) return;

        await notifyNewLead({
            contactId:             contact.id,
            email:                 contact.email,
            firstName:             contact.firstName,
            lastName:              contact.lastName,
            phone:                 contact.phone,
            energyType:            request.energyType,
            category:              request.category,
            source:                request.source,
            preferredContactTime:  request.preferredContactTime,
            message:               request.message,
            formType:              request.source === "loyalty" ? "loyalty" : "contact",
        });

    } catch (err) {
        console.error(
            "[verificationService/_notifyVerifiedLead]",
            err
        );
    }
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