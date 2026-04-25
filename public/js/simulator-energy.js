
const steps = document.querySelectorAll(".simulator-step");
const progressSteps = document.querySelectorAll(".simulator-progress .step");
const progressBar = document.querySelector(".simulator-progress");
const energyCards = document.querySelectorAll('[data-value="electricity"], [data-value="gas"], [data-value="both"]');
const houseCards = document.querySelectorAll('[data-value="house"], [data-value="flat"]');
const locationInput = document.getElementById("locationInput");
const sliderValue = document.getElementById("sliderValue");
const peopleCards = document.querySelectorAll("[data-people]");
const surfaceSlider = document.getElementById("surfaceSlider");
const surfaceValue = document.getElementById("surfaceValue");
const toggleOptions = document.querySelectorAll(".toggle-option");
const consumptionInputs = document.getElementById("consumptionInputs");
const helperText = document.querySelector(".helper-text");
const providerInput = document.querySelector(".provider-input");
const providerSelect = document.querySelector(".provider-select");
const selectWrapper = document.querySelector(".custom-select-wrapper");
const billSlider = document.getElementById("billSlider");



//STEP 1
let selectedEnergy = null;
//STEP 2
let selectedPeople = null;
let surface = 80;
let locationValue = "";
let consumptionMode = "estimate"; // or "know"
//STEP 3
let selectedHouse = null;
// STEP 5
let selectedProvider = null;
providerSelect.value = "";
providerInput.value = "";

let currentStep = 0;
const simulatorNav = document.querySelector('.simulator-nav')
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

function canProceed() {
    if (currentStep === 0) return selectedEnergy !== null;
    if (currentStep === 1) return selectedHouse !== null && locationValue !== "";
    if (currentStep === 2) return selectedPeople !== null && surface !== '0';
    if (currentStep === 3) {
        if (consumptionMode === 'estimate') return true
        switch (selectedEnergy) {
            case "both":
                return Number(electricitySlider.value) !== 0 && Number(gasSlider.value) !== 0;
                break;
            case "electricity":
                return Number(electricitySlider.value) !== 0
                break;
            case "gas":
                return Number(gasSlider.value) !== 0
                break;
        }

    }
    if (currentStep === 4) return selectedProvider !== null && selectedProvider !== 'Altro' && selectedProvider !== "";

    if (currentStep === 5) return billSlider.value > 0;
    if (currentStep === steps.length - 1) {
        showLoadingState();
        //   const result = await calculateSavings();
        renderResults();
    }
    return true;
}

function updateButtons() {
    if (currentStep < steps.length - 1) {
        simulatorNav.style.display = 'flex';
        progressBar.style.display = 'flex';

    }
    nextBtn.disabled = !canProceed();
    nextBtn.style.opacity = nextBtn.disabled ? "0.5" : "1";
    nextBtn.style.cursor = nextBtn.disabled ? "not-allowed" : "pointer";
}

function updateSimulator() {
    steps.forEach((step, index) => {
        step.style.transform = `translateX(-${currentStep * 100}%)`;
        step.style.opacity = index === currentStep ? "1" : "0.3";
        //step.classList.toggle("active", index === currentStep);
    });

    progressSteps.forEach((dot, index) => {
        dot.classList.toggle("active", index <= currentStep);
    });

    prevBtn.style.visibility = currentStep === 0 ? "hidden" : "visible";
    nextBtn.textContent = currentStep === steps.length - 1 ? "Termina" : "Avanti";
    updateButtons();
}
function setupSlider(slider, display, unit, minClamp, maxClamp) {

    function update() {
        const val = parseInt(slider.value);
        display.textContent = `${val} ${unit}`;

        const percent = val / slider.max;
        const isDesktop = window.innerWidth > 600;

        const minOffset = isDesktop ? 0.06 : 0.10;
        const maxOffset = isDesktop ? 0.94 : 0.90;

        slider.style.background = `linear-gradient(
      to right,
      #ff9900 0%,
      #ff5e00 ${percent * 100}%,
      #eee ${percent * 100}%,
      #eee 100%
    )`;

        let leftPercent;
        if (val <= minClamp) leftPercent = minOffset * 100;
        else if (val >= maxClamp) leftPercent = maxOffset * 100;
        else leftPercent = percent * 100;

        display.style.left = `calc(${leftPercent}%)`;
        updateButtons()
    }

    slider.addEventListener("input", update);
    update();
}

