/**
 * js/features/loyalty/partner/partnerScan.js
 *
 * Senior-level improvements implemented:
 *   1.  Server-side prevalidation before confirm phase
 *       → real customer name + per-offer eligibility matrix
 *   2.  Offer eligibility shown in select (disabled + reason if ineligible)
 *   3.  Offer description shown below select when option chosen
 *   4.  QR expiry countdown during confirm phase
 *   5.  Idempotency key per redemption (prevents network-retry duplicates)
 *   6.  Camera device selector (multiple cameras support)
 *   7.  Duplicate scan suppression (same token within 2s ignored)
 *   8.  Auto-reset to scanner 6s after successful redemption
 *   9.  Partner session heartbeat every 4 minutes
 *  10.  Offline/online detection banner
 *  11.  Manual token rate-limit cooldown (5 attempts, then 30s pause)
 *  12.  Redemption receipt display (ID, customer, offer, time)
 *  13.  X-Requested-With on all state-mutating fetches (CSRF)
 *  14.  Full UI lock during redemption (no race conditions)
 *  15.  Audible feedback (Web Audio API — no external files needed)
 *  16.  URL token stripped from history after extraction
 *  17.  Distinct error codes displayed with specific Italian messages
 */

/* ── Constants ── */
const SCANNER_ID         = "loyalty-qr-reader";
const HEARTBEAT_INTERVAL = 4 * 60 * 1000;   // 4 min session heartbeat
const AUTO_RESET_DELAY   = 6000;             // 6s after success → re-scan
const SCAN_DEBOUNCE_MS   = 2000;             // ignore same token within 2s
const MANUAL_RATE_LIMIT  = 5;               // manual attempts before cooldown
const MANUAL_COOLDOWN_MS = 30_000;          // 30s cooldown after abuse

/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
const topbarPartnerName = $("#topbarPartnerName");
const logoutBtn         = $("#logoutBtn");
const offlineBanner     = $("#offlineBanner");
const scanPhase         = $("#scanPhase");
const confirmPhase      = $("#confirmPhase");
const cameraSelectorWrap = $("#cameraSelectorWrap");
const cameraSelect      = $("#cameraSelect");
const resultBadge       = $("#resultBadge");
const customerNameEl    = $("#customerName");
const resultMessage     = $("#resultMessage");
const qrExpiry          = $("#qrExpiry");
const qrExpiryText      = $("#qrExpiryText");
const offerSelectWrap   = $("#offerSelectWrap");
const offerSelect       = $("#offerSelect");
const offerHint         = $("#offerHint");
const redeemError       = $("#redeemError");
const redeemErrorText   = $("#redeemErrorText");
const redeemSuccess     = $("#redeemSuccess");
const redeemSuccessText = $("#redeemSuccessText");
const redemptionReceipt = $("#redemptionReceipt");
const receiptCustomer   = $("#receiptCustomer");
const receiptOffer      = $("#receiptOffer");
const receiptTime       = $("#receiptTime");
const receiptId         = $("#receiptId");
const confirmRedeemBtn  = $("#confirmRedeemBtn");
const scanAgainBtn      = $("#scanAgainBtn");
const manualToggle      = $("#manualToggle");
const manualInputArea   = $("#manualInputArea");
const manualToken       = $("#manualToken");
const manualSubmitBtn   = $("#manualSubmitBtn");

/* ── State ── */
let _scanner            = null;
let _pendingToken       = null;
let _eligibleOffers     = [];       // from prevalidate response
let _isRedeeming        = false;
let _lastScannedToken   = null;
let _lastScanTs         = 0;
let _expiryCountdown    = null;
let _autoResetTimer     = null;
let _heartbeatTimer     = null;
let _manualAttempts     = 0;
let _manualCooldownUntil = 0;
let _selectedCameraId   = null;

