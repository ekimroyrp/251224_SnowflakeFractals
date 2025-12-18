import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
} from "three";

function mulberry32(seed) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createIceMaterial(params) {
  return new MeshPhysicalMaterial({
    color: new Color(0xc5e4ff),
    transmission: 1,
    roughness: 0.08,
    metalness: 0,
    ior: 1.31,
    thickness: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    attenuationDistance: 4.0,
    attenuationColor: new Color(0x9bd6ff),
    envMapIntensity: params.environmentIntensity ?? 1.25,
    side: DoubleSide,
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

function addSidePlates(segment, length, thickness, material, rng) {
  const plateCount = Math.max(2, Math.round(length * 0.5));
  const size = thickness * 0.85;
  for (let i = 0; i < plateCount; i++) {
    const plate = new Mesh(makePlateGeometry(size), material);
    const u = (i + 1) / (plateCount + 1);
    plate.position.x = u * length;
    const s = rng() > 0.5 ? 1 : -1;
    plate.position.y = s * size * 0.35;
    plate.rotation.z = Math.PI * 0.5 * s;
    segment.add(plate);
  }
}

function growSegment(group, depth, length, thickness, material, rng, params) {
  const segment = new Mesh(makeSegmentGeometry(length, thickness), material);
  group.add(segment);

  addSidePlates(segment, length, thickness, material, rng);

  if (depth <= 1) return;

  const childLength = length * params.branchDecay;
  const childThickness = Math.max(thickness * params.thicknessDecay, 0.035);
  const offset = length * 0.55;
  const branchCount = 2;

  for (let i = 0; i < branchCount; i++) {
    const child = new Group();
    const jitter = (rng() - 0.5) * 2 * params.branchJitter;
    const sign = i === 0 ? 1 : -1;
    const angle = MathUtils.degToRad(params.branchAngle * sign + jitter);
    child.position.x = offset + (rng() - 0.5) * 0.1 * length;
    child.position.y = (rng() - 0.5) * 0.05 * length;
    child.rotation.z = angle;
    segment.add(child);
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

export function buildSnowflake(params) {
  const rng = mulberry32((params.seed || 1) >>> 0);
  const material = createIceMaterial(params);
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
