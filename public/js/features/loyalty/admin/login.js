import { $ } from "../../../core/dom.js";
import { setLoading } from "../../../core/loyaltyUtils.js";
import { enablePasswordReveal } from "../../../core/passwordChecker.js";
const adminLoginForm = $("#adminLoginForm");
const adminEmailEl = $("#adminEmail");
const adminPassEl = $("#adminPassword");
const loginSubmitBtn = $("#loginSubmitBtn");
const loginError = $("#loginError");
const loginErrorText = $("#loginErrorText");

adminLoginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    loginError?.classList.remove("visible");

    const email = adminEmailEl?.value.trim();
    const password = adminPassEl?.value;

    if (!email || !password) {
        loginErrorText.textContent = "Inserisci email e password.";
        loginError.classList.add("visible");
        return;
    }

    setLoading(loginSubmitBtn, true);

    try {
        const res = await fetch("/api/loyalty/admin/login", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify({ email, password }),
        });

        const { data, success, message } = await res.json();

        if (res.ok && success) {
            window.location.href = "/loyalty/admin/dashboard";
             _setLoading(loginSubmitBtn, false);
            return;
        }

        loginErrorText.textContent = message || "Credenziali non valide.";
    } catch {
        loginErrorText.textContent = "Errore di connessione. Riprova.";
        loginError.classList.add("visible");
        _setLoading(loginSubmitBtn, false);
    }
});

(async () => {
  if (!window.location.pathname.includes("/login")) return;

  try {
    const r = await fetch("/api/loyalty/admin/session", {
      credentials: "same-origin",
    });

    if (r.ok) {
      window.location.href = "/loyalty/admin/dashboard";
    }
  } catch {
    // stay on register page
  }
})();

enablePasswordReveal();