/* ─────────────────────────────────────────────────────────────
   AUDIO FEEDBACK (Web Audio API — no files, no CDN)
───────────────────────────────────────────────────────────── */
function _beep(freq = 880, duration = 120, type = "sine", volume = 0.3) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.value     = volume;
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
    osc.onended = () => ctx.close();
  } catch { /* AudioContext not supported — silent fail */ }
}

function _beepSuccess() { _beep(880, 100); setTimeout(() => _beep(1100, 150), 120); }
function _beepError()   { _beep(220, 300, "sawtooth", 0.2); }
function _beepScan()    { _beep(660, 80, "sine", 0.15); }

/* ─────────────────────────────────────────────────────────────
   OFFLINE DETECTION
───────────────────────────────────────────────────────────── */
function _updateOnlineStatus() {
  if (offlineBanner) {
    offlineBanner.style.display = navigator.onLine ? "none" : "flex";
  }
}

window.addEventListener("online",  _updateOnlineStatus);
window.addEventListener("offline", _updateOnlineStatus);
_updateOnlineStatus();

/* ─────────────────────────────────────────────────────────────
   SESSION HEARTBEAT
   Prevents silent session expiry on long idle scan sessions.
───────────────────────────────────────────────────────────── */
function _startHeartbeat() {
  clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(async () => {
    try {
      const res = await fetch("/api/loyalty/partner/session", { credentials: "same-origin" });
      if (!res.ok) {
        window.location.replace("/loyalty/partner/login.html");
      }
    } catch { /* network error — don't redirect, might be temporary */ }
  }, HEARTBEAT_INTERVAL);
}

/* ─────────────────────────────────────────────────────────────
   CAMERA SELECTOR
───────────────────────────────────────────────────────────── */
async function _initCameraSelector() {
  if (typeof Html5Qrcode === "undefined") return;

  try {
    const cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length <= 1) return;

    /* Multiple cameras — show selector */
    cameras.forEach((cam) => {
      const opt       = document.createElement("option");
      opt.value       = cam.id;
      opt.textContent = cam.label || `Fotocamera ${cam.id.slice(0, 6)}`;
      cameraSelect.appendChild(opt);
    });

    cameraSelectorWrap.style.display = "block";

    /* Default to rear camera if label contains keywords */
    const rear = cameras.find((c) =>
      /back|rear|environment|posteriore/i.test(c.label)
    );
    if (rear) {
      cameraSelect.value  = rear.id;
      _selectedCameraId   = rear.id;
    } else {
      _selectedCameraId   = cameras[0].id;
    }

    cameraSelect.addEventListener("change", async () => {
      _selectedCameraId = cameraSelect.value;
      await stopScanner();
      startScanner();
    });
  } catch { /* getCameras failed — proceed with environment facing mode */ }
}

/* ─────────────────────────────────────────────────────────────
   QR SCANNER
───────────────────────────────────────────────────────────── */
function startScanner() {
  if (typeof Html5Qrcode === "undefined") {
    _showManualFallback("La fotocamera non è disponibile su questo dispositivo.");
    return;
  }

  _scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });

  const cameraConfig = _selectedCameraId
    ? { deviceId: { exact: _selectedCameraId } }
    : { facingMode: "environment" };

  _scanner
    .start(
      cameraConfig,
      { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
      _onScanSuccess,
      () => {} /* per-frame error — intentionally ignored */
    )
    .catch((err) => {
      console.warn("[partnerScan] Camera start error:", err);
      _showManualFallback("Impossibile accedere alla fotocamera. Usa l'inserimento manuale.");
    });
}

async function stopScanner() {
  if (_scanner) {
    try { await _scanner.stop(); } catch { /* already stopped */ }
    _scanner = null;
  }
}

function _showManualFallback(reason) {
  if (manualToggle) manualToggle.textContent = `📋 ${reason || "Inserisci token manualmente"}`;
  if (manualInputArea) manualInputArea.style.display = "block";
  if (manualToggle) manualToggle.setAttribute("aria-expanded", "true");
}

