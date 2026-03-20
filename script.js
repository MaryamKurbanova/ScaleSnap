import * as THREE from "https://unpkg.com/three@0.163.0/build/three.module.js";

const TRIAL_LIMIT = 3;
const TRIAL_STORAGE_KEY = "scalesnap_trial_count";
const WORLD_TARGET_MAX = 3.4;

const anchors = {
  standard_credit_card: {
    name: "Standard Credit Card",
    width: 8.56,
    height: 5.4,
    depth: 0.076,
  },
  standard_soda_can_12oz: {
    name: "Standard Soda Can (12oz)",
    width: 6.6,
    height: 12.2,
    depth: 6.6,
  },
  macbook_air_13: {
    name: "13\" MacBook Air",
    width: 30.41,
    height: 1.13,
    depth: 21.5,
  },
  milk_gallon_us: {
    name: "Milk Gallon (US)",
    width: 16.5,
    height: 30,
    depth: 16.5,
  },
  standard_interior_door: {
    name: "Standard Interior Door",
    width: 91.4,
    height: 203.2,
    depth: 3.5,
  },
};

const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const depthInput = document.getElementById("depthInput");
const anchorSelect = document.getElementById("anchorSelect");

const rotateTarget = document.getElementById("rotateTarget");
const rotateX = document.getElementById("rotateX");
const rotateY = document.getElementById("rotateY");
const rotateZ = document.getElementById("rotateZ");
const rotateXValue = document.getElementById("rotateXValue");
const rotateYValue = document.getElementById("rotateYValue");
const rotateZValue = document.getElementById("rotateZValue");

const renderButton = document.getElementById("renderButton");
const resetButton = document.getElementById("resetButton");
const resetRotationButton = document.getElementById("resetRotationButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const expandStageButton = document.getElementById("expandStageButton");
const collapseStageButton = document.getElementById("collapseStageButton");
const closeModalButton = document.getElementById("closeModalButton");

const stageCanvas = document.getElementById("stageCanvas");
const triesLeftLabel = document.getElementById("triesLeftLabel");
const customMetric = document.getElementById("customMetric");
const anchorMetric = document.getElementById("anchorMetric");
const statusPill = document.getElementById("statusPill");
const paywallModal = document.getElementById("paywallModal");

const rotationState = {
  custom: { x: 0, y: 0, z: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

let scene;
let camera;
let renderer;
let cameraController;
let stageGroup;
let customObject;
let anchorObject;

const materialSet = {
  customSolid: new THREE.MeshPhysicalMaterial({
    color: 0x84a2ff,
    metalness: 0.25,
    roughness: 0.22,
    transmission: 0.28,
    transparent: true,
    opacity: 0.9,
  }),
  customEdge: new THREE.LineBasicMaterial({ color: 0xbad0ff }),
  sodaBody: new THREE.MeshStandardMaterial({ color: 0xd24747, metalness: 0.45, roughness: 0.36 }),
  sodaTop: new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.8, roughness: 0.2 }),
  milkBody: new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.08, roughness: 0.36 }),
  milkCap: new THREE.MeshStandardMaterial({ color: 0x5f9fff, metalness: 0.18, roughness: 0.32 }),
  card: new THREE.MeshStandardMaterial({ color: 0x1b2138, metalness: 0.25, roughness: 0.42 }),
  cardStripe: new THREE.MeshStandardMaterial({ color: 0xd9bb7d, metalness: 0.45, roughness: 0.35 }),
  laptopBody: new THREE.MeshStandardMaterial({ color: 0xb7bfca, metalness: 0.58, roughness: 0.38 }),
  laptopLogo: new THREE.MeshStandardMaterial({ color: 0x202225, metalness: 0.3, roughness: 0.45 }),
  door: new THREE.MeshStandardMaterial({ color: 0xc3ac8d, metalness: 0.12, roughness: 0.78 }),
  doorKnob: new THREE.MeshStandardMaterial({ color: 0xd6c49f, metalness: 0.74, roughness: 0.28 }),
};

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

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function getCurrentCustomDimensions() {
  return {
    width: asNumber(widthInput, 45),
    height: asNumber(heightInput, 30),
    depth: asNumber(depthInput, 20),
  };
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
  });
}

function clearStageObject(reference) {
  if (!reference) {
    return null;
  }
  stageGroup.remove(reference);
  disposeObject(reference);
  return null;
}

function createCustomBoundingBox(dimensions) {
  const group = new THREE.Group();
  const boxGeometry = new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth);
  const solid = new THREE.Mesh(boxGeometry, materialSet.customSolid);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), materialSet.customEdge);
  group.add(solid);
  group.add(edges);
  return group;
}

