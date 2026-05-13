/**
 * M&M Consulting — app.js
 * Single consolidated frontend entry point.
 * Replaces: animate-section.js, carousel-partners-hero.js, carousel-reviews.js,
 *           carousel-team.js, faq-animation.js, go-to-section.js, privacy-modal.js,
 *           provider-simulator.js, scroll-reset.js, simulator-energy.js,
 *           submit-form.js, update-cta-btn.js, whatsapp.js
 *
 * Architecture:
 *   - Each feature is an isolated module (IIFE or plain object)
 *   - No globals except the minimum required for inline HTML handlers
 *   - DOMContentLoaded gates all DOM queries
 *   - fetch() errors are always caught and surfaced to the user
 */

"use strict";

/* ─────────────────────────────────────────────────────────────
   SCROLL RESTORATION — must run before DOMContentLoaded
───────────────────────────────────────────────────────────── */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);
window.addEventListener("load", () => {
  if (window.location.hash) history.replaceState(null, null, window.location.pathname);
  window.scrollTo(0, 0);
});

/* ─────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/** Smooth scroll with easing to an element, respecting the fixed nav */
function smoothScrollTo(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const nav = $(".site-header") || $(".banner");
  const offset = nav ? nav.offsetHeight + 20 : 20;
  const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
  const start = window.pageYOffset;
  const dist = top - start;
  let startTime = null;

  function step(now) {
    if (!startTime) startTime = now;
    const t = Math.min((now - startTime) / 1100, 1);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    window.scrollTo(0, start + dist * eased);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/** Show a toast notification */
function showToast(html, type = "success", duration = 4500) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = html;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 500);
  }, duration);
}

/** POST JSON to the backend */
async function postForm(payload) {
  try {
    const res = await fetch("/api/form/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { success: false, message: `Errore ${res.status}` };
    const data = await res.json();
    return { success: data.status === "success", message: data.message || "" };
  } catch {
    return { success: false, message: "Errore di connessione. Riprova." };
  }
}

/** Set a button into loading/done state */
function setButtonLoading(btn, loading, label = null) {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.widthLocked) {
      btn.style.width = btn.offsetWidth + "px";
      btn.dataset.widthLocked = "1";
    }
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
    if (label) {
      const textEl = btn.querySelector(".btn-text");
      if (textEl) textEl.textContent = label;
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────────────────────── */
function initNav() {
  const burger = $("#navBurger");
  const mobileMenu = $("#mobileMenu");
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const ctaBtn = $("#navCtaBtn");

  /* CTA — phone call on mobile, smooth scroll on desktop */
  if (ctaBtn) {
    if (isMobile()) {
      ctaBtn.setAttribute("href", "tel:+390909412150");
      ctaBtn.removeAttribute("data-target");
    } else {
      const textEl = ctaBtn.querySelector(".nav-cta-text");
      if (textEl) textEl.textContent = "Contattaci";
    }
  }

  /* Hamburger toggle */
  if (burger && mobileMenu) {
    burger.addEventListener("click", () => {
      const open = mobileMenu.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Chiudi menu" : "Apri menu");
    });
  }

  /* Delegated smooth scroll — nav links + all [data-target] elements */
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-target]");
    if (!link) return;
    const targetId = link.dataset.target;
    if (!targetId) return;

    /* On mobile, let phone link work normally */
    if (isMobile() && link.getAttribute("href")?.startsWith("tel:")) return;

    e.preventDefault();
    smoothScrollTo(targetId);

    /* Close mobile menu if open */
    if (mobileMenu?.classList.contains("open")) {
      mobileMenu.classList.remove("open");
      burger?.setAttribute("aria-expanded", "false");
    }
  });

  /* Legacy pipe-ID click handler (backward compat with old HTML) */
  $$("[id*='|']").forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = el.id.split("|")[1];
      if (!id) return;
      if (isMobile() && id === "contact") return; // let tel: work
      e.preventDefault();
      smoothScrollTo(id);
    });
  });

  /* Active nav link on scroll */
  const sections = $$("section[id], div[id]").filter((s) => s.id);
  const navLinks = $$(".nav-link");
  const scrollHint = $("#scrollHint");

  const onScroll = () => {
    const scrollY = window.scrollY;

    /* Hide scroll hint after 120px */
    if (scrollHint) scrollHint.classList.toggle("hidden", scrollY > 120);

    /* Highlight active section in nav */
    let current = "";
    sections.forEach((s) => {
      if (scrollY >= s.offsetTop - 120) current = s.id;
    });

    navLinks.forEach((a) => {
      a.classList.toggle("active", a.dataset.target === current);
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Footer year */
  const yearEl = $("#currentYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ─────────────────────────────────────────────────────────────
   INTERSECTION OBSERVER — reveal animations
───────────────────────────────────────────────────────────── */
function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          /* Also reveal results section when simulator enters view */
          if (entry.target.classList.contains("simulator-section")) {
            $(".stats")?.classList.add("visible");
          }
        }
      });
    },
    { threshold: 0.15 }
  );

  $$(".reveal").forEach((el) => observer.observe(el));
}

