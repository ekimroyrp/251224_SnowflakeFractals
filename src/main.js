import "./style.css";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  DataTexture,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  Points,
  PointsMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  Quaternion,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
} from "postprocessing";
import { Body, Box as CBox, Vec3, World, SAPBroadphase } from "cannon-es";
import { buildSnowflake } from "./snowflake.js";

const params = {
  recursionDepth: 5,
  armLength: 10.1,
  armThickness: 0.57,
  branchAngle: 53,
  branchDecay: 0.78,
  thicknessDecay: 0.64,
  branchJitter: 10.5,
  branchProbability: 0.7,
  plateDensity: 1.85,
  tipScale: 0.29,
  symmetry: 6,
  seed: 195323,
  autoRotate: true,
  spinSpeed: 8,
  bloomStrength: 0.65,
  environmentIntensity: 1.65,
  normalScale: 0.42,
  tracerDensity: 0.35,
  tracerScale: 3.05,
  tracerTaper: 0.24,
  tracerLength: 7.7,
  tracerOffset: 0.15,
  snowfall: true,
  shatter: false,
  tracerFlip: false,
};

const presets = {
  "Classic Hex": {
    recursionDepth: 4,
    armLength: 8,
    armThickness: 0.26,
    branchAngle: 32,
    branchDecay: 0.68,
    thicknessDecay: 0.7,
    branchJitter: 8,
    branchProbability: 0.82,
    plateDensity: 1.6,
    tipScale: 0.45,
    symmetry: 6,
    seed: 1337,
    spinSpeed: 6,
    bloomStrength: 0.52,
    environmentIntensity: 1.4,
    normalScale: 0.32,
    tracerDensity: 0.5,
    tracerScale: 1.4,
    tracerTaper: 0.55,
    tracerLength: 2.2,
    tracerOffset: 1.2,
  },
  "Needle Star": {
    recursionDepth: 2,
    armLength: 11,
    armThickness: 0.18,
    branchAngle: 18,
    branchDecay: 0.55,
    thicknessDecay: 0.6,
    branchJitter: 4,
    branchProbability: 0.45,
    plateDensity: 0.85,
    tipScale: 0.88,
    symmetry: 6,
    seed: 7421,
    spinSpeed: 3,
    bloomStrength: 0.35,
    environmentIntensity: 1.75,
    normalScale: 0.18,
    tracerDensity: 0.35,
    tracerScale: 1.3,
    tracerTaper: 0.5,
    tracerLength: 2.6,
    tracerOffset: 1.1,
  },
  "Chaotic Crystal": {
    recursionDepth: 5,
    armLength: 7,
    armThickness: 0.32,
    branchAngle: 42,
    branchDecay: 0.78,
    thicknessDecay: 0.72,
    branchJitter: 16,
    branchProbability: 0.95,
    plateDensity: 2.3,
    tipScale: 0.35,
    symmetry: 6,
    seed: 195323,
    spinSpeed: 8,
    bloomStrength: 0.65,
    environmentIntensity: 1.65,
    normalScale: 0.42,
    tracerDensity: 0.8,
    tracerScale: 1.55,
    tracerTaper: 0.48,
    tracerLength: 1.9,
    tracerOffset: 1.35,
  },
};

const uiState = {
  preset: "Chaotic Crystal",
};

function createNormalNoiseTexture(size = 128, amplitude = 14) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const nx = 128 + (Math.random() * 2 - 1) * amplitude;
    const ny = 128 + (Math.random() * 2 - 1) * amplitude;
    const idx = i * 4;
    data[idx] = Math.max(0, Math.min(255, nx));
    data[idx + 1] = Math.max(0, Math.min(255, ny));
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const resources = {
  normalMap: createNormalNoiseTexture(),
};

const canvas = document.getElementById("scene-canvas");

