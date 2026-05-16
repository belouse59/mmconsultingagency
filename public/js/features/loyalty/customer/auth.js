const $ = (s) => document.querySelector(s);

const $form = $("#loginForm");
const $message = $("#loginMessage");

/* -------------------------
   UI FEEDBACK
------------------------- */
function showMessage(text, type = "error") {
  if (!$message) return;

  $message.textContent = text;
  $message.className = `loyalty-feedback ${type}`;
}

/* -------------------------
   LOGIN
------------------------- */
async function handleLogin(e) {
  e.preventDefault();

  const identifier = $("#identifier").value.trim();
  const password = $("#password").value.trim();

  try {
    showMessage("Authenticating...", "success");

    const res = await fetch("/api/loyalty/customer/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        identifier,
        password
      })
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem(
      "loyaltyCustomer",
      JSON.stringify(data.customer)
    );

    showMessage("Access granted", "success");

    setTimeout(() => {
      window.location.href =
        "/loyalty/customer/dashboard.html";
    }, 700);

  } catch (err) {
    console.error(err);
    showMessage(err.message || "Authentication failed");
  }
}

$form?.addEventListener("submit", handleLogin);