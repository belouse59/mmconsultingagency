/**
 * registration-success.js
 */

import { $ } from "../../../core/dom.js";
document.addEventListener("DOMContentLoaded", () => {

  const titleName = $("#customerName");

  try {

    const encoded =
      sessionStorage.getItem(
        "registrationSuccess"
      );

    if (!encoded) {
      return;
    }

    const {
      full_name,
    } = decode(encoded);

    if (full_name && titleName) {
      titleName.textContent =
        full_name;
    }

    sessionStorage.removeItem(
      "registrationSuccess"
    );

  } catch (err) {
    console.error(
      "Unable to load registration success data",
      err
    );
  }
});

function decode(value) {
  return JSON.parse(
    decodeURIComponent(
      atob(value)
    )
  );
}