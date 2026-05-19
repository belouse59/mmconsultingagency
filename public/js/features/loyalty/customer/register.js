/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
import { logout } from "../../../core/logout.js";

const $form = $("#registerForm");
const $message = $("#registerMessage");
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
   REGISTER
------------------------- */
async function handleRegister(e) {
  e.preventDefault();

  const payload = {
    full_name: $("#name").value.trim(),
    identifier: $("#identifier").value.trim(),
    password: $("#password").value.trim()
  };

  try {
    showMessage("Creating your membership...", "success");

    const res = await fetch("/api/loyalty/customer/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || "Registration failed");
    }

    showMessage("Membership created successfully", "success");

    setTimeout(() => {
      window.location.href =
        "/loyalty/customer/login.html";
    }, 1000);

  } catch (err) {
    console.error(err);
    showMessage(err.message || "Registration failed");
  }
}

logout($logout, "/");

$form?.addEventListener("submit", handleRegister);