/**
 * features/simulator/simulator.js
 * Multi-step energy savings simulator.
 *
 * Steps:
 *   0. Energy type (electricity / gas / both)
 *   1. House type + location
 *   2. Household size (people + surface area)
 *   3. Consumption (estimate or known kWh values)
 *   4. Current provider
 *   5. Monthly bill
 *   6. Results (calculated + submitted to backend)
 *
 * Key design decisions:
 *   - All state lives in module-level `let` variables.
 *   - updateSimulator() is the single source of truth for rendering.
 *   - No globals except window.nextTeam/prevTeam for legacy HTML support.
 */

import { $, $$ } from "../../core/dom.js";
import { postForm } from "../../core/api.js";
import { smoothScrollTo } from "../../core/scroll.js";
export function initSimulator() {
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