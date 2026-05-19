/**
 * js/features/loyalty/customer/dashboard.js
 * Customer dashboard — QR display with auto-refresh and offers list.
 *
 * Key improvements over original:
 *   - No localStorage — session verified via httpOnly cookie
 *   - QR refreshed automatically before token expires (TTL - 30s buffer)
 *   - Countdown timer shows remaining validity time
 *   - Full error state with retry button
 *   - Skeleton loaders for both QR and offers
 *   - Logout clears server-side session
 *   - All strings in Italian
 */

/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";

const welcomeNameEl  = $("#welcomeName");
const topbarUserEl   = $("#topbarUserName");
const qrSkeleton     = $("#qrSkeleton");
const qrImage        = $("#qrImage");
const qrError        = $("#qrError");
const qrRetryBtn     = $("#qrRetryBtn");
const timerFill      = $("#timerFill");
const timerText      = $("#timerText");
const offersList     = $("#offersList");
const offersLoading  = $("#offersLoading");
const offersEmpty    = $("#offersEmpty");
const logoutBtn      = $("#logoutBtn");

/* ── State ── */
let _refreshTimer    = null;   // setTimeout handle for next QR refresh
let _countdownTimer  = null;   // setInterval handle for countdown display
let _qrExpiresAt     = null;   // ms timestamp when current token expires
let _ttlMs           = 300000; // fallback — server overrides this

/* ─────────────────────────────────────────────────────────────
   AUTH GUARD
   Verify session before rendering anything. Redirect if not
   authenticated — server-side session only, no localStorage.
───────────────────────────────────────────────────────────── */
async function verifySession() {
  try {
    const res  = await fetch("/api/loyalty/customer/session", {
      credentials: "same-origin",
    });

    if (!res.ok) {
      window.location.replace("/loyalty/customer/login.html");
      return null;
    }

    const data = await res.json();
    return data;
  } catch {
    window.location.replace("/loyalty/customer/login.html");
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   QR LOADING
───────────────────────────────────────────────────────────── */
function showQrSkeleton() {
  qrSkeleton.style.display = "block";
  qrImage.style.display    = "none";
  qrError.style.display    = "none";
}

function showQrImage(src) {
  qrSkeleton.style.display = "none";
  qrError.style.display    = "none";
  qrImage.src              = src;
  qrImage.style.display    = "block";
}

function showQrError() {
  qrSkeleton.style.display = "none";
  qrImage.style.display    = "none";
  qrError.style.display    = "flex";
  /* Stop countdown */
  clearInterval(_countdownTimer);
  timerText.textContent    = "--:--";
  timerFill.style.width    = "0%";
}

async function loadQr() {
  showQrSkeleton();
  _clearTimers();

  try {
    const res  = await fetch("/api/loyalty/customer/qr", {
      credentials: "same-origin",
    });

    if (res.status === 401) {
      window.location.replace("/loyalty/customer/login.html");
      return;
    }

    if (!res.ok) throw new Error("QR fetch failed");

    const data = await res.json();

    if (!data.success || !data.qrImage) throw new Error("Invalid QR response");

    _ttlMs       = data.ttl || 300000;
    _qrExpiresAt = Date.now() + _ttlMs;

    showQrImage(data.qrImage);
    _startCountdown();
    _scheduleRefresh();

  } catch {
    showQrError();
  }
}

/* ─────────────────────────────────────────────────────────────
   COUNTDOWN TIMER
───────────────────────────────────────────────────────────── */
function _startCountdown() {
  clearInterval(_countdownTimer);

  _countdownTimer = setInterval(() => {
    const remaining = Math.max(0, _qrExpiresAt - Date.now());
    const secs      = Math.ceil(remaining / 1000);
    const mins      = Math.floor(secs / 60);
    const s         = secs % 60;

    /* Display mm:ss */
    timerText.textContent = `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    /* Progress bar — width reflects remaining fraction */
    const pct = (remaining / _ttlMs) * 100;
    timerFill.style.width = `${pct}%`;

    /* Turn red in last 60 seconds */
    timerFill.classList.toggle("expiring", remaining < 60_000);

    if (remaining <= 0) {
      clearInterval(_countdownTimer);
      timerText.textContent = "00:00";
    }
  }, 1000);
}

/* ─────────────────────────────────────────────────────────────
   AUTO-REFRESH SCHEDULER
   Refresh 30 seconds before token expires to ensure the displayed
   QR is always valid when the customer shows it.
───────────────────────────────────────────────────────────── */
function _scheduleRefresh() {
  clearTimeout(_refreshTimer);
  const delay = Math.max(0, _ttlMs - 30_000); // refresh 30s before expiry
  _refreshTimer = setTimeout(loadQr, delay);
}

function _clearTimers() {
  clearTimeout(_refreshTimer);
  clearInterval(_countdownTimer);
}

/* ─────────────────────────────────────────────────────────────
   OFFERS
───────────────────────────────────────────────────────────── */
async function loadOffers() {
  try {
    const res  = await fetch("/api/loyalty/customer/offers", {
      credentials: "same-origin",
    });

    if (!res.ok) throw new Error("Offers fetch failed");

    const data   = await res.json();
    const offers = data.data || [];

    offersLoading.style.display = "none";

    if (!offers.length) {
      offersEmpty.style.display = "block";
      return;
    }

    offersList.innerHTML = "";
    offersList.style.display = "flex";

    offers.forEach((offer) => {
      const card = document.createElement("div");
      card.className = "loyalty-offer-card";
      card.innerHTML = `
        <div class="loyalty-offer-icon" aria-hidden="true">🎁</div>
        <div class="loyalty-offer-info">
          <p class="loyalty-offer-title">${_escHtml(offer.title)}</p>
          <p class="loyalty-offer-desc">${_escHtml(offer.description || "")}</p>
        </div>
        ${offer.partnerId
          ? `<span class="loyalty-offer-partner">${_escHtml(offer.partnerId)}</span>`
          : ""}
      `;
      offersList.appendChild(card);
    });

  } catch {
    offersLoading.style.display = "none";
    offersEmpty.style.display   = "block";
    offersEmpty.querySelector(".loyalty-empty-text").textContent =
      "Impossibile caricare le offerte. Riprova più tardi.";
  }
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────────────────────── */
logoutBtn.addEventListener("click", async () => {
  _clearTimers();
  try {
    await fetch("/api/loyalty/customer/logout", {
      method:      "POST",
      credentials: "same-origin",
    });
  } catch { /* Best-effort */ }
  window.location.replace("/loyalty/customer/login.html");
});

/* ─────────────────────────────────────────────────────────────
   RETRY BUTTON
───────────────────────────────────────────────────────────── */
qrRetryBtn.addEventListener("click", loadQr);

/* ─────────────────────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────────────────────── */
function _escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────── */
(async () => {
  const session = await verifySession();
  if (!session) return;

  /* Populate name in UI */
  const name = session.full_name || "Utente";
  welcomeNameEl.textContent  = `Ciao, ${name} 👋`;
  topbarUserEl.textContent   = name;

  /* Load QR and offers in parallel */
  await Promise.all([loadQr(), loadOffers()]);
})();