// Event Listeners
nextBtn.addEventListener("click", () => {
    if (currentStep < steps.length - 1) {
        currentStep++;
        updateSimulator();
    }
});

prevBtn.addEventListener("click", () => {
    if (currentStep > 0) {
        currentStep--;
        if (currentStep < 3) {
            toggleOptions.forEach(o => o.classList.remove("active"));
            toggleOptions[0].classList.add("active");
            consumptionMode = "estimate";
            renderConsumptionInputs();

        }
        updateSimulator();
    }
});

// Energy
energyCards.forEach(card => {
    card.addEventListener("click", () => {
        energyCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        selectedEnergy = card.dataset.value;
        updateButtons()

    });
});

// House
houseCards.forEach(card => {
    card.addEventListener("click", () => {
        houseCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        selectedHouse = card.dataset.value;
        updateButtons()
    });
});


//Location
locationInput.addEventListener("input", () => {
    locationValue = locationInput.value.trim();
    updateButtons();
});


peopleCards.forEach(card => {
    card.addEventListener("click", () => {
        peopleCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        selectedPeople = card.dataset.people;
        updateButtons();
    });
});

surfaceSlider.addEventListener("input", () => {

    surface = surfaceSlider.value;
    surfaceValue.textContent = `${surface} m²`;
    updateButtons()
});

toggleOptions.forEach(option => {
    option.addEventListener("click", () => {
        toggleOptions.forEach(o => o.classList.remove("active"));
        option.classList.add("active");

        consumptionMode = option.dataset.mode;
        renderConsumptionInputs();
    });
});



// Provider select
providerSelect.addEventListener("change", () => {
    selectedProvider = providerSelect.value;
    providerCards.forEach(c => c.classList.remove("active"));

    if (providerSelect.value === "Altro") {
        providerInput.style.display = "block";
    } else {
        providerInput.style.display = "none";
        providerInput.value = "";
    }

    updateButtons();
});

// drowdown arrow select provider
selectWrapper.addEventListener("click", () => {
    selectWrapper.classList.toggle("active");
});
//Important UX fix (close when clicking elsewhere) Otherwise the arrow stays rotated forever
document.addEventListener("click", (e) => {
    if (!selectWrapper.contains(e.target)) {
        selectWrapper.classList.remove("active");
    }
});

// Provider input
providerInput.addEventListener("input", () => {

    selectedProvider = providerInput.value.trim();

    providerCards.forEach(c => c.classList.remove("active"));
    providerSelect.value = "";

    updateButtons();

});

function renderConsumptionInputs() {
    consumptionInputs.innerHTML = "";

    if (consumptionMode === "estimate") {
        helperText.textContent = "Non sei sicuro? Scegli la stima — la calcoleremo per te in base alla tua abitazione.";
        return;
    } else {
        helperText.textContent = "Inserisci il tuo consumo reale per maggiore precisione.";
    }

    if (selectedEnergy === "electricity") {
        consumptionInputs.innerHTML = `
      <div class="consumption-block">
        <label>⚡ Consumo di elettricità</label>
        <div class="bill-slider-container">
          <input type="range" min="0" max="1000" value="300" class="bill-slider" id="electricitySlider">
          <div class="slider-value" id="electricityValue">300 kWh</div>
        </div>
      </div>
    `;
    }

    if (selectedEnergy === "gas") {
        consumptionInputs.innerHTML = `
      <div class="consumption-block">
        <label>🔥 Consumo di gas</label>
        <div class="bill-slider-container">
          <input type="range" min="0" max="2000" value="800" class="bill-slider" id="gasSlider">
          <div class="slider-value" id="gasValue">800 kWh</div>
        </div>
      </div>
    `;
    }

    if (selectedEnergy === "both") {
        consumptionInputs.innerHTML = `
      <div class="consumption-block">
        <label>⚡ Consumo di elettricità</label>
        <div class="bill-slider-container">
          <input type="range" min="0" max="1000" value="300" class="bill-slider" id="electricitySlider">
          <div class="slider-value" id="electricityValue">300 kWh</div>
        </div>
      </div>

      <div class="consumption-block">
        <label>🔥 Consumo di gas</label>
        <div class="bill-slider-container">
          <input type="range" min="0" max="2000" value="800" class="bill-slider" id="gasSlider">
          <div class="slider-value" id="gasValue">800 kWh</div>
        </div>
      </div>
    `;
    }

    initConsumptionSliders(); // 🔥 always after rendering
}

