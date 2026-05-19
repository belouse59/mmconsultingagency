/**
 * js/features/loyalty/partner/partnerScan.js
 * Partner QR scan + redemption page.
 *
 * Key improvements over original:
 *   - Session verified via httpOnly cookie — no localStorage
 *   - Real offer selection UI before confirming redemption
 *   - partnerId comes from server session — never from client body
 *   - Token extracted from URL param when partner device opens QR link
 *   - Race-condition-free: scanning disabled during redemption
 *   - Manual token input fallback if camera unavailable
 *   - Clear Italian status messages for every outcome
 *   - Camera stopped cleanly when moving to confirm phase
 *   - Logout button with server-side session destruction
 */

/* ── Constants ── */
const SCANNER_ELEMENT_ID = "loyalty-qr-reader";

/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
const topbarPartnerName = $("#topbarPartnerName");
const logoutBtn         = $("#logoutBtn");
const scanPhase         = $("#scanPhase");
const confirmPhase      = $("#confirmPhase");
const resultBadge       = $("#resultBadge");
const customerNameEl    = $("#customerName");
const resultMessage     = $("#resultMessage");
const offerSelect       = $("#offerSelect");
const redeemError       = $("#redeemError");
const redeemErrorText   = $("#redeemErrorText");
const redeemSuccess     = $("#redeemSuccess");
const redeemSuccessText = $("#redeemSuccessText");
const confirmRedeemBtn  = $("#confirmRedeemBtn");
const scanAgainBtn      = $("#scanAgainBtn");
const manualToggle      = $("#manualToggle");
const manualInputArea   = $("#manualInputArea");
const manualToken       = $("#manualToken");
const manualSubmitBtn   = $("#manualSubmitBtn");

/* ── State ── */
let _scanner       = null;
let _pendingToken  = null;   // token extracted from URL or scan
let _isRedeeming   = false;  // guard against double-submit

/* ─────────────────────────────────────────────────────────────
   AUTH GUARD
───────────────────────────────────────────────────────────── */
async function verifySession() {
  try {
    const res = await fetch("/api/loyalty/partner/session", {
      credentials: "same-origin",
    });

    if (!res.ok) {
      window.location.replace("/loyalty/partner/login.html");
      return null;
    }

    return await res.json();
  } catch {
    window.location.replace("/loyalty/partner/login.html");
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   OFFERS LOADER
   Populates the <select> before the partner can confirm a redemption.
───────────────────────────────────────────────────────────── */
async function loadOffers() {
  try {
    const res    = await fetch("/api/loyalty/partner/offers", {
      credentials: "same-origin",
    });
    const data   = await res.json();
    const offers = data.data || [];

    offerSelect.innerHTML = `<option value="" disabled selected>— Scegli un'offerta —</option>`;

    if (!offers.length) {
      offerSelect.innerHTML += `<option disabled>Nessuna offerta disponibile</option>`;
      return;
    }

    offers.forEach((offer) => {
      const opt   = document.createElement("option");
      opt.value   = offer.id;
      opt.textContent = offer.title;
      offerSelect.appendChild(opt);
    });
  } catch {
    offerSelect.innerHTML = `<option disabled>Errore nel caricamento offerte</option>`;
  }
}

/* ─────────────────────────────────────────────────────────────
   QR SCANNER
   Uses Html5Qrcode (loaded via <script> in HTML before this module).
───────────────────────────────────────────────────────────── */
function startScanner() {
  /* Html5Qrcode is a global injected by the CDN script tag */
  if (typeof Html5Qrcode === "undefined") {
    showManualFallback("La fotocamera non è disponibile su questo dispositivo.");
    return;
  }

  _scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });

  _scanner
    .start(
      { facingMode: "environment" },   // rear camera for scanning
      {
        fps:            10,
        qrbox:          { width: 240, height: 240 },
        aspectRatio:    1.0,
        disableFlip:    false,
      },
      _onScanSuccess,
      /* Per-frame error is intentionally ignored — normal during scanning */
      () => {}
    )
    .catch((err) => {
      console.warn("[partnerScan] Camera error:", err);
      showManualFallback("Impossibile accedere alla fotocamera. Usa l'inserimento manuale.");
    });
}