function createCreditCard(dimensions) {
  const group = new THREE.Group();
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(dimensions.width, dimensions.height, Math.max(dimensions.depth, 0.01)),
    materialSet.card,
  );
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(dimensions.width * 0.7, dimensions.height * 0.16, Math.max(dimensions.depth * 0.2, 0.005)),
    materialSet.cardStripe,
  );
  stripe.position.set(0, dimensions.height * 0.2, dimensions.depth * 0.6);
  group.add(card, stripe);
  return group;
}

function createSodaCan(dimensions) {
  const group = new THREE.Group();
  const radius = dimensions.width / 2;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dimensions.height, 48), materialSet.sodaBody);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, dimensions.height * 0.04, 48),
    materialSet.sodaTop,
  );
  const bottom = top.clone();
  top.position.y = dimensions.height * 0.48;
  bottom.position.y = -dimensions.height * 0.48;

  const pullTab = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.33, radius * 0.08, 16, 36),
    materialSet.sodaTop,
  );
  pullTab.rotation.x = Math.PI / 2;
  pullTab.position.y = dimensions.height * 0.5;

  group.add(body, top, bottom, pullTab);
  return group;
}

function createMacbook(dimensions) {
  const group = new THREE.Group();
  const gap = dimensions.height * 0.08;
  const baseHeight = dimensions.height * 0.46;
  const lidHeight = dimensions.height * 0.46;
  const bottomY = -dimensions.height / 2;

  const base = new THREE.Mesh(new THREE.BoxGeometry(dimensions.width, baseHeight, dimensions.depth), materialSet.laptopBody);
  base.position.y = bottomY + baseHeight / 2;

  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(dimensions.width * 0.99, lidHeight, dimensions.depth * 0.99),
    materialSet.laptopBody,
  );
  lid.position.y = bottomY + baseHeight + gap + lidHeight / 2;
  lid.rotation.z = degToRad(-1.5);

  const logo = new THREE.Mesh(
    new THREE.CylinderGeometry(dimensions.width * 0.045, dimensions.width * 0.045, dimensions.height * 0.06, 20),
    materialSet.laptopLogo,
  );
  logo.rotation.x = Math.PI / 2;
  logo.position.set(0, bottomY + baseHeight + gap + lidHeight * 0.35, dimensions.depth * 0.49);

  group.add(base, lid, logo);
  return group;
}

function createMilkGallon(dimensions) {
  const group = new THREE.Group();
  const bodyHeight = dimensions.height * 0.66;
  const shoulderHeight = dimensions.height * 0.16;
  const neckHeight = dimensions.height * 0.12;
  const capHeight = dimensions.height * 0.06;

  const bodyRadiusTop = dimensions.width * 0.34;
  const bodyRadiusBottom = dimensions.width * 0.38;
  const neckRadius = dimensions.width * 0.15;

  const bottomY = -dimensions.height / 2;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadiusTop, bodyRadiusBottom, bodyHeight, 36),
    materialSet.milkBody,
  );
  body.position.y = bottomY + bodyHeight / 2;

  const shoulder = new THREE.Mesh(
    new THREE.CylinderGeometry(neckRadius * 1.2, bodyRadiusTop, shoulderHeight, 32),
    materialSet.milkBody,
  );
  shoulder.position.y = bottomY + bodyHeight + shoulderHeight / 2;

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(neckRadius, neckRadius, neckHeight, 24),
    materialSet.milkBody,
  );
  neck.position.y = bottomY + bodyHeight + shoulderHeight + neckHeight / 2;

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(neckRadius * 0.9, neckRadius * 0.9, capHeight, 24),
    materialSet.milkCap,
  );
  cap.position.y = bottomY + bodyHeight + shoulderHeight + neckHeight + capHeight / 2;

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(dimensions.width * 0.18, dimensions.width * 0.035, 12, 28, Math.PI * 1.15),
    materialSet.milkBody,
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(dimensions.width * 0.26, bottomY + bodyHeight * 0.1, 0);

  group.add(body, shoulder, neck, cap, handle);
  return group;
}

function createInteriorDoor(dimensions) {
  const group = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth), materialSet.door);
  const knobPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(dimensions.width * 0.04, dimensions.width * 0.04, dimensions.depth * 0.2, 24),
    materialSet.doorKnob,
  );
  knobPlate.rotation.x = Math.PI / 2;
  knobPlate.position.set(dimensions.width * 0.36, -dimensions.height * 0.02, dimensions.depth * 0.55);

  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(dimensions.width * 0.03, 20, 20),
    materialSet.doorKnob,
  );
  knob.position.set(dimensions.width * 0.36, -dimensions.height * 0.02, dimensions.depth * 0.67);

  group.add(slab, knobPlate, knob);
  return group;
}