function initConsumptionSliders() {
    const electricitySlider = document.getElementById("electricitySlider");
    const electricityValue = document.getElementById("electricityValue");

    const gasSlider = document.getElementById("gasSlider");
    const gasValue = document.getElementById("gasValue");

    if (electricitySlider) {
        setupSlider(electricitySlider, electricityValue, "kWh", 50, 900);
    }

    if (gasSlider) {
        setupSlider(gasSlider, gasValue, "kWh", 100, 1800);
    }
}

// Init
updateSimulator();
updateButtons();
setupSlider(billSlider, sliderValue, "€", 30, 470);
setupSlider(surfaceSlider, surfaceValue, "m²", 30, 180);

function showLoadingState() {
    simulatorNav.style.display = 'none';
    progressBar.style.display = 'none';
    const resultStep = document.querySelector(".result-step");

    resultStep.innerHTML = `
    <div class="loading-container">
      <div class="loader"></div>
      <h3>Analisi del tuo profilo...</h3>
      <p>Stiamo calcolando il tuo risparmio energetico</p>
    </div>
  `;
}

async function calculateSavings() {

    // Base consumption factors
    let baseConsumption = 0;

    // Surface influence
    baseConsumption += surface * 2.5;

    // People influence
    const peopleFactor = {
        "1": 1,
        "2": 1.2,
        "3": 1.4,
        "4+": 1.7
    };

    baseConsumption *= (peopleFactor[selectedPeople] || 1);

    // House type adjustment
    if (selectedHouse === "house") baseConsumption *= 1.2;
    if (selectedHouse === "flat") baseConsumption *= 0.9;

    // Energy type adjustment
    let energyMultiplier = 1;
    if (selectedEnergy === "electricity") energyMultiplier = 0.9;
    if (selectedEnergy === "gas") energyMultiplier = 1.1;
    if (selectedEnergy === "both") energyMultiplier = 1.25;

    baseConsumption *= energyMultiplier;

    // Bill influence (very important anchor)
    const bill = Number(billSlider?.value || 100);

    // Estimated savings model (realistic SaaS-style estimation)
    let monthlySavings = (bill * 0.18) + (baseConsumption * 0.03);

    // Clamp values (avoid nonsense results)
    monthlySavings = Math.max(8, Math.min(monthlySavings, 180));

    const yearlySavings = monthlySavings * 12;
    const formType = 'simulator';
    const gasValueKwh = ((selectedEnergy === "both" || selectedEnergy === "gas") && consumptionMode !== 'estimate') ? Number(gasValue?.innerText?.split(" ")[0]) : 0
    const electricityValueKwh = ((selectedEnergy === "both" || selectedEnergy === "electricity") && consumptionMode !== 'estimate') ? Number(electricityValue?.innerText?.split(" ")[0]) : 0

    const simulatorData = {
        selectedHouse,
        locationValue,
        surface,
        selectedEnergy,
        selectedPeople,
        selectedProvider,
        bill,
        gasValueKwh,
        electricityValueKwh,
        monthlySavings,
        formType
    };
    const success = await postForm(simulatorData);

    return {
        monthly: Math.round(monthlySavings),
        yearly: Math.round(yearlySavings),
        success
    };
}
async function renderResults() {

    const result = await calculateSavings();

    const resultStep = document.querySelector(".result-step");

    resultStep.innerHTML = `
    <div class="result-hero">
      <h3>Analisi completata 🎉</h3>
      <p>Ecco il tuo potenziale risparmio energetico</p>
    </div>

    <div class="result-main">

      <div class="result-card main">
        <span class="value" id="monthlyValue">-0€</span>
        <span class="label">al mese</span>
      </div>

      <div class="result-card secondary">
        <span class="value" id="yearlyValue">-0€</span>
        <span class="label">all’anno</span>
      </div>

    </div>

    <div class="result-insights">

      <div class="insight">
        <span>⚡ Riduzione consumo stimata</span>
        <strong>-18%</strong>
      </div>

      <div class="insight">
        <span>🏠 Ottimizzazione casa</span>
        <strong>${selectedHouse === "house" ? "alta" : "media"}</strong>
      </div>

      <div class="insight">
        <span>👤 Profilo energetico</span>
        <strong>${selectedPeople} persone</strong>
      </div>

      <div class="insight">
        <span>💰 Spesa attuale</span>
        <strong>${billSlider.value}€</strong>
      </div>

    </div>

    <div class="result-actions">
      <button class="primary-btn">
        Ricevi la tua offerta personalizzata
      </button>

      <button class="secondary-btn" id="restartBtn">
        Rifai simulazione
      </button>
    </div>
  `;

    // restart logic
    setTimeout(() => {
        const restartBtn = document.getElementById("restartBtn");
        if (restartBtn) {
            restartBtn.addEventListener("click", () => {
                restartSim();
            });
        }
    }, 0);

    // 🔥 animate AFTER render
    setTimeout(() => {
        animateValue("monthlyValue", result.monthly);
        animateValue("yearlyValue", result.yearly);
    }, 200);
}