function createSnowfield(options = {}) {
  const {
    count = 1600,
    area = 90,
    size = 0.04,
    opacity = 0.35,
    velocityMin = 0.8,
    velocityMax = 2.2,
    sway = 0.05,
    renderOrder = -5,
  } = options;

  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    positions[ix] = (Math.random() - 0.5) * area;
    positions[ix + 1] = (Math.random() - 0.5) * area;
    positions[ix + 2] = (Math.random() - 0.5) * area;
    velocities[i] = velocityMin + Math.random() * (velocityMax - velocityMin);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: 0xd6e8ff,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  points.renderOrder = renderOrder;
  return { points, positions, velocities, geometry, count, area, sway };
}

function updateSnowfield(field, delta, elapsed) {
  const { positions, velocities, count, area, sway } = field;
  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    const drift = Math.sin(elapsed * 0.5 + i * 0.37) * sway;
    positions[ix] += drift * delta;
    positions[ix + 1] -= velocities[i] * delta;
    if (positions[ix + 1] < -area * 0.5) {
      positions[ix + 1] = area * 0.5;
      positions[ix] = (Math.random() - 0.5) * area;
      positions[ix + 2] = (Math.random() - 0.5) * area;
    }
    if (positions[ix] < -area * 0.5) positions[ix] = area * 0.5;
    if (positions[ix] > area * 0.5) positions[ix] = -area * 0.5;
  }
  field.geometry.attributes.position.needsUpdate = true;
}

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
if ("outputColorSpace" in renderer) {
  renderer.outputColorSpace = SRGBColorSpace;
}

const pmrem = new PMREMGenerator(renderer);
const envTexture = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const scene = new Scene();
scene.environment = envTexture;
scene.background = new Color(0x0b1323);
pmrem.dispose();

const snowfield = createSnowfield();
const snowfieldNear = createSnowfield({
  count: 120,
  area: 40,
  size: 0.14,
  opacity: 0.5,
  velocityMin: 1.2,
  velocityMax: 2.8,
  sway: 0.08,
  renderOrder: -4,
});
scene.add(snowfield.points);
scene.add(snowfieldNear.points);

const camera = new PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 0, 80);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.minDistance = 3;
controls.maxDistance = 100;

scene.add(new AmbientLight(0x7eb6ff, 0.35));

const keyLight = new DirectionalLight(0xcfe3ff, 1.1);
keyLight.position.set(4, 5, 6);
scene.add(keyLight);

const fillLight = new DirectionalLight(0x92c1ff, 0.65);
fillLight.position.set(-4, -3, -6);
scene.add(fillLight);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloom = new BloomEffect({
  intensity: params.bloomStrength,
  luminanceThreshold: 0.72,
  luminanceSmoothing: 0.18,
  mipmapBlur: true,
});
const fxaa = new FXAAEffect();
fxaa.setSize(window.innerWidth, window.innerHeight);
const effectPass = new EffectPass(camera, bloom, fxaa);
composer.addPass(renderPass);
composer.addPass(effectPass);

let snowflake;
let shatterState = null;
let updateShatterToggle = null;

function rebuildSnowflake() {
  clearShatter(true);
  const prevRotation = snowflake ? snowflake.rotation.clone() : null;
  if (snowflake) {
    scene.remove(snowflake);
  }
  snowflake = buildSnowflake(params, resources);
  if (prevRotation) {
    snowflake.rotation.copy(prevRotation);
  }
  scene.add(snowflake);
}

rebuildSnowflake();

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  fxaa.setSize(w, h);
}

window.addEventListener("resize", handleResize);

const clock = new Clock();
const MAX_SHATTER_PIECES = 450;
const SHATTER_MAX_TIME = 20;

const tmpMatrix = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();

function clearShatter(resetToggle = false) {
  if (shatterState) {
    shatterState.visuals.forEach((v) => scene.remove(v.mesh));
    shatterState = null;
  }
  if (snowflake) snowflake.visible = true;
  if (resetToggle && params.shatter) {
    params.shatter = false;
    if (typeof updateShatterToggle === "function") updateShatterToggle();
  }
}