async function stopScanner() {
  if (_scanner) {
    try {
      await _scanner.stop();
    } catch { /* Already stopped */ }
    _scanner = null;
  }
}

function showManualFallback(reason) {
  manualToggle.textContent = `📋 ${reason || "Inserisci token manualmente"}`;
  manualInputArea.style.display = "block";
  manualToggle.setAttribute("aria-expanded", "true");
}

/* ─────────────────────────────────────────────────────────────
   SCAN OUTCOME HANDLER
   Called when Html5Qrcode decodes a QR successfully.
   The QR encodes a URL; we extract the `token` query param.
───────────────────────────────────────────────────────────── */
async function _onScanSuccess(decodedText) {
  /* Prevent multiple triggers while processing */
  await stopScanner();

  let token = null;

  try {
    /* QR encodes: APP_URL/loyalty/partner/scan.html?token=... */
    const url   = new URL(decodedText);
    token       = url.searchParams.get("token");
  } catch {
    /* QR might encode just the raw token (fallback) */
    token = decodedText.trim();
  }

  if (!token) {
    _showScanError("QR non valido. Il codice scansionato non contiene un token riconoscibile.");
    return;
  }

  _pendingToken = token;
  await _transitionToConfirm(token);
}

/* ─────────────────────────────────────────────────────────────
   TOKEN FROM URL PARAM
   When the customer's QR is a deep link that the partner device
   opens directly, the token arrives as a URL query param.
───────────────────────────────────────────────────────────── */
async function checkUrlToken() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get("token");

  if (!token) return false;

  /* Clean URL so token isn't visible in browser history */
  history.replaceState({}, "", window.location.pathname);

  _pendingToken = token;
  await _transitionToConfirm(token);
  return true;
}

/* ─────────────────────────────────────────────────────────────
   TRANSITION TO CONFIRM PHASE
   Shows customer info and offer select before final confirmation.
───────────────────────────────────────────────────────────── */
async function _transitionToConfirm(token) {
  scanPhase.style.display    = "none";
  confirmPhase.style.display = "block";

  /* Reset confirm UI */
  _hideRedeemFeedback();
  confirmRedeemBtn.disabled = true;
  customerNameEl.textContent = "Verifica in corso...";
  resultBadge.className      = "loyalty-scan-result-badge";
  resultBadge.textContent    = "Verifica...";

  /* Pre-validate token server-side by attempting a dry-run.
     We call the redeem endpoint only on actual confirm, so here
     we just show the token is structurally valid via client check. */
  const isStructurallyValid = token && token.includes(".");
  if (!isStructurallyValid) {
    _showScanError("QR non valido. Chiedi al cliente di aggiornare il suo QR.");
    return;
  }

  /* Token appears valid — let partner pick the offer */
  resultBadge.className   = "loyalty-scan-result-badge success";
  resultBadge.textContent = "✓ QR acquisito";
  customerNameEl.textContent = "Seleziona un'offerta per procedere";
  resultMessage.textContent  = "Scegli quale sconto applicare, poi conferma.";

  /* Enable confirm button only when offer is selected */
  offerSelect.addEventListener("change", _onOfferSelected, { once: false });
}

function _onOfferSelected() {
  confirmRedeemBtn.disabled = !offerSelect.value;
}

function _showScanError(msg) {
  scanPhase.style.display    = "none";
  confirmPhase.style.display = "block";

  resultBadge.className   = "loyalty-scan-result-badge error";
  resultBadge.textContent = "✗ Errore";
  customerNameEl.textContent = "";
  resultMessage.textContent  = msg;
  confirmRedeemBtn.disabled  = true;
}

