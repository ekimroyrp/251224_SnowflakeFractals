import "./style.css";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
} from "postprocessing";
import { buildSnowflake } from "./snowflake.js";

const params = {
  recursionDepth: 3,
  armLength: 7.5,
  armThickness: 0.28,
  branchAngle: 32,
  branchDecay: 0.68,
  thicknessDecay: 0.7,
  branchJitter: 8,
  symmetry: 6,
  seed: 1337,
  autoRotate: true,
  spinSpeed: 6,
  bloomStrength: 0.52,
  environmentIntensity: 1.4,
};

const canvas = document.getElementById("scene-canvas");

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

const scene = new Scene();
scene.background = new Color(0x0b1323);

const camera = new PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 0, 16);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.minDistance = 3;
controls.maxDistance = 50;

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

function rebuildSnowflake() {
  if (snowflake) {
    scene.remove(snowflake);
  }
  snowflake = buildSnowflake(params);
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

function animate() {
  const delta = clock.getDelta();
  controls.update();
  if (params.autoRotate && snowflake) {
    const spin = (params.spinSpeed * Math.PI) / 180;
    snowflake.rotation.z += spin * delta;
  }
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

  const geo = gui.addFolder("Geometry");
  geo.add(params, "recursionDepth", 1, 6, 1)
    .name("Depth")
    .onFinishChange(rebuildSnowflake);
  geo.add(params, "symmetry", 3, 12, 1)
    .name("Symmetry")
    .onFinishChange(rebuildSnowflake);
  geo.add(params, "armLength", 4, 12, 0.1)
    .name("Arm length")
    .onFinishChange(rebuildSnowflake);
  geo.add(params, "armThickness", 0.12, 0.6, 0.01)
    .name("Arm thickness")
    .onFinishChange(rebuildSnowflake);
  geo.add(params, "branchAngle", 10, 60, 1)
    .name("Branch angle")
    .onFinishChange(rebuildSnowflake);
  geo.add(params, "branchDecay", 0.45, 0.85, 0.01)
    .name("Branch decay")
    .onFinishChange(rebuildSnowflake);
  geo.add(params, "thicknessDecay", 0.4, 0.9, 0.01)
    .name("Thickness decay")
    .onFinishChange(rebuildSnowflake);
  geo.add(params, "branchJitter", 0, 24, 0.5)
    .name("Branch jitter")
    .onFinishChange(rebuildSnowflake);

  const look = gui.addFolder("Look");
  look
    .add(params, "environmentIntensity", 0, 3, 0.05)
    .name("Env intensity")
    .onFinishChange(rebuildSnowflake);
  look
    .add(params, "bloomStrength", 0, 1, 0.01)
    .name("Bloom")
    .onChange((v) => {
      bloom.intensity = v;
    });

  const behavior = gui.addFolder("Behavior");
  behavior.add(params, "autoRotate").name("Auto rotate");
  behavior
    .add(params, "spinSpeed", -30, 30, 0.1)
    .name("Spin deg/s");

  const actions = {
    randomizeSeed: () => {
      params.seed = Math.floor(Math.random() * 1_000_000);
      gui.updateDisplay();
      rebuildSnowflake();
    },
  };

  behavior.add(params, "seed", 1, 1_000_000, 1).name("Seed").onFinishChange(rebuildSnowflake);
  behavior.add(actions, "randomizeSeed").name("Randomize seed");
}

setupGui();
