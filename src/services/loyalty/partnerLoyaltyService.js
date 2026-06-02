"use strict";

const partnerRepo =
  require("../../repositories/partnersRepository");

const {
  hashPassword,
  verifyPassword,
} =
  require("../../utils/argon2");

const {
  makeError,
} =
  require("../../utils/errorHandler");

const {
  clean,
} =
  require("../../utils/sanitizer");

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function normalizePartnerId(
  value = ""
) {

  return clean(
    value
  )
    .toLowerCase()
    .trim()
    .replace(
      /\s+/g,
      "-"
    );

}

function validatePassword(
  password,
  field =
    "password"
) {

  if (
    !password ||
    password.length < 8
  ) {

    throw makeError(

      field ===
      "temp"

        ? "La password temporanea deve avere almeno 8 caratteri."

        : "La nuova password deve avere almeno 8 caratteri.",

      400

    );

  }

}

/* ─────────────────────────────────────────────
   GET PARTNERS
───────────────────────────────────────────── */

async function getPartners() {

  const partners =
    await partnerRepo
      .findPartners();

  return partners.map(
    (
      partner
    ) => ({

      id:
        partner.id,

      name:
        partner.name,

      category:
        partner.category,

      address:
        partner.address,

      active:
        partner.active,

      mustChangePassword:
        Boolean(
          partner.mustChangePassword
        ),

      createdAt:
        partner.createdAt,

    })
  );

}

/* ─────────────────────────────────────────────
   CREATE PARTNER
───────────────────────────────────────────── */

async function createPartner({

  id,

  name,

  category,

  address,

  tempPassword,

}) {

  if (
    !id?.trim()
    ||
    !name?.trim()
    ||
    !tempPassword
  ) {

    throw makeError(
      "ID, nome e password temporanea sono obbligatori.",
      400
    );

  }

  validatePassword(
    tempPassword,
    "temp"
  );

  const partnerId =
    normalizePartnerId(
      id
    );

  const passwordHash =
    await hashPassword(
      tempPassword
    );

  try {

    await partnerRepo
      .createPartner({

        id:
          partnerId,

        name:
          clean(
            name
          ),

        category:
          clean(
            category ||
            "Generico"
          ),

        address:
          clean(
            address ||
            ""
          ),

        passwordHash,

      });

  }

  catch (
    err
  ) {

    if (
      err.code ===
      "23505"
    ) {

      throw makeError(
        "Un partner con questo ID esiste già.",
        409
      );

    }

    throw err;

  }

  return {

    success:
      true,

    partnerId,

  };

}

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */

async function loginPartner({

  partnerId,

  password,

}) {

  if (
    !partnerId?.trim()
    ||
    !password
  ) {

    throw makeError(
      "Credenziali non valide.",
      401
    );

  }

  const partner =
    await partnerRepo
      .findPartnerById(

        normalizePartnerId(
          partnerId
        )

      );

  if (
    !partner
  ) {

    throw makeError(
      "Credenziali non valide.",
      401
    );

  }

  const match =
    await verifyPassword(
      password,
      partner.passwordHash
    );

  if (
    !match
  ) {

    throw makeError(
      "Credenziali non valide.",
      401
    );

  }

  if (
    !partner.active
  ) {

    throw makeError(
      "Account sospeso.",
      403
    );

  }

  return {

    success:
      true,

    partnerId:
      partner.id,

    name:
      partner.name,

    mustChangePassword:
      Boolean(
        partner.mustChangePassword
      ),

  };

}

/* ─────────────────────────────────────────────
   SET PASSWORD
───────────────────────────────────────────── */

async function setPartnerPassword({

  partnerId,

  newPassword,

}) {

  validatePassword(
    newPassword
  );

  const partner =
    await partnerRepo
      .findPartnerById(
        partnerId
      );

  if (
    !partner
  ) {

    throw makeError(
      "Partner non trovato.",
      404
    );

  }

  await partnerRepo
    .updatePartnerPassword({

      partnerId,

      passwordHash:
        await hashPassword(
          newPassword
        ),

      mustChangePassword:
        false,

    });

  return {

    success:
      true,

  };

}

/* ─────────────────────────────────────────────
   ADMIN
───────────────────────────────────────────── */

async function setPartnerActive(

  partnerId,

  active

) {

  const partner =
    await partnerRepo
      .findPartnerById(
        partnerId
      );

  if (
    !partner
  ) {

    throw makeError(
      "Partner non trovato.",
      404
    );

  }

  await partnerRepo
    .setPartnerActive(

      partnerId,

      Boolean(
        active
      )

    );

  return {

    success:
      true,

  };

}

/* ───────────────────────────────────────────── */

module.exports = {

  getPartners,

  createPartner,

  loginPartner,

  setPartnerPassword,

  setPartnerActive,

};