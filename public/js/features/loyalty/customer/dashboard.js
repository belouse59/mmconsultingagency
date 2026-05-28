/**
 * js/features/loyalty/customer/dashboard.js
 * Customer dashboard — QR display with auto-refresh and offers list.
 *
 * Key behaviours:
 *   - Session verified server-side via httpOnly cookie (no localStorage)
 *   - QR refreshed automatically 30s before token expiry
 *   - Countdown timer shows exact remaining seconds
 *   - Timer bar turns red in the last 60 seconds
 *   - Full error state with retry button
 *   - Offers loaded in parallel with QR
 *   - Logout destroys server-side session
 *   - X-Requested-With on all state-mutating requests (CSRF)
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
// async function verifySession() {
//   try {
//     const res  = await fetch("/api/loyalty/customer/session", {
//       credentials: "same-origin",
//     });

//     if (!res.ok) {
//       window.location.replace("/loyalty/customer/login.html");
//       return null;
//     }

//     const data = await res.json();
//     return data;
//   } catch {
//     window.location.replace("/loyalty/customer/login.html");
//     return null;
//   }
// }

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
  _clearTimers();
  timerText.textContent  = "--:--";
  timerFill.style.width  = "0%";
}
 
/* ─────────────────────────────────────────────────────────────
   QR LOAD
───────────────────────────────────────────────────────────── */
async function loadQr() {
  showQrSkeleton();
  _clearTimers();
 
  try {
    const res = await fetch("/api/loyalty/customer/qr", {
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
   COUNTDOWN
───────────────────────────────────────────────────────────── */
function _startCountdown() {
  clearInterval(_countdownTimer);
 
  _countdownTimer = setInterval(() => {
    const remaining = Math.max(0, _qrExpiresAt - Date.now());
    const totalSecs = Math.ceil(remaining / 1000);
    const mins      = Math.floor(totalSecs / 60);
    const secs      = totalSecs % 60;
 
    timerText.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
 
    const pct = (remaining / _ttlMs) * 100;
    timerFill.style.width = `${pct}%`;
    timerFill.classList.toggle("expiring", remaining < 60_000);
 
    if (remaining <= 0) {
      clearInterval(_countdownTimer);
      timerText.textContent = "00:00";
    }
  }, 1000);
}
 
/* ─────────────────────────────────────────────────────────────
   AUTO-REFRESH — 30s before expiry
───────────────────────────────────────────────────────────── */
function _scheduleRefresh() {
  clearTimeout(_refreshTimer);
  const delay    = Math.max(0, _ttlMs - 30_000);
  _refreshTimer  = setTimeout(loadQr, delay);
}
 
function _clearTimers() {
  clearTimeout(_refreshTimer);
  clearInterval(_countdownTimer);
}
 
/* ─────────────────────────────────────────────────────────────
   OFFERS
───────────────────────────────────────────────────────────── */
function _esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
 
async function loadOffers() {
  try {
    const res    = await fetch("/api/loyalty/customer/offers", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Offers fetch failed");
 
    const data   = await res.json();
    const offers = data.data || [];
 
    offersLoading.style.display = "none";
 
    if (!offers.length) {
      offersEmpty.style.display = "block";
      return;
    }
 
    offersList.style.display = "flex";
    offersList.innerHTML = offers.map((o) => `
      <div class="loyalty-offer-card">
        <div class="loyalty-offer-icon" aria-hidden="true">🎁</div>
        <div class="loyalty-offer-info">
          <p class="loyalty-offer-title">${_esc(o.title)}</p>
          ${o.description ? `<p class="loyalty-offer-desc">${_esc(o.description)}</p>` : ""}
        </div>
        ${o.partnerId ? `<span class="loyalty-offer-partner">${_esc(o.partnerId)}</span>` : ""}
      </div>
    `).join("");
 
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
      headers:     { "X-Requested-With": "XMLHttpRequest" },
    });
  } catch { /* best-effort */ }
  window.location.replace("/loyalty/customer/login.html");
});
 
/* ─────────────────────────────────────────────────────────────
   RETRY BUTTON
───────────────────────────────────────────────────────────── */
qrRetryBtn.addEventListener("click", loadQr);
 
/* ─────────────────────────────────────────────────────────────
   BOOT
   Session was already verified by the inline <script> guard in HTML.
   We call it again here to get the full_name for the UI — the
   previous check only confirmed auth status, didn't return data.
───────────────────────────────────────────────────────────── */
(async () => {
  try {
    const res  = await fetch("/api/loyalty/customer/session", { credentials: "same-origin" });
    if (!res.ok) {
      window.location.replace("/loyalty/customer/login.html");
      return;
    }
    const data = await res.json();
 
    const name = data.full_name || "Utente";
    welcomeNameEl.textContent = `Ciao, ${name} 👋`;
    topbarUserEl.textContent  = name;
 
  } catch {
    window.location.replace("/loyalty/customer/login.html");
    return;
  }
 
  /* Load QR and offers in parallel */
  await Promise.all([loadQr(), loadOffers()]);
})();