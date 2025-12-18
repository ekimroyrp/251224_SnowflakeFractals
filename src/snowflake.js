import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
  InstancedMesh,
} from "three";

function mulberry32(seed) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createIceMaterial(params, resources) {
  return new MeshPhysicalMaterial({
    color: new Color(0xcfe9ff),
    transmission: 1,
    roughness: 0.1,
    metalness: 0,
    ior: 1.31,
    thickness: 1.6,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    attenuationDistance: 3.2,
    attenuationColor: new Color(0x9bd6ff),
    envMapIntensity: params.environmentIntensity ?? 1.25,
    normalMap: resources?.normalMap || null,
    normalScale: new Vector2(params.normalScale, params.normalScale),
    side: DoubleSide,
    transparent: true,
  });
}

const scratchPos = new Vector3();
const scratchScale = new Vector3();
const scratchQuat = new Quaternion();
const scratchLocal = new Matrix4();
const scratchWorld = new Matrix4();
const yAxis = new Vector3(0, 1, 0);

function pushBoxInstance(target, parentMatrix, posX, posY, posZ, scaleX, scaleY, scaleZ, rotZ = 0) {
  scratchPos.set(posX, posY, posZ);
  scratchQuat.setFromAxisAngle(new Vector3(0, 0, 1), rotZ);
  scratchScale.set(scaleX, scaleY, scaleZ);
  scratchLocal.compose(scratchPos, scratchQuat, scratchScale);
  scratchWorld.multiplyMatrices(parentMatrix, scratchLocal);
  target.push(scratchWorld.clone());
}

function pushTracerInstance(target, parentMatrix, posX, posY, posZ, length, radius) {
  scratchPos.set(posX, posY, posZ);
  scratchQuat.identity();
  scratchScale.set(length, radius, radius);
  scratchLocal.compose(scratchPos, scratchQuat, scratchScale);
  scratchWorld.multiplyMatrices(parentMatrix, scratchLocal);
  target.push(scratchWorld.clone());
}

function addSidePlates(mats, parent, length, thickness, rng, params) {
  const plateCount = Math.max(1, Math.round(length * params.plateDensity));
  const sizeBase = thickness * 0.75;
  for (let i = 0; i < plateCount; i++) {
    const size = sizeBase * MathUtils.lerp(0.7, 1.1, rng());
    const u = MathUtils.lerp(0.15, 0.85, rng());
    const s = rng() > 0.5 ? 1 : -1;
    const rot = Math.PI * 0.5 * s * MathUtils.lerp(0.85, 1.1, rng());
    const posX = u * length;
    const posY = s * size * 0.35;
    const scaleX = size * 0.65;
    const scaleY = size;
    const scaleZ = size * 0.35;
    pushBoxInstance(mats.plates, parent, posX, posY, 0, scaleX, scaleY, scaleZ, rot);
  }
}

function addTip(mats, parent, length, thickness, params) {
  const tipLength = Math.max(length * params.tipScale, thickness * 0.6);
  const posX = length + tipLength * 0.5;
  pushBoxInstance(
    mats.tips,
    parent,
    posX,
    0,
    0,
    tipLength,
    thickness * 0.8,
    thickness * 0.6,
    0
  );
}

function addTracers(mats, parent, length, thickness, rng, params) {
  const tracerCount = Math.max(1, Math.round(length * params.tracerDensity));
  const height = Math.max(thickness * params.tracerLength, thickness * 0.4);
  for (let i = 0; i < tracerCount; i++) {
    const u = MathUtils.lerp(0.12, 0.95, (i + 0.35) / (tracerCount + 0.7));
    const radius =
      thickness * params.tracerScale * MathUtils.lerp(0.9, 1.1, rng());
    const posX = u * length;
    const posY = (rng() - 0.5) * thickness * params.tracerOffset;
    const flip = params.tracerFlip === true;
    if (flip) {
      // rotate 180 around Y to swap tapered end along the X-aligned tracer axis
      scratchPos.set(posX, posY, 0);
      scratchQuat.setFromAxisAngle(yAxis, Math.PI);
      scratchScale.set(height, radius, radius);
      scratchLocal.compose(scratchPos, scratchQuat, scratchScale);
      scratchWorld.multiplyMatrices(parent, scratchLocal);
      mats.tracers.push(scratchWorld.clone());
    } else {
      pushTracerInstance(mats.tracers, parent, posX, posY, 0, height, radius);
    }
  }
}

