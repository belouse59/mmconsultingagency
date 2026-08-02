/**
 * public/js/features/loyalty/customer/dashboard.js
 *
 * Customer dashboard — Area Clienti.
 *
 * Responsibilities:
 *   1. Verify session on load → redirect to login if unauthenticated
 *   2. Load and display the dynamic QR code with a live countdown
 *   3. Auto-refresh the QR before it expires (with a 10s lead time)
 *   4. Allow manual QR refresh via the "Aggiorna QR" button
 *   5. Load and render active offers, cross-referenced with this
 *      customer's redemption history to show which are used/available
 *   6. Load and render the customer's redemption history
 *   7. Handle logout
 *
 * API endpoints used:
 *   GET  /api/loyalty/customer/session      → { id, full_name }
 *   GET  /api/loyalty/customer/qr           → { qrImage, ttl, full_name }
 *   GET  /api/loyalty/customer/offers       → Offer[]
 *   GET  /api/loyalty/customer/redemptions  → Redemption[]
 *   POST /api/loyalty/customer/logout
 */

"use strict";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const LOGIN_URL   = "/loyalty/login";
const API_BASE    = "/api/loyalty/customer";

// Refresh the QR this many seconds before it expires —
// gives the server time to respond before the old one expires.
const QR_REFRESH_LEAD_S = 10;

// "Expiring soon" threshold — dot turns amber when less than
// this many seconds remain.
const QR_EXPIRING_THRESHOLD_S = 30;

/* ─────────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────────── */

const topbarGreeting  = document.getElementById("topbarGreeting");
const logoutBtn       = document.getElementById("logoutBtn");
const qrCustomerName  = document.getElementById("qrCustomerName");
const qrFrame         = document.getElementById("qrFrame");
const qrSkeleton      = document.getElementById("qrSkeleton");
const qrImage         = document.getElementById("qrImage");
const qrCountdown     = document.getElementById("qrCountdown");
const qrStatusDot     = document.getElementById("qrStatusDot");
const qrRefreshBtn    = document.getElementById("qrRefreshBtn");
const offersList      = document.getElementById("offersList");
const offersCount     = document.getElementById("offersCount");
const historyList     = document.getElementById("historyList");
const historyCount    = document.getElementById("historyCount");

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */

let _countdownInterval  = null;   // setInterval handle for TTL countdown
let _refreshTimeout     = null;   // setTimeout handle for auto-refresh
let _qrExpiresAt        = null;   // Date: when the current QR expires
let _usedOfferIds       = new Set(); // offer IDs this customer has already used

/* ─────────────────────────────────────────────
   FETCH HELPERS
───────────────────────────────────────────── */

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res;
}

/* ─────────────────────────────────────────────
   1. SESSION CHECK
───────────────────────────────────────────── */

async function checkSession() {
  try {
    const res = await apiFetch("/session");
    if (!res.ok) {
      window.location.replace(LOGIN_URL);
      return null;
    }
    const { data } = await res.json();
    return data;
  } catch {
    window.location.replace(LOGIN_URL);
    return null;
  }
}

/* ─────────────────────────────────────────────
   2-4. QR CODE
───────────────────────────────────────────── */

/**
 * Fetch a fresh QR token from the API and render it.
 * Wires up the countdown timer and schedules the next auto-refresh.
 */
async function loadQr() {
  // Clear any existing timers so we never double-run
  clearInterval(_countdownInterval);
  clearTimeout(_refreshTimeout);

  if (qrRefreshBtn) qrRefreshBtn.disabled = true;

  // Show skeleton while fetching
  if (qrSkeleton) qrSkeleton.style.display = "";
  if (qrImage)    qrImage.style.display    = "none";

  try {
    const res  = await apiFetch("/qr");
    if (!res.ok) throw new Error("QR fetch failed");

    const { qrImage: qrDataUrl, ttl, full_name } = await res.json();

    // Render QR
    if (qrImage) {
      qrImage.src           = qrDataUrl;
      qrImage.style.display = "";
    }
    if (qrSkeleton) qrSkeleton.style.display = "none";

    // Update name (belt-and-suspenders in case session load was slow)
    if (qrCustomerName && full_name) {
      qrCustomerName.textContent = full_name;
    }

    // Set expiry — ttl is seconds from now
    _qrExpiresAt = new Date(Date.now() + ttl * 1000);

    // Start visual countdown
    startCountdown();

    // Schedule auto-refresh QR_REFRESH_LEAD_S seconds before expiry
    const refreshInMs = Math.max(0, (ttl - QR_REFRESH_LEAD_S) * 1000);
    _refreshTimeout = setTimeout(loadQr, refreshInMs);

  } catch {
    if (qrSkeleton) qrSkeleton.style.display = "none";
    if (qrCountdown) qrCountdown.textContent = "Errore";
    if (qrStatusDot) {
      qrStatusDot.className = "lc-qr-ttl-dot lc-qr-ttl-dot--expired";
    }
  } finally {
    if (qrRefreshBtn) qrRefreshBtn.disabled = false;
  }
}

