"use strict";

const redemptionLoyaltyService =
  require("../../services/loyalty/redemptionLoyaltyService");

const partnerLoyaltyService =
  require("../../services/loyalty/partnerLoyaltyService");

const offerLoyaltyService =
  require("../../services/loyalty/offerLoyaltyService");

const {
  clean,
} =
  require("../../utils/sanitizer");

const {
  establishSession,
  destroySession,
} =
  require("../../services/sessionService");

const {
  asyncHandler,
} =
  require("./helper");

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

async function createPartnerSession(
  req,
  partner
) {

  await establishSession(
    req,
    {
      loyaltyPartner: {

        id:
          partner.partnerId,

        name:
          partner.name,

        mustChangePassword:
          Boolean(
            partner.mustChangePassword
          ),

      },
    }
  );

}

function validatePasswordChange(
  newPassword,
  confirmPassword
) {

  if (
    !newPassword ||
    newPassword.length < 8
  ) {
    const err =
      new Error(
        "La nuova password deve avere almeno 8 caratteri."
      );

    err.statusCode =
      400;

    throw err;
  }

  if (
    newPassword !==
    confirmPassword
  ) {

    const err =
      new Error(
        "Le password non coincidono."
      );

    err.statusCode =
      400;

    throw err;

  }

}

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */

const loginPartner =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const result =
        await partnerLoyaltyService
          .loginPartner({

            email:
              clean(
                req.body
                  ?.email || ""
              ),

            password:
              req.body
                ?.password,

          });

      await createPartnerSession(
        req,
        result
      );

      return res
        .json({

          success:
            true,

          data: {

            partnerId:
              result.partnerId,

            name:
              result.name,

            mustChangePassword:
              Boolean(
                result.mustChangePassword
              ),

          },

        });

    }
  );

/* ─────────────────────────────────────────────
   SET PASSWORD
───────────────────────────────────────────── */

const setPartnerPassword =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const {
        newPassword,
        confirmPassword,
      } =
        req.body;

      validatePasswordChange(
        newPassword,
        confirmPassword
      );

      const partnerId =
        req.session
          ?.loyaltyPartner
          ?.id;

      await partnerLoyaltyService
        .setPartnerPassword({

          partnerId,

          newPassword,

        });

      await establishSession(
        req,
        {
          loyaltyPartner: {

            ...req.session
              .loyaltyPartner,

            mustChangePassword:
              false,

          },
        }
      );

      return res
        .json({

          success:
            true,

          message:
            "Password aggiornata con successo.",

        });

    }
  );

/* ─────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────── */

const logoutPartner =
  asyncHandler(
    async (
      req,
      res
    ) => {

      await destroySession(
        req,
        res
      );

      return res
        .status(204)
        .end();

    }
  );

/* ─────────────────────────────────────────────
   SESSION
───────────────────────────────────────────── */

const partnerSession =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const partner =
        req.session
          ?.loyaltyPartner;

      if (
        !partner
      ) {

        return res
          .status(401)
          .json({

            success:
              false,

            message:
              "Non autenticato.",

          });

      }

      return res
        .json({

          success:
            true,

          data: {

            partnerId:
              partner.id,

            name:
              partner.name,

            mustChangePassword:
              Boolean(
                partner.mustChangePassword
              ),

          },

        });

    }
  );

/* ─────────────────────────────────────────────
   OFFERS
───────────────────────────────────────────── */

const getPartnerOffers =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const partnerId =
        req.session
          ?.loyaltyPartner
          ?.id;

      const offers =
        await offerLoyaltyService
          .getPartnerOffers(
            partnerId
          );

      return res
        .json({

          success:
            true,

          data:
            offers ||
            [],

        });

    }
  );

/* ─────────────────────────────────────────────
   PREVALIDATE
───────────────────────────────────────────── */

const prevalidateQr =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const token =
        clean(
          req.body
            ?.token || ""
        );

      if (
        !token
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Token mancante.",

          });

      }

      const result =
        await redemptionLoyaltyService
          .prevalidateQr({

            token,

            partnerId:
              req.session
                .loyaltyPartner
                .id,

          });

      return res
        .json(
          result
        );

    }
  );

/* ─────────────────────────────────────────────
   REDEEM
───────────────────────────────────────────── */

const redeemQr =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const {
        token,
        offerId,
        idempotencyKey,
      } =
        req.body;

      if (
        !token
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Token mancante.",

          });

      }

      if (
        !offerId
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Seleziona un'offerta.",

          });

      }

      const result =
        await redemptionLoyaltyService
          .redeemOffer({

            token:
              clean(
                token
              ),

            offerId:
              clean(
                offerId
              ),

            partnerId:
              req.session
                .loyaltyPartner
                .id,

            idempotencyKey:
              idempotencyKey
                ? clean(
                    idempotencyKey
                  )
                : null,

          });

      return res
        .status(
          result.success
            ? 200
            : 409
        )
        .json(
          result
        );

    }
  );

/* ───────────────────────────────────────────── */

module.exports = {

  loginPartner,

  setPartnerPassword,

  logoutPartner,

  partnerSession,

  getPartnerOffers,

  prevalidateQr,

  redeemQr,

};