function triggerShatter() {
  if (!snowflake) return;
  if (shatterState) {
    clearShatter();
    snowflake.visible = true;
    return;
  }
  const instanced = snowflake.children.filter(
    (c) =>
      c.isInstancedMesh &&
      c.count > 0 &&
      (c.userData.part === "segments" || c.userData.part === "tracers")
  );
  const hubMesh = snowflake.getObjectByName("hub");
  if (instanced.length === 0 && !hubMesh) return;

  const world = new World();
  world.gravity.set(0, -9.8, 0);
   world.allowSleep = true;
  world.broadphase = new SAPBroadphase(world);
  world.solver.iterations = 7;
  world.solver.tolerance = 0.001;
  world.defaultContactMaterial.friction = 0.15;
  world.defaultContactMaterial.restitution = 0.05;

  const ground = new Body({
    mass: 0,
    shape: new CBox(new Vec3(100, 1, 100)),
    position: new Vec3(0, -12, 0),
  });
  world.addBody(ground);

  const visuals = [];
  const bodies = [];

  let remaining = MAX_SHATTER_PIECES;

  if (hubMesh) {
    hubMesh.updateWorldMatrix(true, true);
    hubMesh.matrixWorld.decompose(tmpPos, tmpQuat, tmpScale);
    const geom = hubMesh.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bbox = geom.boundingBox;
    const sizeX = (bbox.max.x - bbox.min.x) * tmpScale.x;
    const sizeY = (bbox.max.y - bbox.min.y) * tmpScale.y;
    const sizeZ = (bbox.max.z - bbox.min.z) * tmpScale.z;
    const half = new Vec3(sizeX * 0.5, sizeY * 0.5, sizeZ * 0.5);
    const body = new Body({
      mass: Math.max(0.05, sizeX * sizeY * sizeZ * 0.03),
    });
    body.addShape(new CBox(half));
    body.position.set(tmpPos.x, tmpPos.y, tmpPos.z);
    body.quaternion.set(tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w);
    body.linearDamping = 0.01;
    body.angularDamping = 0.01;
    body.sleepSpeedLimit = 0.2;
    body.sleepTimeLimit = 0.6;
    world.addBody(body);
    bodies.push(body);

    const hubClone = new InstancedMesh(hubMesh.geometry, hubMesh.material, 1);
    hubClone.setMatrixAt(0, hubMesh.matrixWorld);
    hubClone.instanceMatrix.needsUpdate = true;
    scene.add(hubClone);
    visuals.push({ mesh: hubClone, count: 1, baseScale: tmpScale.clone(), isHub: true });
    remaining = Math.max(0, remaining - 1);
  }

  const totalPieces = instanced.reduce((sum, m) => sum + m.count, 0);

  instanced.forEach((mesh, idx) => {
    if (remaining <= 0) return;
    const share = Math.max(
      1,
      Math.floor((mesh.count / totalPieces) * MAX_SHATTER_PIECES)
    );
    let desired = Math.min(mesh.count, share, remaining);
    const isLast = idx === instanced.length - 1;
    if (isLast) desired = Math.min(mesh.count, remaining);
    if (desired <= 0) return;

    const indices = Array.from({ length: mesh.count }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const chosen = indices.slice(0, desired);
    const clone = new InstancedMesh(mesh.geometry, mesh.material, chosen.length);
    clone.instanceMatrix.setUsage(mesh.instanceMatrix.usage);
    scene.add(clone);
    for (let i = 0; i < chosen.length; i++) {
      mesh.getMatrixAt(chosen[i], tmpMatrix);
      tmpMatrix.decompose(tmpPos, tmpQuat, tmpScale);
      const half = new Vec3(tmpScale.x * 0.5, tmpScale.y * 0.5, tmpScale.z * 0.5);
      const shape = new CBox(half);
      const mass = Math.max(0.05, tmpScale.x * tmpScale.y * tmpScale.z * 0.03);
      const body = new Body({ mass });
      body.addShape(shape);
      body.position.set(tmpPos.x, tmpPos.y, tmpPos.z);
      body.quaternion.set(tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w);
      body.linearDamping = 0.01;
      body.angularDamping = 0.01;
      body.sleepSpeedLimit = 0.2;
      body.sleepTimeLimit = 0.6;
      world.addBody(body);
      bodies.push(body);
      clone.setMatrixAt(i, tmpMatrix);
    }
    clone.instanceMatrix.needsUpdate = true;
    visuals.push({ mesh: clone, count: chosen.length });
    remaining -= chosen.length;
  });

  snowflake.visible = false;
  shatterState = {
    world,
    visuals,
    bodies,
    accumulator: 0,
    elapsed: 0,
    stopped: false,
  };
}

function updateShatter(delta) {
  if (!shatterState) return;
  if (!shatterState.stopped) {
    shatterState.elapsed += delta;
    if (shatterState.elapsed >= SHATTER_MAX_TIME) {
      shatterState.stopped = true;
    } else {
      const step = 1 / 60;
      shatterState.accumulator += delta;
      while (shatterState.accumulator >= step) {
        shatterState.world.step(step);
        shatterState.accumulator -= step;
      }
    }
  }
  let idx = 0;
  for (const v of shatterState.visuals) {
    for (let i = 0; i < v.count; i++) {
      const body = shatterState.bodies[idx++];
      const shape = body.shapes[0];
      tmpPos.set(body.position.x, body.position.y, body.position.z);
      tmpQuat.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      );
      if (v.isHub && v.baseScale) {
        tmpScale.copy(v.baseScale);
      } else if (shape && shape.halfExtents) {
        tmpScale.set(
          shape.halfExtents.x * 2,
          shape.halfExtents.y * 2,
          shape.halfExtents.z * 2
        );
      } else {
        tmpScale.set(1, 1, 1);
      }
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      v.mesh.setMatrixAt(i, tmpMatrix);
    }
    v.mesh.instanceMatrix.needsUpdate = true;
  }
}

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  controls.update();
  if (params.autoRotate && snowflake) {
    const spin = (params.spinSpeed * Math.PI) / 180;
    snowflake.rotation.z += spin * delta;
  }
  updateSnowfield(snowfield, delta, elapsed);
  updateSnowfield(snowfieldNear, delta, elapsed);
  updateShatter(delta);
  composer.render(delta);
  requestAnimationFrame(animate);
}