/**
 * Tick the countdown display every second.
 * Changes dot colour when expiring and when expired.
 */
function startCountdown() {
  clearInterval(_countdownInterval);

  _countdownInterval = setInterval(() => {
    if (!_qrExpiresAt) return;

    const remainingMs = _qrExpiresAt - Date.now();
    const remainingS  = Math.max(0, Math.floor(remainingMs / 1000));

    // Format as M:SS
    const m = Math.floor(remainingS / 60);
    const s = String(remainingS % 60).padStart(2, "0");
    if (qrCountdown) qrCountdown.textContent = `${m}:${s}`;

    // Status dot
    if (qrStatusDot) {
      if (remainingS <= 0) {
        qrStatusDot.className = "lc-qr-ttl-dot lc-qr-ttl-dot--expired";
      } else if (remainingS <= QR_EXPIRING_THRESHOLD_S) {
        qrStatusDot.className = "lc-qr-ttl-dot lc-qr-ttl-dot--expiring";
      } else {
        qrStatusDot.className = "lc-qr-ttl-dot";
      }
    }
  }, 1000);
}

/* ─────────────────────────────────────────────
   5. OFFERS
───────────────────────────────────────────── */

function renderOffers(offers) {
  if (!offersList) return;

  if (!offers.length) {
    offersList.innerHTML = `
      <div class="lc-empty">
        <span class="lc-empty-icon" aria-hidden="true">🎁</span>
        <p class="lc-empty-text">Nessuna convenzione disponibile al momento.</p>
      </div>`;
    if (offersCount) offersCount.textContent = "";
    return;
  }

  const available = offers.filter((o) => !_usedOfferIds.has(o.id));
  const used      = offers.filter((o) =>  _usedOfferIds.has(o.id));

  // Show available first, then used
  const sorted = [...available, ...used];

  if (offersCount) {
    offersCount.textContent = available.length > 0
      ? `${available.length} disponibil${available.length === 1 ? "e" : "i"}`
      : "Tutte utilizzate";
  }

  offersList.innerHTML = sorted.map((offer) => {
    const isUsed = _usedOfferIds.has(offer.id);
    return `
      <article class="lc-offer-card${isUsed ? " lc-offer-card--used" : ""} lc-fade-in"
               aria-label="${escHtml(offer.title)}${isUsed ? " — già utilizzata" : ""}">
        <div class="lc-offer-icon${isUsed ? " lc-offer-icon--used"  : ""}" aria-hidden="true">
          ${isUsed ? "✓" : categoryEmoji(offer.category)}
        </div>
        <div class="lc-offer-body">
          <p class="lc-offer-partner">${escHtml(offer.partnerName || offer.partnerId || "")}</p>
          <p class="lc-offer-title">${escHtml(offer.title)}</p>
          ${offer.description
            ? `<p class="lc-offer-desc">${escHtml(offer.description)}</p>`
            : ""}
        </div>
        <div class="lc-offer-badge">
          ${isUsed
            ? `<span class="lc-offer-badge--used">
                 <i class="fa fa-check" aria-hidden="true"></i>
                 Utilizzata
               </span>`
            : `<span class="lc-offer-badge--available">
                 <i class="fa fa-star" aria-hidden="true"></i>
                 Disponibile
               </span>`}
        </div>
      </article>`;
  }).join("");
}

async function loadOffers() {
  try {
    const res = await apiFetch("/offers");
    if (!res.ok) throw new Error();
    const { data } = await res.json();
    renderOffers(data || []);
  } catch {
    if (offersList) {
      offersList.innerHTML = `
        <div class="lc-empty">
          <span class="lc-empty-icon" aria-hidden="true">⚠</span>
          <p class="lc-empty-text">Impossibile caricare le convenzioni. Riprova.</p>
        </div>`;
    }
  }
}