/* ─────────────────────────────────────────────────────────────
   PARTNERS MARQUEE
   Fetches /api/partners/images, builds duplicated track for
   seamless CSS marquee. Falls back to old carousel if needed.
───────────────────────────────────────────────────────────── */
async function initPartners() {
  const track = $("#marqueeTrack") || $("#carouselTrack");
  if (!track) return;

  try {
    const res = await fetch("/api/partners/images");
    if (!res.ok) return;
    const images = await res.json();
    if (!images?.length) return;

    /* Build two copies for infinite loop */
    const buildImgs = () =>
      images
        .map((src) => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "Partner energetico";
          img.width = 110;
          img.height = 40;
          img.loading = "lazy";
          return img;
        });

    /* If marquee track: duplicate set */
    if (track.id === "marqueeTrack") {
      [...buildImgs(), ...buildImgs()].forEach((img) => track.appendChild(img));
      return;
    }

    /* Legacy carousel fallback */
    track.innerHTML = "";
    const mid = Math.ceil(images.length / 2);
    const rows = [images.slice(0, mid), images.slice(mid)];

    rows.forEach((rowImgs) => {
      const slide = document.createElement("div");
      slide.className = "carousel-slide";
      rowImgs.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "Fornitore partner";
        slide.appendChild(img);
      });
      track.appendChild(slide);
    });

    initLegacyCarousel(track, ".carousel-btn.left", ".carousel-btn.right", 5000);
  } catch (err) {
    console.warn("Partners load failed:", err);
  }
}

function initLegacyCarousel(track, leftSel, rightSel, interval) {
  let idx = 0;
  const slides = track.querySelectorAll(".carousel-slide");
  if (!slides.length) return;

  const go = (n) => {
    idx = (n + slides.length) % slides.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
  };

  $(leftSel)?.addEventListener("click", () => go(idx - 1));
  $(rightSel)?.addEventListener("click", () => go(idx + 1));
  setInterval(() => go(idx + 1), interval);
}

/* ─────────────────────────────────────────────────────────────
   TEAM CAROUSEL
───────────────────────────────────────────────────────────── */
async function initTeam() {
  const track = $("#teamTrack");
  if (!track) return;

  try {
    const res = await fetch("/api/team");
    if (!res.ok) return;
    const team = await res.json();
    if (!team?.length) return;

    track.innerHTML = "";

    team.forEach((member, i) => {
      const slide = document.createElement("div");
      slide.className = "team-slide" + (i === 0 ? " active" : "");

      const badges = Array.isArray(member.badges)
        ? member.badges.map((b) => `<span class="team-badge">${b}</span>`).join("")
        : "";

      slide.innerHTML = `
        <div class="team-card">
          <div class="team-image">
            <img src="./assets/team/${member.imageId}"
                 alt="Foto di ${member.name}, ${member.role} M&M Consulting"
                 loading="lazy" width="160" height="190">
          </div>
          <div class="team-text">
            <h3>${member.name}</h3>
            <span class="team-role">${member.role}</span>
            <p>${member.description}</p>
            <div class="team-badges">${badges}</div>
          </div>
        </div>`;

      track.appendChild(slide);
    });

    let idx = 0;
    const slides = $$(".team-slide", track.parentElement);
    const total = slides.length;

    function goTo(n) {
      slides[idx].classList.remove("active");
      idx = (n + total) % total;
      slides[idx].classList.add("active");
      track.style.transform = `translateX(-${idx * 100}%)`;
    }

    const nextBtn = $("#teamNext");
    const prevBtn = $("#teamPrev");
    if (nextBtn) nextBtn.onclick = () => goTo(idx + 1);
    if (prevBtn) prevBtn.onclick = () => goTo(idx - 1);

    /* Auto-advance */
    let timer = setInterval(() => goTo(idx + 1), 6500);
    [nextBtn, prevBtn].forEach((btn) => {
      btn?.addEventListener("click", () => {
        clearInterval(timer);
        timer = setInterval(() => goTo(idx + 1), 6500);
      });
    });

    /* Expose for any legacy onclick in HTML */
    window.nextTeam = () => goTo(idx + 1);
    window.prevTeam = () => goTo(idx - 1);
  } catch (err) {
    console.warn("Team load failed:", err);
  }
}