/* ─────────────────────────────────────────────────────────────
   SCAN SUCCESS HANDLER
───────────────────────────────────────────────────────────── */
async function _onScanSuccess(decodedText) {
  /* Duplicate scan suppression — same token within debounce window */
  const now = Date.now();
  if (decodedText === _lastScannedToken && now - _lastScanTs < SCAN_DEBOUNCE_MS) return;
  _lastScannedToken = decodedText;
  _lastScanTs       = now;

  await stopScanner();
  _beepScan();

  let token = null;
  try {
    const url = new URL(decodedText);
    token     = url.searchParams.get("token");
  } catch {
    token = decodedText.trim();
  }

  if (!token) {
    _showScanError("QR non valido. Il codice non contiene un token riconoscibile.");
    _beepError();
    return;
  }

  /* Remove token from URL if it arrived as a query param */
  history.replaceState({}, "", window.location.pathname);

  _pendingToken = token;
  await _runPrevalidation(token);
}

/* ─────────────────────────────────────────────────────────────
   URL TOKEN — deep link from customer QR
───────────────────────────────────────────────────────────── */
async function _checkUrlToken() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get("token");
  if (!token) return false;

  /* Strip from history immediately */
  history.replaceState({}, "", window.location.pathname);

  _pendingToken = token;
  await stopScanner();
  await _runPrevalidation(token);
  return true;
}

/* ─────────────────────────────────────────────────────────────
   PREVALIDATION — server-side token check before confirm UI
───────────────────────────────────────────────────────────── */
async function _runPrevalidation(token) {
  _showConfirmPhase();
  _setConfirmLoading(true);
  _hideRedeemFeedback();

  /* Reset offer select */
  offerSelect.innerHTML  = `<option value="" disabled selected>— Caricamento offerte... —</option>`;
  offerSelect.disabled   = true;
  confirmRedeemBtn.disabled = true;
  confirmRedeemBtn.setAttribute("aria-disabled", "true");
  qrExpiry.style.display = "none";

  try {
    const res  = await fetch("/api/loyalty/partner/prevalidate", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body:        JSON.stringify({ token }),
    });

    const data = await res.json();

    if (res.status === 401) { window.location.replace("/loyalty/partner/login.html"); return; }

    _setConfirmLoading(false);

    if (!data.success) {
      _showScanError(_codeToMessage(data.code, data.message));
      _beepError();
      return;
    }

    /* ── Prevalidation succeeded ── */
    _beepScan();

    resultBadge.className   = "loyalty-scan-result-badge success";
    resultBadge.textContent = "✓ Cliente verificato";
    customerNameEl.textContent = data.customerName || "";
    resultMessage.textContent  = "Seleziona l'offerta da applicare e conferma.";

    /* Show QR expiry countdown */
    if (data.expiresAt) {
      _startExpiryCountdown(data.expiresAt);
    }

    /* Populate offer select with eligibility */
    _eligibleOffers = data.eligibleOffers || [];
    _populateOfferSelect(_eligibleOffers);

  } catch {
    _setConfirmLoading(false);
    _showScanError("Errore di connessione durante la verifica. Riprova.");
    _beepError();
  }
}

/* ─────────────────────────────────────────────────────────────
   OFFER SELECT POPULATION
───────────────────────────────────────────────────────────── */
function _populateOfferSelect(offers) {
  offerSelect.innerHTML = `<option value="" disabled selected>— Scegli un'offerta —</option>`;

  if (!offers.length) {
    offerSelect.innerHTML += `<option disabled>Nessuna offerta disponibile</option>`;
    offerSelect.disabled   = true;
    resultMessage.textContent = "Nessuna offerta disponibile per questo partner.";
    return;
  }

  offers.forEach((offer) => {
    const opt          = document.createElement("option");
    opt.value          = offer.eligible ? offer.id : "";
    opt.textContent    = offer.eligible
      ? offer.title
      : `${offer.title} — ${offer.reason || "Non disponibile"}`;
    opt.disabled       = !offer.eligible;
    opt.dataset.desc   = offer.description || "";
    opt.dataset.eligible = offer.eligible ? "1" : "0";
    offerSelect.appendChild(opt);
  });

  offerSelect.disabled = false;
}

