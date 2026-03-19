const TRIAL_LIMIT = 3;
const TRIAL_STORAGE_KEY = "scalesnap_trial_count";

const anchors = {
  credit_card: {
    name: "Credit card",
    width: 8.56,
    height: 5.4,
    depth: 0.08,
  },
  soda_can: {
    name: "Soda can",
    width: 6.6,
    height: 12.2,
    depth: 6.6,
  },
  gallon_jug: {
    name: "Gallon jug",
    width: 16,
    height: 30,
    depth: 16,
  },
  doorway: {
    name: "Standard doorway",
    width: 91,
    height: 203,
    depth: 12,
  },
};

const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const depthInput = document.getElementById("depthInput");
const anchorSelect = document.getElementById("anchorSelect");

const renderButton = document.getElementById("renderButton");
const resetButton = document.getElementById("resetButton");
const closeModalButton = document.getElementById("closeModalButton");

const triesLeftLabel = document.getElementById("triesLeftLabel");
const customMetric = document.getElementById("customMetric");
const anchorMetric = document.getElementById("anchorMetric");
const anchorCaption = document.getElementById("anchorCaption");
const statusPill = document.getElementById("statusPill");

const customBox = document.getElementById("customBox");
const anchorBox = document.getElementById("anchorBox");
const paywallModal = document.getElementById("paywallModal");

function getTrialCount() {
  const raw = localStorage.getItem(TRIAL_STORAGE_KEY);
  const parsed = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function setTrialCount(count) {
  localStorage.setItem(TRIAL_STORAGE_KEY, String(count));
}

function updateTrialUI() {
  const used = getTrialCount();
  const left = Math.max(0, TRIAL_LIMIT - used);
  triesLeftLabel.textContent = `${left} free ${left === 1 ? "try" : "tries"} left`;
}

function asNumber(inputElement, fallback) {
  const value = Number.parseFloat(inputElement.value);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function clampMinPx(value) {
  return Math.max(10, value);
}

function setBoxDimensions(element, dimensionsPx) {
  element.style.setProperty("--w", `${clampMinPx(dimensionsPx.width)}px`);
  element.style.setProperty("--h", `${clampMinPx(dimensionsPx.height)}px`);
  element.style.setProperty("--d", `${clampMinPx(dimensionsPx.depth)}px`);
}

function renderScene() {
  const custom = {
    width: asNumber(widthInput, 45),
    height: asNumber(heightInput, 30),
    depth: asNumber(depthInput, 20),
  };
  const anchor = anchors[anchorSelect.value] ?? anchors.soda_can;

  const maxDimension = Math.max(
    custom.width,
    custom.height,
    custom.depth,
    anchor.width,
    anchor.height,
    anchor.depth,
  );

  const targetMaxPx = 150;
  const scale = targetMaxPx / maxDimension;

  setBoxDimensions(customBox, {
    width: custom.width * scale,
    height: custom.height * scale,
    depth: custom.depth * scale,
  });

  setBoxDimensions(anchorBox, {
    width: anchor.width * scale,
    height: anchor.height * scale,
    depth: anchor.depth * scale,
  });

  customMetric.textContent = `Your item: ${custom.width.toFixed(1)} x ${custom.height.toFixed(1)} x ${custom.depth.toFixed(1)} cm`;
  anchorMetric.textContent = `${anchor.name}: ${anchor.width.toFixed(1)} x ${anchor.height.toFixed(1)} x ${anchor.depth.toFixed(1)} cm`;
  anchorCaption.textContent = anchor.name;
}

function flashStatus(message, variant = "ok") {
  statusPill.textContent = message;
  if (variant === "warn") {
    statusPill.style.borderColor = "#ffcb8052";
    statusPill.style.color = "#ffd796";
    statusPill.style.background = "#3a2a0f66";
    return;
  }
  statusPill.style.borderColor = "#89e6b855";
  statusPill.style.color = "#8be4b0";
  statusPill.style.background = "#12312466";
}

function openPaywall() {
  paywallModal.classList.remove("hidden");
  flashStatus("Upgrade required", "warn");
}

function closePaywall() {
  paywallModal.classList.add("hidden");
  flashStatus("Ready");
}

function resetDefaults() {
  widthInput.value = "45";
  heightInput.value = "30";
  depthInput.value = "20";
  anchorSelect.value = "soda_can";
  renderScene();
  flashStatus("Reset");
}

renderButton.addEventListener("click", () => {
  const used = getTrialCount();
  if (used >= TRIAL_LIMIT) {
    openPaywall();
    return;
  }

  setTrialCount(used + 1);
  updateTrialUI();
  renderScene();

  const triesLeft = Math.max(0, TRIAL_LIMIT - (used + 1));
  flashStatus(triesLeft > 0 ? `Rendered (${triesLeft} left)` : "Trial complete", triesLeft > 0 ? "ok" : "warn");
  if (triesLeft === 0) {
    openPaywall();
  }
});

[widthInput, heightInput, depthInput, anchorSelect].forEach((element) => {
  element.addEventListener("input", renderScene);
});

resetButton.addEventListener("click", resetDefaults);
closeModalButton.addEventListener("click", closePaywall);
paywallModal.addEventListener("click", (event) => {
  if (event.target === paywallModal) {
    closePaywall();
  }
});

updateTrialUI();
renderScene();