/* ─────────────────────────────────────────────────────────────
   REVIEWS CAROUSEL
───────────────────────────────────────────────────────────── */
function initReviews() {
  /* Reviews previous btn */
  const btnLeft = $(".carousel-btn--left");
  if (!btnLeft) return;

  /* Reviews next btn */
  const btnRight = $(".carousel-btn--right");
  if (!btnRight) return;

  const reviewsTrack = $(".reviews-track");
  if (!reviewsTrack) return;

  const cards = $$(".review-card", reviewsTrack);
  if (!cards.length) return;

  let idx = 0;

  btnLeft.addEventListener("click", () => goTo(idx - 1));
  btnRight.addEventListener("click", () => goTo(idx + 1));

  function goTo(n) {
    idx = (n + cards.length) % cards.length;
    reviewsTrack.style.transform = `translateX(-${idx * 100}%)`;
  }

  setInterval(() => goTo(idx + 1), 5500);
}

/* ─────────────────────────────────────────────────────────────
   FAQ ACCORDION
───────────────────────────────────────────────────────────── */
function initFAQ() {
  $$(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const isOpen = item.classList.contains("active");
      const answer = item.querySelector(".faq-answer");

      /* Close all others */
      $$(".faq-item.active").forEach((open) => {
        if (open !== item) {
          open.classList.remove("active");
          open.querySelector(".faq-question").setAttribute("aria-expanded", "false");
          const a = open.querySelector(".faq-answer");
          if (a) { a.removeAttribute("hidden"); a.style.maxHeight = "0"; }
        }
      });

      item.classList.toggle("active", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));

      if (answer) {
        if (!isOpen) {
          answer.removeAttribute("hidden");
          answer.style.maxHeight = answer.scrollHeight + "px";
        } else {
          answer.style.maxHeight = "0";
          setTimeout(() => answer.setAttribute("hidden", ""), 400);
        }
      }
    });
  });
}