function createAnchorModel(anchorKey, dimensions) {
  if (anchorKey === "standard_credit_card") {
    return createCreditCard(dimensions);
  }
  if (anchorKey === "standard_soda_can_12oz") {
    return createSodaCan(dimensions);
  }
  if (anchorKey === "macbook_air_13") {
    return createMacbook(dimensions);
  }
  if (anchorKey === "milk_gallon_us") {
    return createMilkGallon(dimensions);
  }
  return createInteriorDoor(dimensions);
}

function applyObjectRotations() {
  if (customObject) {
    customObject.rotation.set(
      degToRad(rotationState.custom.x),
      degToRad(rotationState.custom.y),
      degToRad(rotationState.custom.z),
    );
  }
  if (anchorObject) {
    anchorObject.rotation.set(
      degToRad(rotationState.anchor.x),
      degToRad(rotationState.anchor.y),
      degToRad(rotationState.anchor.z),
    );
  }
}

function setRotationSliderValues(targetKey) {
  const current = rotationState[targetKey];
  rotateX.value = String(current.x);
  rotateY.value = String(current.y);
  rotateZ.value = String(current.z);
  rotateXValue.textContent = `${current.x}°`;
  rotateYValue.textContent = `${current.y}°`;
  rotateZValue.textContent = `${current.z}°`;
}

function renderScene() {
  const custom = getCurrentCustomDimensions();
  const anchor = anchors[anchorSelect.value] ?? anchors.standard_soda_can_12oz;
  const maxDimension = Math.max(
    custom.width,
    custom.height,
    custom.depth,
    anchor.width,
    anchor.height,
    anchor.depth,
  );

  const scale = WORLD_TARGET_MAX / maxDimension;
  const customScaled = {
    width: custom.width * scale,
    height: custom.height * scale,
    depth: custom.depth * scale,
  };
  const anchorScaled = {
    width: anchor.width * scale,
    height: anchor.height * scale,
    depth: anchor.depth * scale,
  };

  customObject = clearStageObject(customObject);
  anchorObject = clearStageObject(anchorObject);

  customObject = createCustomBoundingBox(customScaled);
  anchorObject = createAnchorModel(anchorSelect.value, anchorScaled);

  const gap = Math.max(customScaled.width, anchorScaled.width) * 0.95 + 0.7;
  customObject.position.set(-gap / 2, customScaled.height / 2, 0);
  anchorObject.position.set(gap / 2, anchorScaled.height / 2, 0);

  stageGroup.add(customObject);
  stageGroup.add(anchorObject);
  applyObjectRotations();

  const focusHeight = Math.max(customScaled.height, anchorScaled.height) * 0.48;
  setCameraTarget(0, focusHeight, 0);

  customMetric.textContent = `Bounding box: ${custom.width.toFixed(1)} x ${custom.height.toFixed(1)} x ${custom.depth.toFixed(1)} cm`;
  anchorMetric.textContent = `${anchor.name}: ${anchor.width.toFixed(2)} x ${anchor.height.toFixed(2)} x ${anchor.depth.toFixed(2)} cm`;
}

