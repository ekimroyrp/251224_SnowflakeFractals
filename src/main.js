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
import GUI from "lil-gui";
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
  autoRotate: true,
  spinSpeed: 6,
  bloomStrength: 0.52,
  environmentIntensity: 1.4,
  normalScale: 0.32,
  tracerDensity: 0.5,
  tracerScale: 1.4,
  tracerTaper: 0.55,
  tracerLength: 2.2,
  tracerOffset: 1.2,
  snowfall: true,
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
  preset: "Classic Hex",
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
camera.position.set(0, 0, 48);

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

function rebuildSnowflake() {
  clearShatter();
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

const tmpMatrix = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();

function clearShatter() {
  if (!shatterState) return;
  shatterState.visuals.forEach((v) => scene.remove(v.mesh));
  shatterState = null;
  if (snowflake) snowflake.visible = true;
}

function triggerShatter() {
  if (!snowflake) return;
  if (shatterState) {
    clearShatter();
    snowflake.visible = true;
    return;
  }
  const instanced = snowflake.children.filter(
    (c) => c.isInstancedMesh && c.count > 0
  );
  if (instanced.length === 0) return;

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

  const totalPieces = instanced.reduce((sum, m) => sum + m.count, 0);
  let remaining = MAX_SHATTER_PIECES;

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
  };
}

function updateShatter(delta) {
  if (!shatterState) return;
  const step = 1 / 60;
  shatterState.accumulator += delta;
  while (shatterState.accumulator >= step) {
    shatterState.world.step(step);
    shatterState.accumulator -= step;
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
      if (shape && shape.halfExtents) {
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

function setupGui() {
  const gui = new GUI({
    container: document.getElementById("ui-root"),
    title: "Snowflake Controls",
    width: 320,
  });

  const controllers = [];

  function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    Object.assign(params, preset);
    uiState.preset = name;
    controllers.forEach((c) => c.updateDisplay());
    rebuildSnowflake();
  }

  const presetFolder = gui.addFolder("Presets");
  const presetCtrl = presetFolder
    .add(uiState, "preset", Object.keys(presets))
    .name("Preset")
    .onChange((value) => applyPreset(value));
  controllers.push(presetCtrl);

  const geo = gui.addFolder("Branches");
  controllers.push(
    geo.add(params, "recursionDepth", 1, 6, 1).name("Depth").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "symmetry", 3, 12, 1).name("Symmetry").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "armLength", 4, 12, 0.1).name("Arm length").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "armThickness", 0.12, 0.6, 0.01).name("Arm thickness").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "branchAngle", 10, 60, 1).name("Branch angle").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "branchDecay", 0.45, 0.85, 0.01).name("Branch decay").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "thicknessDecay", 0.4, 0.9, 0.01).name("Thickness decay").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "branchJitter", 0, 24, 0.5).name("Branch jitter").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "branchProbability", 0.4, 1, 0.01).name("Branch density").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "plateDensity", 0.5, 2.5, 0.05).name("Plate density").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    geo.add(params, "tipScale", 0.25, 0.9, 0.01).name("Tip scale").onFinishChange(rebuildSnowflake)
  );

  const tracersFolder = gui.addFolder("Tracers");
  controllers.push(
    tracersFolder.add(params, "tracerDensity", 0.1, 1.5, 0.05).name("Tracer density").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    tracersFolder.add(params, "tracerScale", 0.6, 10, 0.05).name("Tracer scale").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    tracersFolder.add(params, "tracerTaper", 0.2, 1, 0.02).name("Tracer taper").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    tracersFolder.add(params, "tracerLength", 0.5, 20, 0.05).name("Tracer length").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    tracersFolder.add(params, "tracerOffset", 0, 2, 0.05).name("Tracer offset").onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    tracersFolder.add(params, "tracerFlip").name("Flip taper").onChange(rebuildSnowflake)
  );

  const look = gui.addFolder("Look");
  controllers.push(
    look
      .add(params, "environmentIntensity", 0, 3, 0.05)
      .name("Env intensity")
      .onFinishChange(rebuildSnowflake)
  );
  controllers.push(
    look
      .add(params, "bloomStrength", 0, 1, 0.01)
      .name("Bloom")
      .onChange((v) => {
        bloom.intensity = v;
      })
  );
  controllers.push(
    look
      .add(params, "normalScale", 0.05, 0.8, 0.01)
      .name("Surface noise")
      .onFinishChange(rebuildSnowflake)
  );

  const behavior = gui.addFolder("Behavior");
  controllers.push(behavior.add(params, "autoRotate").name("Auto rotate"));
  controllers.push(
    behavior.add(params, "spinSpeed", -30, 30, 0.1).name("Spin deg/s")
  );
  controllers.push(
    behavior.add(params, "snowfall").name("Snowfall").onChange(() => {
      snowfield.points.visible = params.snowfall;
      snowfieldNear.points.visible = params.snowfall;
    })
  );

  const actions = {
    randomizeBranches: () => {
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
      controllers.forEach((c) => c.updateDisplay());
      rebuildSnowflake();
    },
    randomizeTracers: () => {
      const rand = (min, max) => min + Math.random() * (max - min);
      params.tracerDensity = rand(0.1, 1.5);
      params.tracerScale = rand(0.6, 10);
      params.tracerTaper = rand(0.2, 1);
      params.tracerLength = rand(0.5, 20);
      params.tracerOffset = rand(0, 2);
      controllers.forEach((c) => c.updateDisplay());
      rebuildSnowflake();
    },
    shatter: () => {
      triggerShatter();
    },
    resetCamera: () => {
      camera.position.set(0, 0, 16);
      controls.target.set(0, 0, 0);
      controls.update();
    },
  };

  controllers.push(
    behavior.add(params, "seed", 1, 1_000_000, 1).name("Seed").onFinishChange(rebuildSnowflake)
  );
  controllers.push(behavior.add(actions, "randomizeBranches").name("Randomize branches"));
  controllers.push(behavior.add(actions, "randomizeTracers").name("Randomize tracers"));
  controllers.push(behavior.add(actions, "shatter").name("Shatter"));
  controllers.push(behavior.add(actions, "resetCamera").name("Reset camera"));

  applyPreset(uiState.preset);
}

setupGui();