// ==========================
// WHATSAPP CHAT
// ==========================
function initWhatsApp() {
  // Elements
  const input = document.getElementById("userMessage");
  const whatsappFloat = $(".wa-float");
  const whatsappCloseBtn = $(".wa-chat-close");
  const quickActionsBtns = $$(".wa-quick-actions button");
  const quickActions = $(".wa-quick-actions");
  const submitChatBtn = $(".wa-send-btn");
  const chat = document.getElementById("whatsappChat");

  // State
  let selectedMessage = "";
  let userInteracted = false;
  let inactivityTimer;
  let chatAlreadyOpened = false;
  let hasEngaged = false;

  // ==========================
  // TEXTAREA BEHAVIOR
  // ==========================

  // Auto-resize textarea
  input.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
    if (input.value.trim() === "") quickActions.style.display = "flex";
  });

  // Enter = send / Shift+Enter = newline
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      if (event.shiftKey) return;

      event.preventDefault();

      if (input.value.trim() !== "") {
        sendToWhatsApp();
      }
    }
  });

  // ==========================
  // CHAT OPEN / CLOSE
  // ==========================

  function openChat() {
    chat.classList.add("active");
    userInteracted = true;
  }

  function toggleChat() {
    userInteracted = true;
    clearTimeout(inactivityTimer);
    chat.classList.toggle("active");
  }

  // Buttons
  whatsappFloat.addEventListener("click", toggleChat);
  whatsappCloseBtn.addEventListener("click", toggleChat);
  submitChatBtn.addEventListener("click", sendToWhatsApp);

  // ==========================
  // QUICK ACTIONS
  // ==========================

  quickActionsBtns.forEach(button => {
    button.addEventListener("click", selectPrompt);
  });

  function selectPrompt(e) {
    const origin = e.currentTarget.id.split("|")[1];

    switch (origin) {
      case "QuantoPossoRisparmiare":
        selectedMessage =
          "Ciao, vorrei sapere quanto posso risparmiare sulla mia bolletta luce e gas.";
        break;

      case "InviareBolletta":
        selectedMessage =
          "Ciao, vorrei ricevere un'analisi della mia bolletta per capire se posso risparmiare.";
        break;

      case "ContattoRapido":
        selectedMessage =
          "Ciao, vorrei parlare con un consulente per ricevere maggiori informazioni.";
        break;

      default:
        selectedMessage = "Ciao, vorrei ricevere maggiori informazioni.";
        break;
    }

    input.value = selectedMessage;
    input.focus();

    quickActions.style.display = "none";

    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
  }

  // ==========================
  // SEND TO WHATSAPP
  // ==========================

  function sendToWhatsApp() {
    const phoneNumber = "393713397393"; // no "+"
    const finalMessage =
      input.value.trim() ||
      selectedMessage ||
      "Buongiorno, vorrei ricevere informazioni.";

    const url =
      `https://wa.me/${phoneNumber}?text=${encodeURIComponent(finalMessage)}`;

    window.open(url, "_blank");

    // Reset input
    input.value = "";
    input.style.height = "auto";
    quickActions.style.display = "flex";
    toggleChat();
  }

  // ==========================
  // IDLE POPUP LOGIC
  // ==========================

  // Detect engagement after scroll
  window.addEventListener("scroll", () => {
    const scrollPercent =
      window.scrollY / (document.body.scrollHeight - window.innerHeight);

    if (scrollPercent > 0.25) {
      hasEngaged = true;
    }
  });

  // Open chat after inactivity
  function openChatOnIdle() {
    if (
      chatAlreadyOpened ||
      userInteracted ||
      !hasEngaged
    ) return;

    openChat();
    chatAlreadyOpened = true;

    sessionStorage.setItem("chatShown", "true");
    removeActivityListeners();
  }

  // Reset inactivity timer
  function resetIdleTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(openChatOnIdle, 18000); // 18 sec
  }

  // Any activity resets timer
  function handleActivity() {
    resetIdleTimer();
  }

  // Register activity listeners
  function addActivityListeners() {
    [
      "mousemove",
      "scroll",
      "click",
      "keydown",
      "touchstart"
    ].forEach(eventName => {
      window.addEventListener(eventName, handleActivity, {
        passive: true
      });
    });
  }

  // Remove listeners once popup shown
  function removeActivityListeners() {
    [
      "mousemove",
      "scroll",
      "click",
      "keydown",
      "touchstart"
    ].forEach(eventName => {
      window.removeEventListener(eventName, handleActivity);
    });
  }

  // Init popup logic only once per session
  if (!sessionStorage.getItem("chatShown")) {
    addActivityListeners();
    resetIdleTimer();
  }

}
/* ─────────────────────────────────────────────────────────────
   CONTACT FORM
───────────────────────────────────────────────────────────── */
function initContactForm() {
  const form = $("#contactForm");
  const submitBtn = $("#contact-btn");
  const phoneToggle = $("#phoneToggle");
  const phoneFieldWrap = $("#phoneFieldWrap");
  const contactTimeRow = $("#contactTimeRow");
  const consentBlock = $(".consent-block");
  const consentChk = $("#consentCheckbox") || $("#consent-checkbox");
  const consentError = $("#consentError");

  if (!form) return;

  /* Phone toggle */
  phoneToggle?.addEventListener("change", () => {
    const checked = phoneToggle.checked;
    phoneToggle.setAttribute("aria-checked", String(checked));

    /* Show/hide phone field */
    if (phoneFieldWrap) phoneFieldWrap.style.display = checked ? "block" : "none";
    const phoneInput = $("#phoneInput");
    if (phoneInput) phoneInput.required = checked;

    /* Show/hide preferred contact time */
    if (contactTimeRow) contactTimeRow.style.display = checked ? "flex" : "none";
  });

  /* Clear consent error on check */
  consentChk?.addEventListener("change", () => {
    if (consentChk.checked) {
      consentBlock?.classList.remove("error");
      consentError?.classList.remove("visible");
    }
  });

  /* Submit */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* Consent gate */
    if (!consentChk?.checked) {
      consentBlock?.classList.add("error");
      consentError?.classList.add("visible");
      consentBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    /* HTML5 validation */
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (form.company.value) return;

    const payload = {
      formType: "contact",
      firstname: form.firstname?.value?.trim(),
      lastname: form.lastname?.value?.trim(),
      email: form.email?.value?.trim(),
      phone: form.phone?.value?.trim() || "",
      energyType: form.energyType?.value || "",
      contactTime: form.contactTime?.value || "",
      messageForm: form.message?.value?.trim() || "",
      consent: consentChk ? "SI" : "NO"
    };

    setButtonLoading(submitBtn, true);
    const result = await postForm(payload);

    if (result.success) {
      showToast("✓ Richiesta inviata! Ti risponderemo entro 24 ore.", "success");
      setButtonLoading(submitBtn, false, "✓ Inviato");
      submitBtn.style.background = "var(--green)";
      submitBtn.style.color = "#fff";
      submitBtn.disabled = true;
      form.reset();
      if (phoneFieldWrap) phoneFieldWrap.style.display = "none";
      if (contactTimeRow) contactTimeRow.style.display = "none";
    } else {
      showToast(result.message || "Errore durante l'invio. Riprova.", "error");
      setButtonLoading(submitBtn, false, "Invia richiesta gratuita");
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   NEWSLETTER FORM
───────────────────────────────────────────────────────────── */
function initNewsletter() {
  const form = $("#newsletterForm");
  const btn = $("#newsletter-btn");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email?.value?.trim();
    if (!email || !form.email.checkValidity()) {
      showToast("Inserisci un'email valida.", "error");
      return;
    }

    setButtonLoading(btn, true);
    const result = await postForm({ formType: "newsletter", email });

    if (result.success) {
      showToast("✓ Iscrizione confermata! Grazie.", "success");
      setButtonLoading(btn, false, "✓ Iscritto");
      btn.style.background = "var(--green)";
      btn.disabled = true;
      form.reset();
    } else {
      const msg = result.message === "Already subscribed"
        ? "Questa email è già iscritta alla newsletter."
        : result.message || "Errore durante l'iscrizione.";
      showToast(msg, "error");
      setButtonLoading(btn, false, "Iscriviti");
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   ENERGY SIMULATOR
───────────────────────────────────────────────────────────── */
function initSimulator() {
  const simContainer = $(".simulator-container");
  if (!simContainer) return;

  /* ── DOM refs ── */
  const steps = $$(".sim-step");
  const trackSteps = $$(".sim-track-step");
  const connectors = $$(".sim-track-connector");
  const nextBtn = $("#nextBtn");
  const prevBtn = $("#prevBtn");
  const simNav = $(".sim-nav");

  /* Step-specific inputs */
  const energyCards = $$('[data-value="electricity"],[data-value="gas"],[data-value="both"]');
  const houseCards = $$('[data-value="house"],[data-value="flat"]');
  const peopleCards = $$("[data-people]");
  const locationInp = $("#locationInput");
  const surfaceSlider = $("#surfaceSlider");
  const surfaceDisp = $("#surfaceValue2");
  const toggleOpts = $$(".toggle-option");
  const consumInps = $("#consumptionInputs");
  const helperTxt = $(".helper-text");
  const providerSel = $(".provider-select");
  const providerInp = $(".provider-input");
  const selectWrap = $(".custom-select-wrap") || $(".custom-select-wrapper");
  const billSlider = $("#billSlider");
  const sliderDisp = $("#sliderValue");

  if (!nextBtn || !prevBtn || !steps.length) return;

  /* ── State ── */
  let currentStep = 0;
  let selectedEnergy = null;
  let selectedHouse = null;
  let selectedPeople = null;
  let locationValue = "";
  let surface = 80;
  let consumptionMode = "estimated";
  let selectedProvider = null;

  /* ── Step progress track ── */
  function updateTrack() {
    trackSteps.forEach((s, i) => {
      s.classList.toggle("active", i === currentStep);
      s.classList.toggle("done", i < currentStep);
      const dot = s.querySelector(".sim-track-dot");
      if (dot) dot.setAttribute("aria-current", i === currentStep ? "step" : "false");
    });
    connectors.forEach((c, i) => c.classList.toggle("done", i < currentStep));

    /* Fallback dot progress */
    $$(".simulator-progress .step").forEach((d, i) => {
      d.classList.toggle("active", i <= currentStep);
    });
  }

  /* ── Step visibility ── */
  function updateSimulator() {
    steps.forEach((step, i) => {
      step.style.transform = `translateX(-${currentStep * 100}%)`;
      step.style.opacity = i === currentStep ? "1" : "0.25";
      step.classList.toggle("active", i === currentStep);
    });

    prevBtn.style.visibility = currentStep === 0 ? "hidden" : "visible";
    nextBtn.textContent =
      currentStep === steps.length - 1 ? "Termina" : "Avanti →";

    updateTrack();
    updateButtons();
  }

  /* ── Validation ── */
  function canProceed() {
    switch (currentStep) {
      case 0: return selectedEnergy !== null;
      case 1: return selectedHouse !== null && locationValue !== "";
      case 2: return selectedPeople !== null;
      case 3: {
        if (consumptionMode === "estimated") return true;
        const eSlider = $("#electricitySlider");
        const gSlider = $("#gasSlider");
        if (selectedEnergy === "both") return Number(eSlider?.value) > 0 && Number(gSlider?.value) > 0;
        if (selectedEnergy === "electricity") return Number(eSlider?.value) > 0;
        if (selectedEnergy === "gas") return Number(gSlider?.value) > 0;
        return true;
      }
      case 4: return !!selectedProvider && selectedProvider !== "" && selectedProvider !== "ALTRO";
      case 5: return Number(billSlider?.value) > 0;
      default: return true;
    }
  }

  function updateButtons() {
    const ok = canProceed();
    nextBtn.disabled = !ok;
    nextBtn.style.opacity = ok ? "1" : "0.45";
    nextBtn.style.cursor = ok ? "pointer" : "not-allowed";
  }

  /* ── Slider setup ── */
  function setupSlider(slider, display, unit, minClamp, maxClamp) {
    if (!slider || !display) return;

    function update() {
      const val = parseInt(slider.value);
      const percent = val / slider.max;
      const isDesk = window.innerWidth > 600;
      const minOff = isDesk ? 0.06 : 0.10;
      const maxOff = isDesk ? 0.94 : 0.90;

      display.textContent = `${val} ${unit}`;

      slider.style.background = `linear-gradient(
        to right,
        var(--gold) 0%,
        var(--gold-dark) ${percent * 100}%,
        var(--border) ${percent * 100}%,
        var(--border) 100%
      )`;

      let left;
      if (val <= minClamp) left = minOff * 100;
      else if (val >= maxClamp) left = maxOff * 100;
      else left = percent * 100;

      display.style.left = `calc(${left}%)`;
      updateButtons();
    }

    slider.addEventListener("input", update);
    update();
  }

  /* Init sliders */
  if (surfaceSlider && surfaceDisp) setupSlider(surfaceSlider, surfaceDisp, "m²", 30, 180);
  if (billSlider && sliderDisp) setupSlider(billSlider, sliderDisp, "€", 30, 470);

  /* ── Option cards (energy, house, people) ── */
  function bindCards(cards, onSelect) {
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        cards.forEach((c) => {
          c.classList.remove("active");
          c.setAttribute("aria-checked", "false");
        });
        card.classList.add("active");
        card.setAttribute("aria-checked", "true");
        onSelect(card);
        updateButtons();
      });
    });
  }

  bindCards(energyCards, (c) => { selectedEnergy = c.dataset.value; });
  bindCards(houseCards, (c) => { selectedHouse = c.dataset.value; });
  bindCards(peopleCards, (c) => { selectedPeople = c.dataset.people; });

  /* Location */
  locationInp?.addEventListener("input", () => {
    locationValue = locationInp.value.trim();
    updateButtons();
  });

  /* Surface slider */
  surfaceSlider?.addEventListener("input", () => {
    surface = surfaceSlider.value;
    updateButtons();
  });

  /* Consumption toggle */
  toggleOpts.forEach((opt) => {
    opt.addEventListener("click", () => {
      toggleOpts.forEach((o) => {
        o.classList.remove("active");
        o.setAttribute("aria-checked", "false");
      });
      opt.classList.add("active");
      opt.setAttribute("aria-checked", "true");
      consumptionMode = opt.dataset.mode;
      renderConsumptionInputs();
    });
  });

  /* Provider select */
  providerSel?.addEventListener("change", (e) => {
    selectedProvider = providerSel.value;
    if (e.isTrusted) {
      $$(".provider-card").forEach((c) => {
        c.classList.remove("active");
        c.setAttribute("aria-checked", false);
      });
    }
    // find matching card
    const matchingCard = $(`.provider-card[aria-label="${selectedProvider}"]`);

    // activate if found
    if (matchingCard) {
      matchingCard.classList.add("active");
      matchingCard.setAttribute("aria-checked", "true");
    }

    if (providerInp) {
      providerInp.style.display = selectedProvider === "ALTRO" ? "block" : "none";
      if (selectedProvider !== "ALTRO") providerInp.value = "";
    }
    updateButtons();
  });

  /* Custom select chevron */
  selectWrap?.addEventListener("click", () => selectWrap.classList.toggle("active"));
  document.addEventListener("click", (e) => {
    if (selectWrap && !selectWrap.contains(e.target)) selectWrap.classList.remove("active");
  });

  /* Provider text input */
  providerInp?.addEventListener("input", () => {
    selectedProvider = providerInp.value.trim();
    $$(".provider-card").forEach((c) => {
      c.classList.remove("active");
      c.setAttribute("aria-checked", false);

    });
    if (providerSel) providerSel.value = "";
    updateButtons();
  });

  /* ── Consumption inputs ── */
  function renderConsumptionInputs() {
    if (!consumInps) return;
    consumInps.innerHTML = "";

    if (helperTxt) {
      helperTxt.textContent =
        consumptionMode === "estimated"
          ? "Non sei sicuro? Scegli la stima — la calcoleremo per te in base alla tua abitazione."
          : "Inserisci il tuo consumo reale per una stima più precisa.";
    }

    if (consumptionMode === "estimated") return;

    const blocks = [];
    if (selectedEnergy === "electricity" || selectedEnergy === "both") {
      blocks.push({
        id: "electricitySlider", dispId: "electricityValue",
        label: "⚡ Consumo elettricità", min: 0, max: 1000, val: 300, unit: "kWh",
        minClamp: 50, maxClamp: 900,
      });
    }
    if (selectedEnergy === "gas" || selectedEnergy === "both") {
      blocks.push({
        id: "gasSlider", dispId: "gasValue",
        label: "🔥 Consumo gas", min: 0, max: 2000, val: 800, unit: "kWh",
        minClamp: 100, maxClamp: 1800,
      });
    }

    blocks.forEach(({ id, dispId, label, min, max, val, unit, minClamp, maxClamp }) => {
      const block = document.createElement("div");
      block.className = "consumption-block";
      block.innerHTML = `
        <label>${label}</label>
        <div class="sim-slider-wrap">
          <div class="sim-slider-thumb" id="${dispId}">${val} ${unit}</div>
          <input type="range" class="sim-slider bill-slider" id="${id}"
                 min="${min}" max="${max}" value="${val}"
                 aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${val}">
        </div>`;
      consumInps.appendChild(block);
      setupSlider(document.getElementById(id), document.getElementById(dispId), unit, minClamp, maxClamp);
    });
  }

  /* ── Navigation ── */
  nextBtn.addEventListener("click", () => {
    if (currentStep < steps.length - 1) {
      currentStep++;
      updateSimulator();
      if (currentStep === steps.length - 1) {
        showLoadingState();
        setTimeout(renderResults, 1800);
      }
    }
  });

  prevBtn.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      if (currentStep < 3) {
        toggleOpts.forEach((o, i) => {
          o.classList.toggle("active", i === 0);
          o.setAttribute("aria-checked", i === 0 ? "true" : "false");
        });
        consumptionMode = "estimated";
        if (consumInps) consumInps.innerHTML = "";
      }
      updateSimulator();
    }
  });

  /* ── Loading state ── */
  function showLoadingState() {
    if (simNav) simNav.style.display = "none";
    const resultStep = $(".result-step");
    if (resultStep) {
      resultStep.innerHTML = `
        <div class="loading-container">
          <div class="loader"></div>
          <h3>Analisi del tuo profilo…</h3>
          <p>Stiamo calcolando il tuo risparmio energetico</p>
        </div>`;
    }
  }

  /* ── Savings calculation ── */
  function calculateSavings() {
    const peopleFactor = { "1": 1.0, "2": 1.2, "3": 1.4, "4+": 1.7 };
    let base = Number(surface) * 2.5;
    base *= (peopleFactor[selectedPeople] || 1);
    if (selectedHouse === "house") base *= 1.2;
    if (selectedHouse === "flat") base *= 0.9;
    if (selectedEnergy === "electricity") base *= 0.9;
    if (selectedEnergy === "gas") base *= 1.1;
    if (selectedEnergy === "both") base *= 1.25;

    const bill = Number(billSlider?.value || 100);
    let monthly = (bill * 0.18) + (base * 0.03);
    monthly = Math.max(8, Math.min(Math.round(monthly), 180));

    /* Read known consumption if provided */
    const eSlider = $("#electricitySlider");
    const gSlider = $("#gasSlider");
    const eDisp = $("#electricityValue");
    const gDisp = $("#gasValue");

    const electricityKwh =
      (selectedEnergy === "both" || selectedEnergy === "electricity") &&
        consumptionMode !== "estimated"
        ? Number(eDisp?.textContent?.split(" ")[0]) || 0
        : 0;

    const gasKwh =
      (selectedEnergy === "both" || selectedEnergy === "gas") &&
        consumptionMode !== "estimated"
        ? Number(gDisp?.textContent?.split(" ")[0]) || 0
        : 0;

    return {
      monthly,
      yearly: monthly * 12,
      bill,
      electricityKwh,
      gasKwh,
    };
  }

  /* ── Animated counter ── */
  function animateCounter(el, target) {
    if (!el) return;
    let current = 0;
    const steps = 45;
    const inc = target / steps;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      current += inc;
      if (i >= steps) { current = target; clearInterval(timer); }
      el.textContent = `-${Math.round(current)}€`;
    }, 900 / steps);
  }

  /* ── Results ── */
  async function renderResults() {
    const savings = calculateSavings();
    const resultStep = $(".result-step");
    if (!resultStep) return;

    /* Submit simulation data to backend */
    postForm({
      formType: "simulator",
      selectedHouse,
      locationValue,
      surface,
      selectedEnergy,
      selectedPeople,
      selectedProvider,
      bill: savings.bill,
      electricityValueKwh: savings.electricityKwh,
      gasValueKwh: savings.gasKwh,
      monthlySavings: savings.monthly,
      estimationType: consumptionMode
    });

    resultStep.innerHTML = `
      <div class="result-hero">
        <h3>Analisi completata 🎉</h3>
        <p>Ecco il tuo potenziale risparmio energetico stimato</p>
      </div>

      <div class="result-main">
        <div class="result-card main">
          <span class="value" id="monthlyValue">-0€</span>
          <span class="label">al mese</span>
        </div>
        <div class="result-card">
          <span class="value" id="yearlyValue">-0€</span>
          <span class="label">all'anno</span>
        </div>
      </div>

      <div class="result-insights">
        <div class="insight">
          <span>⚡ Riduzione consumi stimata</span>
          <strong>-18%</strong>
        </div>
        <div class="insight">
          <span>🏠 Tipo abitazione</span>
          <strong>${selectedHouse === "house" ? "Casa" : "Appartamento"}</strong>
        </div>
        <div class="insight">
          <span>👤 Persone in casa</span>
          <strong>${selectedPeople}</strong>
        </div>
        <div class="insight">
          <span>💰 Bolletta attuale</span>
          <strong>${savings.bill}€/mese</strong>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn btn-gold btn-full" id="simCtaBtn">
          Parla con un consulente →
        </button>
        <button class="btn btn-ghost--light btn-full" id="restartBtn">
          Rifai simulazione
        </button>
      </div>`;

    /* Animate counters */
    setTimeout(() => {
      animateCounter($("#monthlyValue"), savings.monthly);
      animateCounter($("#yearlyValue"), savings.yearly);
    }, 200);

    /* CTA — scroll to contact and pre-fill */
    $("#simCtaBtn")?.addEventListener("click", () => {
      smoothScrollTo("contact");
      /* Pre-fill energy type */
      setTimeout(() => {
        const sel = $("#energyType");
        if (sel && selectedEnergy) {
          const map = { electricity: "Electricity", gas: "Gas", both: "Both" };
          sel.value = map[selectedEnergy] || "";
          sel.dispatchEvent(new Event("change"));
        }
      }, 600);
    });

    /* Restart */
    $("#restartBtn")?.addEventListener("click", restartSim);
  }

  /* ── Restart ── */
  function restartSim() {
    currentStep = 0;
    selectedEnergy = null;
    selectedHouse = null;
    selectedPeople = null;
    locationValue = "";
    surface = 80;
    consumptionMode = "estimated";
    selectedProvider = null;

    /* Reset cards */
    [...energyCards, ...houseCards, ...peopleCards].forEach((c) => {
      c.classList.remove("active");
      c.setAttribute("aria-checked", "false");
    });

    /* Reset toggles */
    toggleOpts.forEach((o, i) => {
      o.classList.toggle("active", i === 0);
      o.setAttribute("aria-checked", i === 0 ? "true" : "false");
    });

    /* Reset provider */
    $$(".provider-card").forEach((c) => {
      c.classList.remove("active");
      c.setAttribute("aria-checked", "false");

    });
    if (providerSel) providerSel.value = "";
    if (providerInp) { providerInp.value = ""; providerInp.style.display = "none"; }
    selectWrap?.classList.remove("active");

    /* Reset location */
    if (locationInp) locationInp.value = "";

    /* Reset sliders */
    if (surfaceSlider) { surfaceSlider.value = 80; surfaceSlider.dispatchEvent(new Event("input")); }
    if (billSlider) { billSlider.value = 120; billSlider.dispatchEvent(new Event("input")); }

    /* Clear result */
    const resultStep = $(".result-step");
    if (resultStep) resultStep.innerHTML = "";

    if (consumInps) consumInps.innerHTML = "";
    if (helperTxt) {
      helperTxt.textContent = "Non sei sicuro? Scegli la stima — la calcoleremo per te in base alla tua abitazione.";
    }

    /* Show nav */
    if (simNav) simNav.style.display = "flex";

    updateSimulator();
  }

  /* ── Init ── */
  updateSimulator();
}