function growBranch(mats, parentMatrix, depth, length, thickness, rng, params) {
  // segment core
  pushBoxInstance(
    mats.segments,
    parentMatrix,
    length * 0.5,
    0,
    0,
    length,
    thickness,
    thickness,
    0
  );

  addSidePlates(mats, parentMatrix, length, thickness, rng, params);
  addTracers(mats, parentMatrix, length, thickness, rng, params);

  if (depth <= 1) {
    addTip(mats, parentMatrix, length, thickness, params);
    return;
  }

  const childLength =
    length * params.branchDecay * MathUtils.lerp(0.92, 1.08, rng());
  const childThickness = Math.max(thickness * params.thicknessDecay, 0.03);
  const offset = MathUtils.lerp(0.38, 0.82, rng()) * length;
  const branchCount = 2;

  let spawned = 0;
  for (let i = 0; i < branchCount; i++) {
    const jitter = (rng() - 0.5) * 2 * params.branchJitter;
    const sign = i === 0 ? 1 : -1;
    if (rng() > params.branchProbability && spawned > 0) {
      continue;
    }
    const angle = MathUtils.degToRad(params.branchAngle * sign + jitter);
    scratchLocal.makeTranslation(
      offset + (rng() - 0.5) * 0.12 * length,
      (rng() - 0.5) * 0.08 * length,
      0
    );
    scratchWorld.makeRotationZ(angle);
    scratchLocal.multiply(scratchWorld);
    scratchWorld.multiplyMatrices(parentMatrix, scratchLocal);
    spawned++;
    growBranch(
      mats,
      scratchWorld.clone(),
      depth - 1,
      childLength,
      childThickness,
      rng,
      params
    );
  }

  if (spawned === 0) {
    const angle = MathUtils.degToRad(params.branchAngle);
    scratchLocal.makeTranslation(offset, 0, 0);
    scratchWorld.makeRotationZ(angle);
    scratchLocal.multiply(scratchWorld);
    scratchWorld.multiplyMatrices(parentMatrix, scratchLocal);
    growBranch(
      mats,
      scratchWorld.clone(),
      depth - 1,
      childLength,
      childThickness,
      rng,
      params
    );
  }
}

function createHub(material, thickness) {
  const radius = thickness * 1.6;
  const hub = new Mesh(
    new CylinderGeometry(radius, radius, thickness * 3.2, 6, 1, false),
    material
  );
  hub.rotation.z = Math.PI / 6;
  return hub;
}

export function buildSnowflake(params, resources = {}) {
  const rng = mulberry32((params.seed || 1) >>> 0);
  const material = createIceMaterial(params, resources);
  const snowflake = new Group();
  snowflake.name = "snowflake";

  const baseGeometries = {
    segment: new BoxGeometry(1, 1, 1),
    plate: new BoxGeometry(1, 1, 1),
    tip: new BoxGeometry(1, 1, 1),
    tracer: new CylinderGeometry(params.tracerTaper, 1, 1, 6, 1, false),
  };
  baseGeometries.tracer.rotateZ(Math.PI / 2);

  const armMatrices = {
    segments: [],
    plates: [],
    tips: [],
    tracers: [],
  };

  const identity = new Matrix4();
  growBranch(
    armMatrices,
    identity,
    params.recursionDepth,
    params.armLength,
    params.armThickness,
    rng,
    params
  );

  const finalMatrices = {
    segments: [],
    plates: [],
    tips: [],
    tracers: [],
  };

  const symmetry = Math.max(3, Math.floor(params.symmetry));
  for (let i = 0; i < symmetry; i++) {
    const rot = new Matrix4().makeRotationZ((Math.PI * 2 * i) / symmetry);
    for (const m of armMatrices.segments) {
      finalMatrices.segments.push(rot.clone().multiply(m));
    }
    for (const m of armMatrices.plates) {
      finalMatrices.plates.push(rot.clone().multiply(m));
    }
    for (const m of armMatrices.tips) {
      finalMatrices.tips.push(rot.clone().multiply(m));
    }
    for (const m of armMatrices.tracers) {
      finalMatrices.tracers.push(rot.clone().multiply(m));
    }
  }

  function makeInstanced(geom, mats) {
    if (mats.length === 0) return null;
    const mesh = new InstancedMesh(geom, material, mats.length);
    for (let i = 0; i < mats.length; i++) {
      mesh.setMatrixAt(i, mats[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  const segmentInst = makeInstanced(baseGeometries.segment, finalMatrices.segments);
  const plateInst = makeInstanced(baseGeometries.plate, finalMatrices.plates);
  const tipInst = makeInstanced(baseGeometries.tip, finalMatrices.tips);
  const tracerInst = makeInstanced(baseGeometries.tracer, finalMatrices.tracers);

  if (segmentInst) snowflake.add(segmentInst);
  if (plateInst) snowflake.add(plateInst);
  if (tipInst) snowflake.add(tipInst);
  if (tracerInst) snowflake.add(tracerInst);

  snowflake.add(createHub(material, params.armThickness));

  return snowflake;
}
