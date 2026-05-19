/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
import { logout } from "../../../core/logout.js";

const $form = $("#partnerLoginForm");
const $message = $("#partnerLoginMessage");
const $logout = $("#logoutBtn");
/* -------------------------
   FEEDBACK
------------------------- */
function showMessage(text, type = "error") {
  if (!$message) return;

  $message.textContent = text;
  $message.className = `loyalty-feedback ${type}`;
}

/* -------------------------
   LOGIN
------------------------- */
async function handlePartnerLogin(e) {
  e.preventDefault();

  const payload = {
    partnerId: $("#partnerId").value.trim(),
    password: $("#password").value.trim()
  };

  try {
    showMessage("Authenticating...", "success");

    const res = await fetch("/api/loyalty/partner/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(
        data.message || "Authentication failed"
      );
    }
    showMessage("Access granted", "success");

    setTimeout(() => {
      window.location.href =
        "/loyalty/partner/scan.html";
    }, 700);

  } catch (err) {
    console.error(err);
    showMessage(err.message || "Login failed");
  }
}
logout($logout, "/");
$form?.addEventListener("submit", handlePartnerLogin);