/* ─────────────────────────────────────────────────────────────
   CONFIRM REDEMPTION
───────────────────────────────────────────────────────────── */
confirmRedeemBtn.addEventListener("click", async () => {
  if (_isRedeeming) return;

  const offerId = offerSelect.value;
  if (!offerId) {
    showRedeemError("Seleziona un'offerta prima di procedere.");
    return;
  }

  if (!_pendingToken) {
    showRedeemError("Token mancante. Scansiona di nuovo il QR.");
    return;
  }

  _isRedeeming = true;
  confirmRedeemBtn.disabled = true;
  confirmRedeemBtn.classList.add("loading");
  _hideRedeemFeedback();

  try {
    const res  = await fetch("/api/loyalty/partner/redeem", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({
        token:   _pendingToken,
        offerId,
      }),
    });

    const data = await res.json();

    if (res.status === 401) {
      window.location.replace("/loyalty/partner/login.html");
      return;
    }

    confirmRedeemBtn.classList.remove("loading");

    if (data.success) {
      /* Update badge with confirmed customer name */
      resultBadge.className      = "loyalty-scan-result-badge success";
      resultBadge.textContent    = "✓ Sconto applicato";
      customerNameEl.textContent = data.customerName || "";

      redeemSuccessText.textContent = data.message || "Sconto applicato con successo.";
      redeemSuccess.classList.add("visible");

      /* Disable controls — transaction is complete */
      offerSelect.disabled      = true;
      confirmRedeemBtn.disabled = true;
    } else {
      showRedeemError(data.message || "Errore durante la validazione.");
      confirmRedeemBtn.disabled = false;
      _isRedeeming = false;
    }
  } catch {
    confirmRedeemBtn.classList.remove("loading");
    showRedeemError("Errore di connessione. Riprova.");
    confirmRedeemBtn.disabled = false;
    _isRedeeming = false;
  }
});

/* ─────────────────────────────────────────────────────────────
   SCAN AGAIN
───────────────────────────────────────────────────────────── */
scanAgainBtn.addEventListener("click", () => {
  _pendingToken  = null;
  _isRedeeming   = false;

  /* Reset UI */
  offerSelect.value     = "";
  offerSelect.disabled  = false;
  confirmRedeemBtn.disabled = true;
  manualToken.value     = "";
  _hideRedeemFeedback();

  confirmPhase.style.display = "none";
  scanPhase.style.display    = "block";

  startScanner();
});

/* ─────────────────────────────────────────────────────────────
   MANUAL TOKEN INPUT
───────────────────────────────────────────────────────────── */
manualToggle.addEventListener("click", () => {
  const isOpen = manualInputArea.style.display !== "none";
  manualInputArea.style.display = isOpen ? "none" : "block";
  manualToggle.setAttribute("aria-expanded", String(!isOpen));
});

manualSubmitBtn.addEventListener("click", async () => {
  const token = manualToken.value.trim();
  if (!token) return;

  await stopScanner();
  _pendingToken = token;
  manualToken.value = "";
  await _transitionToConfirm(token);
});

manualToken.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    manualSubmitBtn.click();
  }
});

/* ─────────────────────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────────────────────── */
logoutBtn.addEventListener("click", async () => {
  await stopScanner();
  try {
    await fetch("/api/loyalty/partner/logout", {
      method:      "POST",
      credentials: "same-origin",
    });
  } catch { /* Best-effort */ }
  window.location.replace("/loyalty/partner/login.html");
});

/* ─────────────────────────────────────────────────────────────
   FEEDBACK HELPERS
───────────────────────────────────────────────────────────── */
function showRedeemError(msg) {
  redeemErrorText.textContent = msg;
  redeemError.classList.add("visible");
  redeemSuccess.classList.remove("visible");
}

function _hideRedeemFeedback() {
  redeemError.classList.remove("visible");
  redeemSuccess.classList.remove("visible");
}

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────── */
(async () => {
  /* 1. Verify partner session */
  const session = await verifySession();
  if (!session) return;

  /* 2. Show partner name in topbar */
  topbarPartnerName.textContent = session.name || "";

  /* 3. Load offers for the select dropdown */
  await loadOffers();

  /* 4. Check if a token arrived via URL (deep-link QR open) */
  const hasUrlToken = await checkUrlToken();

  /* 5. If no URL token, start the camera scanner */
  if (!hasUrlToken) {
    startScanner();
  }
})();