function resizeRenderer() {
  const width = stageCanvas.clientWidth;
  const height = stageCanvas.clientHeight;
  if (!width || !height) {
    return;
  }
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function zoomCamera(factor) {
  if (!cameraController) {
    return;
  }
  cameraController.distance = clamp(
    cameraController.distance * factor,
    cameraController.minDistance,
    cameraController.maxDistance,
  );
  updateCameraFromController();
}

function setStageExpanded(expanded) {
  document.body.classList.toggle("stage-expanded", expanded);
  collapseStageButton.classList.toggle("hidden-control", !expanded);
  expandStageButton.classList.toggle("hidden-control", expanded);
  resizeRenderer();
  flashStatus(expanded ? "Expanded view" : "Ready");
}

function resetDefaults() {
  widthInput.value = "45";
  heightInput.value = "30";
  depthInput.value = "20";
  anchorSelect.value = "standard_soda_can_12oz";
  rotationState.custom = { x: 0, y: 0, z: 0 };
  rotationState.anchor = { x: 0, y: 0, z: 0 };
  setRotationSliderValues(rotateTarget.value);
  renderScene();
  flashStatus("Reset");
}

function initThreeStage() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08090d, 9, 22);

  camera = new THREE.PerspectiveCamera(46, 1, 0.01, 80);
  camera.position.set(4.6, 3.4, 5.1);

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    stageCanvas.innerHTML =
      "<p style='padding:1rem;color:#ffd796;'>3D stage failed to initialize. Please use a modern browser with WebGL enabled.</p>";
    flashStatus("3D unavailable", "warn");
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  stageCanvas.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xb8c7ff, 1.22);
  keyLight.position.set(5.5, 8, 4.5);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x79ffd5, 0.45);
  rimLight.position.set(-6, 4, -4);
  scene.add(rimLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshStandardMaterial({ color: 0x0b1020, metalness: 0.04, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(18, 36, 0x3d4b74, 0x1a2136);
  grid.position.y = 0.001;
  scene.add(grid);

  stageGroup = new THREE.Group();
  scene.add(stageGroup);

  initCameraController();
  resizeRenderer();
  window.addEventListener("resize", resizeRenderer);
  new ResizeObserver(resizeRenderer).observe(stageCanvas);

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

function updateCameraFromController() {
  if (!cameraController) {
    return;
  }
  cameraController.polar = clamp(
    cameraController.polar,
    cameraController.minPolar,
    cameraController.maxPolar,
  );
  cameraController.distance = clamp(
    cameraController.distance,
    cameraController.minDistance,
    cameraController.maxDistance,
  );

  const spherical = new THREE.Spherical(
    cameraController.distance,
    cameraController.polar,
    cameraController.azimuth,
  );
  const offset = new THREE.Vector3().setFromSpherical(spherical);
  camera.position.copy(cameraController.target.clone().add(offset));
  camera.lookAt(cameraController.target);
}

function setCameraTarget(x, y, z) {
  if (!cameraController) {
    return;
  }
  cameraController.target.set(x, y, z);
  updateCameraFromController();
}

function initCameraController() {
  const target = new THREE.Vector3(0, 1, 0);
  const offset = camera.position.clone().sub(target);
  const spherical = new THREE.Spherical().setFromVector3(offset);

  cameraController = {
    target,
    distance: spherical.radius,
    azimuth: spherical.theta,
    polar: spherical.phi,
    minDistance: 1.4,
    maxDistance: 24,
    minPolar: 0.2,
    maxPolar: Math.PI - 0.2,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
  };

  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";

  canvas.addEventListener("pointerdown", (event) => {
    cameraController.dragging = true;
    cameraController.pointerId = event.pointerId;
    cameraController.lastX = event.clientX;
    cameraController.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!cameraController.dragging || event.pointerId !== cameraController.pointerId) {
      return;
    }
    const deltaX = event.clientX - cameraController.lastX;
    const deltaY = event.clientY - cameraController.lastY;
    cameraController.lastX = event.clientX;
    cameraController.lastY = event.clientY;

    cameraController.azimuth -= deltaX * 0.0075;
    cameraController.polar -= deltaY * 0.0065;
    updateCameraFromController();
  });

  const stopDragging = (event) => {
    if (event.pointerId !== cameraController.pointerId) {
      return;
    }
    cameraController.dragging = false;
    cameraController.pointerId = null;
    canvas.releasePointerCapture(event.pointerId);
  };

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const zoomFactor = event.deltaY > 0 ? 1.08 : 0.92;
      zoomCamera(zoomFactor);
    },
    { passive: false },
  );

  updateCameraFromController();
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
anchorSelect.addEventListener("change", renderScene);

rotateTarget.addEventListener("change", () => {
  setRotationSliderValues(rotateTarget.value);
});

[rotateX, rotateY, rotateZ].forEach((inputElement) => {
  inputElement.addEventListener("input", () => {
    const activeTarget = rotateTarget.value;
    rotationState[activeTarget] = {
      x: Number.parseInt(rotateX.value, 10) || 0,
      y: Number.parseInt(rotateY.value, 10) || 0,
      z: Number.parseInt(rotateZ.value, 10) || 0,
    };
    setRotationSliderValues(activeTarget);
    applyObjectRotations();
  });
});

resetRotationButton.addEventListener("click", () => {
  rotationState.custom = { x: 0, y: 0, z: 0 };
  rotationState.anchor = { x: 0, y: 0, z: 0 };
  setRotationSliderValues(rotateTarget.value);
  applyObjectRotations();
  flashStatus("Rotation reset");
});

zoomInButton.addEventListener("click", () => zoomCamera(0.85));
zoomOutButton.addEventListener("click", () => zoomCamera(1.15));

expandStageButton.addEventListener("click", () => setStageExpanded(true));
collapseStageButton.addEventListener("click", () => setStageExpanded(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("stage-expanded")) {
    setStageExpanded(false);
  }
});

resetButton.addEventListener("click", resetDefaults);
closeModalButton.addEventListener("click", closePaywall);
paywallModal.addEventListener("click", (event) => {
  if (event.target === paywallModal) {
    closePaywall();
  }
});

initThreeStage();
updateTrialUI();
setRotationSliderValues("custom");
if (renderer) {
  renderScene();
}
