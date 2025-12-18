import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  Vector2,
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

function makeSegmentGeometry(length, thickness) {
  const geom = new BoxGeometry(length, thickness, thickness, 1, 1, 1);
  geom.translate(length * 0.5, 0, 0);
  return geom;
}

function makePlateGeometry(size) {
  const geom = new BoxGeometry(size * 0.65, size, size * 0.35, 1, 1, 1);
  geom.translate((size * 0.65) / 2, 0, 0);
  return geom;
}

function makeTipGeometry(length, thickness, scale) {
  const geom = new BoxGeometry(length * scale, thickness * 0.8, thickness * 0.6);
  geom.translate((length * scale) / 2, 0, 0);
  return geom;
}

function addSidePlates(segment, length, thickness, material, rng, params) {
  const plateCount = Math.max(1, Math.round(length * params.plateDensity));
  const sizeBase = thickness * 0.75;
  for (let i = 0; i < plateCount; i++) {
    const size = sizeBase * MathUtils.lerp(0.7, 1.1, rng());
    const plate = new Mesh(makePlateGeometry(size), material);
    const u = MathUtils.lerp(0.15, 0.85, rng());
    plate.position.x = u * length;
    const s = rng() > 0.5 ? 1 : -1;
    plate.position.y = s * size * 0.35;
    plate.rotation.z = Math.PI * 0.5 * s * MathUtils.lerp(0.85, 1.1, rng());
    segment.add(plate);
  }
}

function addTip(segment, length, thickness, material, params) {
  const tip = new Mesh(
    makeTipGeometry(length * params.tipScale, thickness, 1),
    material
  );
  tip.position.x = length;
  segment.add(tip);
}

function growSegment(group, depth, length, thickness, material, rng, params) {
  const segment = new Mesh(makeSegmentGeometry(length, thickness), material);
  group.add(segment);

  addSidePlates(segment, length, thickness, material, rng, params);

  if (depth <= 1) {
    addTip(segment, length, thickness, material, params);
    return;
  }

  const childLength =
    length * params.branchDecay * MathUtils.lerp(0.92, 1.08, rng());
  const childThickness = Math.max(thickness * params.thicknessDecay, 0.03);
  const offset = MathUtils.lerp(0.38, 0.82, rng()) * length;
  const branchCount = 2;

  let spawned = 0;
  for (let i = 0; i < branchCount; i++) {
    const child = new Group();
    const jitter = (rng() - 0.5) * 2 * params.branchJitter;
    const sign = i === 0 ? 1 : -1;
    if (rng() > params.branchProbability && spawned > 0) {
      continue;
    }
    const angle = MathUtils.degToRad(params.branchAngle * sign + jitter);
    child.position.x = offset + (rng() - 0.5) * 0.12 * length;
    child.position.y = (rng() - 0.5) * 0.08 * length;
    child.rotation.z = angle;
    segment.add(child);
    spawned++;
    growSegment(
      child,
      depth - 1,
      childLength,
      childThickness,
      material,
      rng,
      params
    );
  }
  if (spawned === 0) {
    const fallback = new Group();
    const angle = MathUtils.degToRad(params.branchAngle);
    fallback.position.x = offset;
    fallback.rotation.z = angle;
    segment.add(fallback);
    growSegment(
      fallback,
      depth - 1,
      childLength,
      childThickness,
      material,
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

  const arm = new Group();
  growSegment(
    arm,
    params.recursionDepth,
    params.armLength,
    params.armThickness,
    material,
    rng,
    params
  );

  const symmetry = Math.max(3, Math.floor(params.symmetry));
  for (let i = 0; i < symmetry; i++) {
    const clone = arm.clone(true);
    clone.rotation.z = (Math.PI * 2 * i) / symmetry;
    snowflake.add(clone);
  }

  snowflake.add(createHub(material, params.armThickness));

  return snowflake;
}