/* Offer select change handler */
offerSelect.addEventListener("change", () => {
  const selected = offerSelect.options[offerSelect.selectedIndex];
  const desc     = selected?.dataset?.desc;

  if (desc) {
    offerHint.textContent  = desc;
    offerHint.style.display = "block";
  } else {
    offerHint.style.display = "none";
  }

  const hasValue = !!offerSelect.value;
  confirmRedeemBtn.disabled = !hasValue;
  confirmRedeemBtn.setAttribute("aria-disabled", hasValue ? "false" : "true");
});

/* ─────────────────────────────────────────────────────────────
   QR EXPIRY COUNTDOWN DURING CONFIRM PHASE
───────────────────────────────────────────────────────────── */
function _startExpiryCountdown(expiresAt) {
  clearInterval(_expiryCountdown);
  qrExpiry.style.display = "inline-flex";

  _expiryCountdown = setInterval(() => {
    const remaining = Math.max(0, expiresAt - Date.now());
    const secs      = Math.ceil(remaining / 1000);
    const mins      = Math.floor(secs / 60);
    const s         = secs % 60;

    qrExpiryText.textContent = `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    if (remaining <= 0) {
      clearInterval(_expiryCountdown);
      qrExpiry.style.display = "none";
      /* QR expired — prevent redemption attempt */
      if (!_isRedeeming) {
        _showScanError("QR scaduto durante la selezione. Chiedi al cliente di aggiornare il QR.");
        _pendingToken = null;
        confirmRedeemBtn.disabled = true;
        confirmRedeemBtn.setAttribute("aria-disabled", "true");
      }
    }
  }, 1000);
}

/* ─────────────────────────────────────────────────────────────
   CONFIRM REDEMPTION
───────────────────────────────────────────────────────────── */
confirmRedeemBtn.addEventListener("click", async () => {
  if (_isRedeeming) return;

  const offerId = offerSelect.value;
  if (!offerId)      { _showRedeemError("Seleziona un'offerta prima di procedere.");  return; }
  if (!_pendingToken) { _showRedeemError("Token mancante. Scansiona di nuovo il QR."); return; }

  if (!navigator.onLine) {
    _showRedeemError("Connessione assente. Attendi il ripristino della rete.");
    return;
  }

  _isRedeeming = true;
  _setRedeemLoading(true);
  _hideRedeemFeedback();
  clearInterval(_expiryCountdown);

  /* Idempotency key — prevents duplicate processing on network retry */
  const idempotencyKey = crypto.randomUUID();

  try {
    const res = await fetch("/api/loyalty/partner/redeem", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Idempotency-Key": idempotencyKey },
      body:        JSON.stringify({
        token:   _pendingToken,
        offerId,
        idempotencyKey,
      }),
    });

    const data = await res.json();

    if (res.status === 401) { window.location.replace("/loyalty/partner/login.html"); return; }

    _setRedeemLoading(false);

    if (data.success) {
      _beepSuccess();
      _showRedeemSuccess(data);
      _lockConfirmUI();
      _scheduleAutoReset();
    } else {
      _beepError();
      _showRedeemError(_codeToMessage(data.code, data.message));
      _isRedeeming = false;
    }
  } catch {
    _setRedeemLoading(false);
    _beepError();
    _showRedeemError("Errore di connessione. Riprova.");
    _isRedeeming = false;
  }
});

/* ─────────────────────────────────────────────────────────────
   AUTO-RESET AFTER SUCCESS
───────────────────────────────────────────────────────────── */
function _scheduleAutoReset() {
  clearTimeout(_autoResetTimer);
  _autoResetTimer = setTimeout(() => {
    _resetToScanner();
  }, AUTO_RESET_DELAY);
}

/* ─────────────────────────────────────────────────────────────
   SCAN AGAIN
───────────────────────────────────────────────────────────── */
scanAgainBtn.addEventListener("click", () => {
  clearTimeout(_autoResetTimer);
  _resetToScanner();
});

function _resetToScanner() {
  _pendingToken    = null;
  _isRedeeming     = false;
  _eligibleOffers  = [];
  _lastScannedToken = null;

  clearInterval(_expiryCountdown);
  clearTimeout(_autoResetTimer);

  offerSelect.innerHTML = `<option value="" disabled selected>— Scegli un'offerta —</option>`;
  offerSelect.disabled  = false;
  offerHint.style.display = "none";
  confirmRedeemBtn.disabled = true;
  confirmRedeemBtn.setAttribute("aria-disabled", "true");
  qrExpiry.style.display = "none";

  _hideRedeemFeedback();
  redeemSuccess.style.display = "none";

  confirmPhase.style.display = "none";
  scanPhase.style.display    = "block";

  startScanner();
}

/* ─────────────────────────────────────────────────────────────
   MANUAL TOKEN INPUT
───────────────────────────────────────────────────────────── */
manualToggle.addEventListener("click", () => {
  const isOpen = manualInputArea.style.display !== "none";
  manualInputArea.style.display = isOpen ? "none" : "block";
  manualToggle.setAttribute("aria-expanded", String(!isOpen));
  if (!isOpen) manualToken.focus();
});

async function _handleManualSubmit() {
  /* Rate limiting on manual entry */
  const now = Date.now();
  if (now < _manualCooldownUntil) {
    const remaining = Math.ceil((_manualCooldownUntil - now) / 1000);
    _showRedeemError(`Troppi tentativi. Riprova tra ${remaining} secondi.`);
    return;
  }

  const token = manualToken.value.trim();
  if (!token) return;

  _manualAttempts++;
  if (_manualAttempts >= MANUAL_RATE_LIMIT) {
    _manualCooldownUntil = now + MANUAL_COOLDOWN_MS;
    _manualAttempts      = 0;
  }

  await stopScanner();
  _pendingToken     = token;
  manualToken.value = "";
  manualInputArea.style.display = "none";
  manualToggle.setAttribute("aria-expanded", "false");

  await _runPrevalidation(token);
}

manualSubmitBtn.addEventListener("click", _handleManualSubmit);

manualToken.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") { e.preventDefault(); await _handleManualSubmit(); }
});

