"use strict";

/* ─────────────────────────────────────────────
   ERROR HANDLER
───────────────────────────────────────────── */

function handleError(
  res,
  err
) {

  const status =
    err.statusCode ||
    500;

  const message =
    err.statusCode
      ? err.message
      : "Errore interno. Riprova più tardi.";

  if (
    !err.statusCode
  ) {

    console.error(
      "[loyaltyController]",
      err
    );

  }

  return res
    .status(
      status
    )
    .json({

      success:
        false,

      message,

    });

}

/* ─────────────────────────────────────────────
   ASYNC WRAPPER
───────────────────────────────────────────── */

function asyncHandler(fn) {
  return function (
    req,
    res,
    next
  ) {

    Promise
      .resolve(
        fn(
          req,
          res,
          next
        )
      )
      .catch(
        (
          err
        ) =>
          handleError(
            res,
            err
          )
      );

  };

}

/* ───────────────────────────────────────────── */

module.exports = {
  handleError,
  asyncHandler,
};