/* ─────────────────────────────────────────────
   6. HISTORY
───────────────────────────────────────────── */

function renderHistory(redemptions) {
  if (!historyList) return;

  if (!redemptions.length) {
    historyList.innerHTML = `
      <div class="lc-empty">
        <span class="lc-empty-icon" aria-hidden="true">📋</span>
        <p class="lc-empty-text">Non hai ancora utilizzato nessuna convenzione.</p>
      </div>`;
    if (historyCount) historyCount.textContent = "";
    return;
  }

  if (historyCount) {
    historyCount.textContent = `${redemptions.length} utilizz${redemptions.length === 1 ? "o" : "i"}`;
  }

  historyList.innerHTML = redemptions.map((r) => `
    <div class="lc-history-item lc-fade-in">
      <div class="lc-history-dot" aria-hidden="true"></div>
      <div class="lc-history-body">
        <p class="lc-history-offer">${escHtml(r.offerTitle || "Offerta")}</p>
        <p class="lc-history-partner">${escHtml(r.partnerName || r.partnerId || "")}</p>
      </div>
      <time class="lc-history-date" datetime="${r.redeemedAt}">
        ${fmtDate(r.redeemedAt)}
      </time>
    </div>`).join("");
}

async function loadHistory() {
  try {
    const res = await apiFetch("/redemptions");
    if (!res.ok) throw new Error();
    const { data } = await res.json();

    // Populate the used-offer set BEFORE rendering offers —
    // loadOffers() and loadHistory() run in parallel, so we
    // store the result here and re-render offers if history
    // loaded after offers.
    const newUsedIds = new Set((data || []).map((r) => r.offerId));
    const changed    = [...newUsedIds].some((id) => !_usedOfferIds.has(id))
                    || [..._usedOfferIds].some((id) => !newUsedIds.has(id));

    _usedOfferIds = newUsedIds;

    // If offers already rendered, re-render them now that we know which are used
    if (changed && offersList && !offersList.querySelector(".lc-empty p")?.textContent.includes("Caricamento")) {
      await loadOffers();
    }

    renderHistory(data || []);
  } catch {
    if (historyList) {
      historyList.innerHTML = `
        <div class="lc-empty">
          <span class="lc-empty-icon" aria-hidden="true">⚠</span>
          <p class="lc-empty-text">Impossibile caricare lo storico. Riprova.</p>
        </div>`;
    }
  }
}

/* ─────────────────────────────────────────────
   7. LOGOUT
───────────────────────────────────────────── */

async function logout() {
  try {
    await apiFetch("/logout", { method: "POST" });
  } finally {
    clearInterval(_countdownInterval);
    clearTimeout(_refreshTimeout);
    window.location.replace(LOGIN_URL);
  }
}

/* ─────────────────────────────────────────────
   UTILITY HELPERS
───────────────────────────────────────────── */

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("it-IT", {
      day:   "numeric",
      month: "short",
      year:  "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function categoryEmoji(category) {
  const map = {
    ristorante: "🍽️",
    bar:        "☕",
    palestra:   "🏋️",
    negozio:    "🛍️",
    servizi:    "⚙️",
    beauty:     "💆",
    altro:      "🎁",
  };
  return map[category] || "🎁";
}

/* ─────────────────────────────────────────────
   BOOT
───────────────────────────────────────────── */

async function boot() {
  // 1. Session check — redirect to login if unauthenticated
  const customer = await checkSession();
  if (!customer) return;

  // 2. Greet the customer
  const firstName = customer.full_name?.split(" ")[0] || "";
  if (topbarGreeting) topbarGreeting.textContent = `Ciao, ${firstName}`;
  if (qrCustomerName) qrCustomerName.textContent = customer.full_name || "";

  // 3. Wire logout button
  logoutBtn?.addEventListener("click", logout);

  // 4. Wire manual QR refresh
  qrRefreshBtn?.addEventListener("click", loadQr);

  // 5. Load all three sections in parallel — history runs concurrently
  //    with offers because loadHistory() will re-render offers once it
  //    has the used-offer set.
  await Promise.all([
    loadQr(),
    loadOffers(),
    loadHistory(),
  ]);
}

boot();