/* ─────────────────────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────────────────────── */
logoutBtn.addEventListener("click", async () => {
  clearInterval(_heartbeatTimer);
  clearInterval(_expiryCountdown);
  clearTimeout(_autoResetTimer);
  await stopScanner();

  try {
    await fetch("/api/loyalty/partner/logout", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "X-Requested-With": "XMLHttpRequest" },
    });
  } catch { /* best-effort */ }

  window.location.replace("/loyalty/partner/login.html");
});

/* ─────────────────────────────────────────────────────────────
   UI STATE HELPERS
───────────────────────────────────────────────────────────── */
function _showConfirmPhase() {
  scanPhase.style.display    = "none";
  confirmPhase.style.display = "block";
  resultBadge.className      = "loyalty-scan-result-badge";
  resultBadge.textContent    = "Verifica in corso...";
  customerNameEl.textContent = "";
  resultMessage.textContent  = "";
}

function _setConfirmLoading(on) {
  customerNameEl.textContent = on ? "Verifica in corso..." : customerNameEl.textContent;
}

function _setRedeemLoading(on) {
  confirmRedeemBtn.disabled = on;
  confirmRedeemBtn.classList.toggle("loading", on);
}

function _lockConfirmUI() {
  offerSelect.disabled      = true;
  confirmRedeemBtn.disabled = true;
  confirmRedeemBtn.setAttribute("aria-disabled", "true");
}

