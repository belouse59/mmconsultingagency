/**
 * public/js/features/loyalty/login.js
 *
 * Unified loyalty login page — handles both Cliente and Partner
 * login from one form. Used by all three login HTML files:
 *   - /loyalty/login                  (tabbed, discoverable entry point)
 *   - /loyalty/customer/login.html    (fast-path, tab pre-set in HTML)
 *   - /loyalty/partner/login.html     (fast-path, tab pre-set in HTML)
 *
 * v2 changes (restoring features from the old per-page login.js /
 * auth.js that were dropped when this file was first unified):
 *   - Password reveal/hide toggle (.password-toggle)
 *   - Auto-redirect if a session already exists, via the new
 *     aggregating GET /api/loyalty/session endpoint — replaces
 *     what would otherwise be two separate session-endpoint calls
 *     (one per role) with a single request.
 *
 * Tab state resolution (unchanged from v1):
 *   1. ?type=customer|partner in the URL (deep link)
 *   2. localStorage["loyalty-login-tab"] (remembered choice)
 *   3. "customer" (default for first-time, no-param visitors)
 *   On the two fast-path pages, dataset.initialTab is already
 *   statically correct in the HTML — no computation needed.
 */

"use strict";

import { $, $$ } from "../../core/dom.js";
import { enablePasswordReveal } from "../../core/passwordChecker.js";

const TAB_CONFIG = {
  customer: {
    icon:              "🎫",
    title:             "Accesso Cliente",
    sub:               "Inserisci le tue credenziali per visualizzare il tuo QR code personale e le offerte riservate.",
    identifierLabel:   "Email o numero di telefono",
    forgotPasswordUrl: "/loyalty/customer/forgot-password.html",
    loginEndpoint:     "/api/loyalty/customer/login",
    successRedirect:   "/loyalty/customer/dashboard",
  },
  partner: {
    icon:              "🏪",
    title:             "Accesso Partner",
    sub:               "Accedi per scansionare i QR dei clienti e applicare gli sconti convenzionati.",
    identifierLabel:   "Email o numero di telefono",
    forgotPasswordUrl: "/loyalty/partner/forgot-password.html",
    loginEndpoint:     "/api/loyalty/partner/login",
    successRedirect:   "/loyalty/partner/scan",
  },
};

async function initLoyaltyLogin() {
  const card         = $("#loginCard");
  const tabCustomer  = $("#tabCustomer");
  const tabPartner   = $("#tabPartner");
  const authIcon     = $("#authIcon");
  const authTitle    = $("#authTitle");
  const authSub      = $("#authSub");
  const identifierLb = $("#identifierLabel");
  const forgotLink   = $("#forgotPasswordLink");
  const form         = $("#loginForm");
  const submitBtn    = $("#submitBtn");
  const errorBox     = $("#loginError");
  const errorText    = $("#loginErrorText");

  if (!form || !card) return;

  /* ── 0. Auto-redirect if already authenticated ──────────────
     Single call to the aggregating session endpoint. If a
     session of any role already exists, leave the login page
     immediately rather than showing a form to someone who's
     already logged in — standard SaaS behaviour (Stripe, Notion,
     Linear, etc. all do this).

     Deliberately blocks the rest of init (awaited, not fire-and-
     forget): there is no value in wiring up tab switches or
     password toggles on a page the user is about to be redirected
     away from, and doing so risks a visible flash of the form
     before the redirect completes. */
  try {
    const res = await fetch("/api/loyalty/session", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.dashboardUrl) {
        window.location.replace(data.dashboardUrl);
        return;
      }
    }
  } catch {
    /* Session check failed — fall through and show the login
       form normally. Worst case the user logs in again, which
       is always safe. */
  }

  /* ── 1. Resolve initial tab ──
     Two sources, same attribute name:
       - /loyalty/login: the inline <head> script sets
         document.documentElement.dataset.initialTab dynamically
         (from ?type=, localStorage, or "customer" default)
         BEFORE this module runs.
       - /loyalty/customer/login.html and /loyalty/partner/login.html:
         data-initial-tab is already present statically in the HTML,
         correct from the first byte. */
  let activeTab = document.documentElement.dataset.initialTab === "partner"
    ? "partner"
    : "customer";

  function applyTab(tab) {
    activeTab = tab;
    const cfg = TAB_CONFIG[tab];

    [tabCustomer, tabPartner].forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    card.dataset.activeTab = tab;

    if (authIcon)     authIcon.textContent     = cfg.icon;
    if (authTitle)    authTitle.textContent    = cfg.title;
    if (authSub)      authSub.textContent      = cfg.sub;
    if (identifierLb) identifierLb.textContent = cfg.identifierLabel;
    if (forgotLink)   forgotLink.href          = cfg.forgotPasswordUrl;

    hideError();

    localStorage.setItem("loyalty-login-tab", tab);
  }

  function showError(msg) {
    if (errorText) errorText.textContent = msg;
    errorBox?.classList.add("visible");
  }

  function hideError() {
    errorBox?.classList.remove("visible");
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.classList.toggle("loading", loading);
    submitBtn.disabled = loading;
  }

  tabCustomer?.addEventListener("click", () => applyTab("customer"));
  tabPartner?.addEventListener("click", () => applyTab("partner"));

  applyTab(activeTab);

  /* ── 3. Submit ── */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const identifier = form.identifier?.value?.trim();
    const password    = form.password?.value;

    if (!identifier || !password) {
      showError("Inserisci email/telefono e password.");
      return;
    }

    const cfg = TAB_CONFIG[activeTab];
    setLoading(true);

    try {
      const res = await fetch(cfg.loginEndpoint, {
        method:      "POST",
        headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
        body:        JSON.stringify({ identifier, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        window.location.href = cfg.successRedirect;
        return;
      }

      showError(data.message || "Credenziali non valide.");

    } catch {
      showError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  });
}

initLoyaltyLogin();

/* ── Password reveal toggle ── */
enablePasswordReveal()