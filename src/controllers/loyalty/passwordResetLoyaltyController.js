const customerLoyaltyService =
  require("../../services/loyalty/passwordResetService");

const {
  asyncHandler,
} =
  require("./helper");

const {
  clean,
} =
  require("../../utils/sanitizer");

/* ─────────────────────────────────────────────
   FORGOT_PASSWORD
───────────────────────────────────────────── */

const forgotPassword =
  asyncHandler(
    async (
      req,
      res
    ) => {

      await customerLoyaltyService
        .forgotPassword({

          identifier:
            clean(
              req.body
                ?.identifier || ""
            ),

        });

      return res
        .json({

          success: true,

          message:
            "Se esiste un account associato a queste informazioni, riceverai un'email con le istruzioni per reimpostare la password.",

        });

    }
  );

/* ─────────────────────────────────────────────
   RESET PASSWORD
───────────────────────────────────────────── */

//const path = require("path");

const passwordResetService =
  require("../../services/loyalty/passwordResetService");

const resetPasswordPage =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const token =
        req.query?.token;

      if (!token) {
        return res
          .status(400)
          .send("Link non valido.");
      }

      const validToken = await passwordResetService
        .validateResetToken(
          token
        );

      res.cookie(
        "password_reset_token",
        token,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV === "production",

          sameSite: "strict",

          maxAge:
            30 * 60 * 1000,
        }
      );

      return res.redirect(
        "/loyalty/customer/reset-password.html"
      );

    }
  );


"use strict";

const resetPassword =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const token =
        req.cookies
          ?.password_reset_token;

      if (!token) {
        return res
          .status(401)
          .json({

            success: false,

            message:
              "Link non valido o scaduto.",

          });
      }

      await passwordResetService
        .resetPassword({

          token,

          password:
            req.body?.password,

        });

      res.clearCookie(
        "password_reset_token"
      );

      return res
      .status(200)
      .json({
        success: true,
        message:
          "Password aggiornata correttamente.",
      });

    }
  );

const validateResetToken =
  asyncHandler(
    async (
      req,
      res
    ) => {

      const { token } = req.query;

      const valid =
        await passwordResetService
          .isValidToken(token);

      if (!valid) {
        return res.redirect(
          "/loyalty/customer/reset-link-expired.html"
        );
      }

      return res.redirect(
        `/loyalty/customer/reset-password.html?token=${encodeURIComponent(token)}`
      );
    }
  );

module.exports = { forgotPassword, resetPassword, validateResetToken, resetPasswordPage };