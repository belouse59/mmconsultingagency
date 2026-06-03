"use strict";

const customerLoyaltyService =
  require("../../services/loyalty/customerLoyaltyService");

const offerLoyaltyService =
  require("../../services/loyalty/offerLoyaltyService");

const {
  generateQrImage,
} =
  require("../../services/qrService");

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
const { loadTemplate } = require("../../utils/templateLoader");

const { generateToken, verifyToken } = require("../../services/tokenService")

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function extractCustomerPayload(
  body = {}
) {
  return {
    full_name:
      clean(
        body.full_name || ""
      ),

    identifier:
      clean(
        body.identifier || ""
      ),

    password:
      body.password,
  };
}

/* ───────────────────────────────────────────── */

async function createCustomerSession(
  req,
  customer
) {

  await establishSession(
    req,
    {
      loyaltyCustomer: {
        id:
          customer.customerId,

        full_name:
          customer.full_name,
      },
    }
  );

}

/* ─────────────────────────────────────────────
   REGISTER
───────────────────────────────────────────── */

const registerCustomer =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const payload =
        extractCustomerPayload(
          req.body
        );

      const customer =
        await customerLoyaltyService
          .register(
            payload
          );

      if (customer) {
        const token = generateToken(customer.identifier);
        return res
          .status(201)
          .json({

            success: true,

            data: {

              customerId:
                customer.customerId,

              full_name:
                customer.full_name,

            },
            token

          });
      } else {
        return res
          .status(403)
          .json({
            success: false,
            message: "Errore durante la registrazione. Riprova."

          });

      }

    }
  );

async function successPage(
  req,
  res
) {

  const { token } = req.query;

  const { email } = verifyToken(token);


  const customer =
    await customerLoyaltyService
      .getCustomerByIdentifier(email);

  const html =
    loadTemplate(
      "register-customer.html",
      {
        FULL_NAME: customer.full_name,
        APP_URL: process.env.APP_URL
      }
    );

  return res.send(html);
}

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */

const loginCustomer =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const customer =
        await customerLoyaltyService
          .login({

            identifier:
              clean(
                req.body
                  ?.identifier || ""
              ),

            password:
              req.body
                ?.password,

          });

      await createCustomerSession(
        req,
        customer
      );

      return res
        .json({

          success: true,

          data: {

            customerId:
              customer.customerId,

            full_name:
              customer.full_name,

          },

        });

    }
  );

/* ─────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────── */

const logoutCustomer =
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

const customerSession =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const customer =
        req.session
          ?.loyaltyCustomer;

      if (
        !customer
      ) {

        return res
          .status(401)
          .json({

            success: false,

            message:
              "Non autenticato.",

          });

      }

      return res
        .json({

          success: true,

          data: {

            customerId:
              customer.id,

            full_name:
              customer.full_name,

          },

        });

    }
  );

/* ─────────────────────────────────────────────
   QR
───────────────────────────────────────────── */

const getCustomerQr =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const customer =
        req.session
          ?.loyaltyCustomer;

      const {
        qrImage,
        ttl,
      } =
        await generateQrImage(
          customer.id
        );

      return res
        .json({

          success: true,

          data: {

            qrImage,

            ttl,

            full_name:
              customer.full_name,

          },

        });

    }
  );

/* ─────────────────────────────────────────────
   OFFERS
───────────────────────────────────────────── */

const getOffers =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const offers =
        await offerLoyaltyService
          .getActiveOffers();

      return res
        .json({

          success: true,

          data:
            offers,

        });

    }
  );

/* ───────────────────────────────────────────── */

module.exports = {

  registerCustomer,

  successPage,

  loginCustomer,

  logoutCustomer,

  customerSession,

  getCustomerQr,

  getOffers,

};