/* ─────────────────────────────────────────────────────────────
   PROVIDERS — populate simulator grid
───────────────────────────────────────────────────────────── */
async function initProviders() {
  const grid = $("#providerGrid");
  if (!grid) return;

  try {
    const res = await fetch("/api/providers");
    if (!res.ok) return;
    const providers = await res.json();
    if (!providers?.length) return;

    grid.innerHTML = "";

    providers.forEach((p) => {
      const card = document.createElement("div");
      card.className = "sim-card provider-card";
      card.dataset.provider = p.key;
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", "false");
      card.setAttribute("aria-label", p.name.toUpperCase());
      card.tabIndex = 0;

      card.innerHTML = `
        <img src="${p.image}" alt="${p.name}" width="40" height="40" loading="lazy">
        <span>${p.name}</span>`;

      card.addEventListener("click", () => {
        $$(".provider-card").forEach((c) => {
          c.classList.remove("active");
          c.setAttribute("aria-checked", "false");
        });
        card.classList.add("active");
        card.setAttribute("aria-checked", "true");

        /* Update simulator state via providerSelect */
        const sel = $(".provider-select");
        const inp = $(".provider-input");
        if (sel) sel.value = p.name.toUpperCase();
        if (inp) { inp.value = ""; inp.style.display = "none"; }

        /* Dispatch change so simulator state updates */
        sel?.dispatchEvent(new Event("change"));
      });

      /* Keyboard support */
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
      });

      grid.appendChild(card);
    });
  } catch (err) {
    console.warn("Providers load failed:", err);
  }
}

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initReveal();
  initFAQ();
  initReviews();
  initWhatsApp();
  initContactForm();
  initNewsletter();

  /* Async — order matters for UX */
  initPartners();
  initTeam();
  initProviders().then(() => initSimulator());
});