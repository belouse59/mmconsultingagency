"use strict";

const customerRepo =
  require("../../repositories/loyalty/customersRepository");

const {
  hashPassword,
  verifyPassword,
} =
  require("../../utils/argon2");

const { generateUUID } = require("../../utils/generateUUID");

const passwordResetService = require("./passwordResetService")

const {
  makeError,
} =
  require("../../utils/errorHandler");

  const { sendVerificationEmail } = require("../../services/emailService");

/* ───────────────────────────────────────────── */

async function getCustomers() {
  return customerRepo.findCustomers();
}

async function getActiveCustomers() {
  return customerRepo.findActiveCustomers();
}

async function getCustomerByIdentifier(
  identifier
) {
  return customerRepo
    .findCustomerByIdentifier(
      normalizeIdentifier(
        identifier
      )
    );
}

/* ─────────────────────────────────────────────
   REGISTER
────────────────────────────────────────────── */

async function register({
  full_name,
  identifier,
  password,
}) {

  validateRegisterInput({
    full_name,
    identifier,
    password,
  });

  const normalized =
    normalizeIdentifier(
      identifier
    );

  const identifierType =
    detectIdentifierType(
      normalized
    );

  const hash =
    await hashPassword(
      password
    );

  try {

    const customer =
      await customerRepo
        .createCustomer({

          id:
            generateUUID("customer"),

          full_name,

          identifier:
            normalized,

          identifierType,

          password:
            hash,

          active:
            false,
        });
        await sendVerificationEmail(customer.identifier,"loyalty/customer", customer.full_name);

    return {
      customerId:
        customer.id,

      full_name:
        customer.full_name,
        
      identifier: 
        customer.identifier
    };

  }

  catch (err) {

    if (
      isDuplicateError(
        err
      )
    ) {

      throw makeError(
        "Utente già registrato.",
        409
      );

    }

    throw err;

  }

}


/* ─────────────────────────────────────────────
   LOGIN
────────────────────────────────────────────── */

async function login({
  identifier,
  password,
}) {

  if (
    !identifier ||
    !password
  ) {
    throw makeError(
      "Credenziali non valide.",
      401
    );
  }

  const customer =
    await customerRepo
      .findCustomerByIdentifier(
        normalizeIdentifier(
          identifier
        )
      );

  if (
    !customer
  ) {

    throw makeError(
      "Credenziali non valide.",
      401
    );

  }

  const valid =
    await verifyPassword(
      password,
      customer.password
    );

  if (
    !valid
  ) {

    throw makeError(
      "Credenziali non valide.",
      401
    );

  }

  if (
    !customer.active
  ) {

    throw makeError(
      "Account sospeso.",
      403
    );

  }

  return {

    customerId:
      customer.id,

    full_name:
      customer.full_name,

  };

}

/* ─────────────────────────────────────────────
   VALIDATION
────────────────────────────────────────────── */

function validateRegisterInput(
  data
) {

  if (
    !data.full_name?.trim()
  ) {
    throw makeError(
      "Nome obbligatorio",
      400
    );
  }

  if (
    !data.identifier?.trim()
  ) {
    throw makeError(
      "Email o telefono obbligatorio",
      400
    );
  }

  if (
    !data.password
  ) {
    throw makeError(
      "Password obbligatoria",
      400
    );
  }

  if (
    data.password
      .length
    < 8
  ) {
    throw makeError(
      "Password troppo corta",
      400
    );
  }

}

/* ───────────────────────────────────────────── */

function normalizeIdentifier(
  identifier
) {

  const value =
    identifier
      .trim()
      .toLowerCase();

  if (
    value.includes("@")
  ) {
    return value;
  }

  return value
    .replace(
      /^[+]/,
      "+"
    )
    .replace(
      /[^\d+]/g,
      ""
    );

}

/* ───────────────────────────────────────────── */

function detectIdentifierType(
  identifier
) {
  return identifier
    .includes("@")
    ? "email"
    : "phone";
}

function isDuplicateError(
  err
) {

  return (
    err.code ===
    "ER_DUP_ENTRY"

    ||

    err.code ===
    "23505"
  );

}

/* ───────────────────────────────────────────── */

module.exports = {
  register,
  login,
  getCustomers,
  getCustomerByIdentifier,
  getActiveCustomers,
};