function restartSim() {
    const providerCards = document.querySelectorAll(".simulator-card.provider-card");
    currentStep = 0;
    //STEP 1
    selectedEnergy = null;

    //STEP 2
    selectedHouse = null;
    locationValue = "";
    locationInput.value = "";


    //STEP 3
    selectedPeople = null;
    surface = 80;

    //STEP 4
    consumptionMode = "estimate";

    // STEP 5
    selectedProvider = null;
    providerSelect.value = "";
    providerInput.value = "";

    //STEP 6 
    billSlider.value = "120"

    //STEP 7
    const resultStep = document.querySelector(".result-step");
    resultStep.innerHTML = '';

    // Reset DOM active states

    // Energy cards
    energyCards.forEach(c => c.classList.remove("active"));

    // House cards
    houseCards.forEach(c => c.classList.remove("active"));

    // People cards
    peopleCards.forEach(c => c.classList.remove("active"));

    // Toggle options
    toggleOptions.forEach(o => o.classList.remove("active"));
    toggleOptions[0].classList.add("active");

    // Provider cards
    providerCards.forEach(c => c.classList.remove("active"));

    // Select dropdown arrow state
    selectWrapper.classList.remove("active");

    // Reset inputs
    providerSelect.value = "";
    providerInput.value = "";
    providerInput.style.display = "none";

    // Reset sliders (important UX fix)
    surfaceSlider.value = 80;
    billSlider.value = 120;

    surfaceSlider.dispatchEvent(new Event("input"));
    billSlider.dispatchEvent(new Event("input"));

    surfaceValue.textContent = "80 m²";
    sliderValue.textContent = "€120";

    // Reset consumption UI
    const electricitySlider = document.getElementById("electricitySlider");
    const gasSlider = document.getElementById("gasSlider");

    const electricityValue = document.getElementById("electricityValue");
    const gasValue = document.getElementById("gasValue");
    if (electricitySlider) {
        electricitySlider.value = 300;
        electricitySlider.dispatchEvent(new Event("input"));
    }

    if (gasSlider) {
        gasSlider.value = 800;
        gasSlider.dispatchEvent(new Event("input"));
    }
    consumptionInputs.innerHTML = "";

    updateSimulator();
}
function animateValue(id, target) {
    const el = document.getElementById(id);
    if (!el) return;

    let current = 0;
    const duration = 900;
    const steps = 40;
    const increment = target / steps;

    let i = 0;

    const interval = setInterval(() => {
        i++;
        current += increment;

        if (i >= steps) {
            current = target;
            clearInterval(interval);
        }

        el.textContent = `-${Math.round(current)}€`;
    }, duration / steps);
}