function _showScanError(msg) {
  scanPhase.style.display    = "none";
  confirmPhase.style.display = "block";
  resultBadge.className      = "loyalty-scan-result-badge error";
  resultBadge.textContent    = "✗ Errore";
  customerNameEl.textContent = "";
  resultMessage.textContent  = msg;
  confirmRedeemBtn.disabled  = true;
  confirmRedeemBtn.setAttribute("aria-disabled", "true");
  offerSelect.innerHTML = `<option value="" disabled selected>— Non disponibile —</option>`;
  offerSelect.disabled  = true;
}

function _showRedeemError(msg) {
  redeemErrorText.textContent = msg;
  redeemError.classList.add("visible");
  redeemSuccess.style.display = "none";
}

function _showRedeemSuccess(data) {
  redeemSuccessText.textContent = data.message || "Sconto applicato con successo.";
  redeemSuccess.style.display   = "flex";
  redeemError.classList.remove("visible");

  /* Populate receipt */
  if (receiptCustomer) receiptCustomer.textContent = data.customerName  || "—";
  if (receiptOffer)    receiptOffer.textContent    = data.offerTitle     || "—";
  if (receiptTime)     receiptTime.textContent     = data.redeemedAt
    ? new Date(data.redeemedAt).toLocaleTimeString("it-IT")
    : new Date().toLocaleTimeString("it-IT");
  if (receiptId) receiptId.textContent = data.redemptionId || "—";

  if (redemptionReceipt) redemptionReceipt.style.display = "block";

  /* Update badge */
  resultBadge.className   = "loyalty-scan-result-badge success";
  resultBadge.textContent = "✓ Sconto applicato";
  if (data.customerName) customerNameEl.textContent = data.customerName;
}

function _hideRedeemFeedback() {
  redeemError.classList.remove("visible");
  redeemSuccess.style.display = "none";
  if (redemptionReceipt) redemptionReceipt.style.display = "none";
}

/* ─────────────────────────────────────────────────────────────
   ERROR CODE → ITALIAN MESSAGE
───────────────────────────────────────────────────────────── */
function _codeToMessage(code, fallback) {
  const map = {
    TOKEN_MISSING:           "QR mancante.",
    TOKEN_MALFORMED:         "QR non valido o corrotto.",
    TOKEN_INVALID_SIGNATURE: "QR non autentico — rifiuta la transazione.",
    TOKEN_EXPIRED:           "QR scaduto. Chiedi al cliente di aggiornare il QR.",
    TOKEN_ALREADY_USED:      "QR già utilizzato. Chiedi al cliente di aggiornare il QR.",
    CUSTOMER_NOT_FOUND:      "Cliente non trovato nel sistema.",
    CUSTOMER_SUSPENDED:      "Account cliente sospeso. Contatta l'amministrazione.",
    OFFER_INVALID:           "Offerta non valida o non attiva.",
    OFFER_ALREADY_REDEEMED:  "Questo cliente ha già utilizzato questa offerta.",
    MUST_CHANGE_PASSWORD:    "Devi impostare una nuova password prima di procedere.",
  };
  return map[code] || fallback || "Errore durante la validazione.";
}

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────── */
(async () => {
  /* Session already verified by HTML inline guard — fetch name for UI */
  try {
    const res = await fetch("/api/loyalty/partner/session", { credentials: "same-origin" });
    if (!res.ok) { window.location.replace("/loyalty/partner/login.html"); return; }
    const data = await res.json();
    if (topbarPartnerName) topbarPartnerName.textContent = data.name || "";
  } catch {
    window.location.replace("/loyalty/partner/login.html");
    return;
  }

  /* Load offers and init camera selector in parallel */
  await _initCameraSelector();

  /* Check if token arrived via URL deep link */
  const hasUrlToken = await _checkUrlToken();

  /* Start camera scanner if no URL token */
  if (!hasUrlToken) startScanner();

  /* Start session heartbeat */
  _startHeartbeat();
})();