animate();

function initUI() {
  const root = document.getElementById("ui-root");
  root.innerHTML = `
    <div id="ui-panel">
      <div id="ui-handle"></div>
      <div class="ui-body">
        <div class="section">
          <div class="section-title">Branches</div>
          <div id="branches-controls" class="section-content"></div>
        </div>
        <div class="section">
          <div class="section-title">Spikes</div>
          <div id="tracers-controls" class="section-content"></div>
        </div>
        <div class="section">
          <div class="section-title">Visualization</div>
          <div id="look-controls" class="section-content"></div>
        </div>
      </div>
      <div id="ui-handle-bottom"></div>
    </div>
  `;

  const panel = document.getElementById("ui-panel");
  const handles = [
    document.getElementById("ui-handle"),
    document.getElementById("ui-handle-bottom"),
  ].filter(Boolean);
  if (panel && handles.length) {
    panel.style.position = "fixed";
    const rectInit = panel.getBoundingClientRect();
    panel.style.left = `${rectInit.left}px`;
    panel.style.top = `${rectInit.top}px`;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const left = startLeft + dx;
      const top = startTop + dy;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = "auto";
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      handles.forEach((h) => {
        h.style.cursor = "grab";
      });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    handles.forEach((h) => {
      h.addEventListener("mousedown", (e) => {
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseFloat(panel.style.left) || 0;
        startTop = parseFloat(panel.style.top) || 0;
        handles.forEach((hn) => {
          hn.style.cursor = "grabbing";
        });
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        e.preventDefault();
        e.stopPropagation();
      });
      h.style.cursor = "grab";
    });
    window.addEventListener("resize", () => {
      panel.style.right = "auto";
    });
  }

  const setRangeFill = (input) => {
    const min = Number(input.min);
    const max = Number(input.max);
    const val = Number(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty("--range-progress", `${pct}%`);
  };

  const makeSlider = (container, id, label, key, min, max, step, onChange, format = (v) => v.toFixed(step % 1 === 0 ? 0 : 2)) => {
    const wrapper = document.createElement("div");
    wrapper.className = "control";
    wrapper.innerHTML = `
      <div class="control-row">
        <label for="${id}">${label}</label>
        <span class="value" id="${id}-value"></span>
      </div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${params[key]}">
    `;
    container.appendChild(wrapper);
    const input = wrapper.querySelector("input");
    const valueEl = wrapper.querySelector(".value");
    const update = () => {
      valueEl.textContent = format(Number(params[key]));
      input.value = params[key];
      setRangeFill(input);
    };
    input.addEventListener("input", () => {
      params[key] = parseFloat(input.value);
      valueEl.textContent = format(params[key]);
      setRangeFill(input);
      onChange();
    });
    update();
    return update;
  };

  const makeToggle = (container, id, label, key, onChange) => {
    const wrapper = document.createElement("div");
    wrapper.className = "control-row toggle-row";
    wrapper.innerHTML = `
      <label for="${id}">${label}</label>
      <label class="switch">
        <input type="checkbox" id="${id}">
        <span class="slider"></span>
      </label>
    `;
    container.appendChild(wrapper);
    const input = wrapper.querySelector("input");
    const update = () => {
      input.checked = !!params[key];
    };
    input.addEventListener("change", () => {
      params[key] = input.checked;
      onChange();
    });
    update();
    return update;
  };

  const branchesContainer = document.getElementById("branches-controls");
  const tracersContainer = document.getElementById("tracers-controls");
  const lookContainer = document.getElementById("look-controls");

  const updaters = [];

  updaters.push(
    makeSlider(branchesContainer, "recursionDepth", "Depth", "recursionDepth", 1, 6, 1, rebuildSnowflake, (v) => v.toFixed(0))
  );
  updaters.push(
    makeSlider(branchesContainer, "symmetry", "Symmetry", "symmetry", 3, 12, 1, rebuildSnowflake, (v) => v.toFixed(0))
  );
  updaters.push(
    makeSlider(branchesContainer, "armLength", "Length", "armLength", 4, 12, 0.1, rebuildSnowflake, (v) => v.toFixed(1))
  );
  updaters.push(
    makeSlider(branchesContainer, "armThickness", "Thickness", "armThickness", 0.12, 0.6, 0.01, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(branchesContainer, "branchAngle", "Angle", "branchAngle", 10, 60, 1, rebuildSnowflake, (v) => v.toFixed(0))
  );
  updaters.push(
    makeSlider(branchesContainer, "branchDecay", "Decay", "branchDecay", 0.45, 0.85, 0.01, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(branchesContainer, "thicknessDecay", "Falloff", "thicknessDecay", 0.4, 0.9, 0.01, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(branchesContainer, "branchJitter", "Jitter", "branchJitter", 0, 24, 0.5, rebuildSnowflake, (v) => v.toFixed(1))
  );
  updaters.push(
    makeSlider(branchesContainer, "branchProbability", "Density", "branchProbability", 0.4, 1, 0.01, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(branchesContainer, "plateDensity", "Plate", "plateDensity", 0.5, 2.5, 0.05, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(branchesContainer, "tipScale", "Tip", "tipScale", 0.25, 0.9, 0.01, rebuildSnowflake, (v) => v.toFixed(2))
  );

  const branchesButtons = document.createElement("div");
  branchesButtons.className = "button-stack";
  branchesButtons.innerHTML = `
    <button id="btn-rand-branches" class="pill-button full">Randomize Branches</button>
  `;
  branchesContainer.appendChild(branchesButtons);

  updaters.push(
    makeSlider(tracersContainer, "tracerDensity", "Density", "tracerDensity", 0.1, 1.5, 0.05, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(tracersContainer, "tracerScale", "Scale", "tracerScale", 0.6, 10, 0.05, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(tracersContainer, "tracerLength", "Length", "tracerLength", 0.5, 20, 0.05, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(tracersContainer, "tracerOffset", "Offset", "tracerOffset", 0, 2, 0.05, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(tracersContainer, "tracerTaper", "Taper", "tracerTaper", 0.2, 1, 0.02, rebuildSnowflake, (v) => v.toFixed(2))
  );
  updaters.push(
    makeToggle(tracersContainer, "tracerFlip", "Flip Taper", "tracerFlip", rebuildSnowflake)
  );

  const tracersButtons = document.createElement("div");
  tracersButtons.className = "button-stack spikes-buttons";
  tracersButtons.innerHTML = `
    <button id="btn-rand-tracers" class="pill-button full">Randomize Spikes</button>
  `;
  tracersContainer.appendChild(tracersButtons);

  updaters.push(
    makeSlider(lookContainer, "bloomStrength", "Bloom", "bloomStrength", 0, 1, 0.01, () => {
      bloom.intensity = params.bloomStrength;
    }, (v) => v.toFixed(2))
  );
  updaters.push(
    makeSlider(lookContainer, "normalScale", "Noise", "normalScale", 0.05, 0.8, 0.01, rebuildSnowflake, (v) => v.toFixed(2))
  );

  updaters.push(
    makeSlider(lookContainer, "spinSpeed", "Spin", "spinSpeed", -30, 30, 0.1, () => {}, (v) => v.toFixed(1))
  );
  updaters.push(
    makeToggle(lookContainer, "snowfall", "Snowfall", "snowfall", () => {
      snowfield.points.visible = params.snowfall;
      snowfieldNear.points.visible = params.snowfall;
    })
  );
  const shatterToggle = makeToggle(lookContainer, "shatterToggle", "Shatter", "shatter", () => {
    if (params.shatter) {
      triggerShatter();
      if (!shatterState) {
        params.shatter = false;
        if (typeof updateShatterToggle === "function") updateShatterToggle();
      }
    } else {
      clearShatter();
    }
  });
  updateShatterToggle = shatterToggle;
  updaters.push(shatterToggle);

  const randBranches = () => {
    const rand = (min, max) => min + Math.random() * (max - min);
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    params.seed = randInt(1, 1_000_000);
    params.recursionDepth = randInt(1, 6);
    params.symmetry = randInt(3, 12);
    params.armLength = rand(4, 12);
    params.armThickness = rand(0.12, 0.6);
    params.branchAngle = rand(10, 60);
    params.branchDecay = rand(0.45, 0.85);
    params.thicknessDecay = rand(0.4, 0.9);
    params.branchJitter = rand(0, 24);
    params.branchProbability = rand(0.4, 1);
    params.plateDensity = rand(0.5, 2.5);
    params.tipScale = rand(0.25, 0.9);
    rebuildSnowflake();
    updaters.forEach((u) => u());
  };

  const randTracers = () => {
    const rand = (min, max) => min + Math.random() * (max - min);
    params.tracerDensity = rand(0.1, 1.5);
    params.tracerScale = rand(0.6, 10);
    params.tracerTaper = rand(0.2, 1);
    params.tracerLength = rand(0.5, 20);
    params.tracerOffset = rand(0, 2);
    rebuildSnowflake();
    updaters.forEach((u) => u());
  };

  document.getElementById("btn-rand-branches").addEventListener("click", randBranches);
  document.getElementById("btn-rand-tracers").addEventListener("click", randTracers);

  document.querySelectorAll(".section-title").forEach((titleEl) => {
    const section = titleEl.closest(".section");
    const content = section.querySelector(".section-content") || titleEl.nextElementSibling;
    if (!content) return;
    section.classList.remove("collapsed");
    content.style.display = "block";
    titleEl.addEventListener("click", () => {
      const collapsed = section.classList.toggle("collapsed");
      content.style.display = collapsed ? "none" : "block";
    });
  });

  updaters.forEach((u) => u());
}

initUI();
