import * as THREE from 'three';
import { WORLD, LAMP_CONFIGS } from './worldConfig.js';
import {
  boxPart,
  cylinderBetween,
  mergeParts,
  mulberry32,
  rand,
  TAU,
  tubeFromCurve,
} from './utils.js';

const SIDEWALK = WORLD.sidewalkY;

function makeBench(materials, shadowSpots) {
  const bench = new THREE.Group();
  bench.name = 'violet-bench';
  bench.position.set(1.03, SIDEWALK, 4.57);

  const seatPartsDark = [];
  const seatPartsLight = [];
  for (let i = 0; i < 5; i += 1) {
    const z = -0.18 + i * 0.112;
    const target = i % 2 === 0 ? seatPartsDark : seatPartsLight;
    target.push(boxPart(1.56, 0.045, 0.093, 0, 0.455, z));
  }
  for (let i = 0; i < 5; i += 1) {
    const y = 0.62 + i * 0.105;
    const z = -0.28 - i * 0.018;
    const target = i % 2 === 0 ? seatPartsLight : seatPartsDark;
    target.push(boxPart(1.56, 0.085, 0.038, 0, y, z));
  }
  const woodDark = mergeParts(seatPartsDark, materials.benchWood, {
    castShadow: true,
    receiveShadow: true,
  });
  const woodLight = mergeParts(seatPartsLight, materials.benchWoodLight, {
    castShadow: true,
    receiveShadow: true,
  });
  if (woodDark) bench.add(woodDark);
  if (woodLight) bench.add(woodLight);

  const frameParts = [];
  [-0.72, 0.72].forEach((x) => {
    const sideCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0.02, -0.24),
      new THREE.Vector3(x, 0.18, -0.25),
      new THREE.Vector3(x, 0.44, -0.24),
      new THREE.Vector3(x, 0.72, -0.23),
      new THREE.Vector3(x, 0.72, 0.02),
      new THREE.Vector3(x, 0.72, 0.27),
      new THREE.Vector3(x, 0.44, 0.3),
      new THREE.Vector3(x, 0.02, 0.32),
    ]);
    frameParts.push(new THREE.TubeGeometry(sideCurve, 28, 0.023, 5, false));
    frameParts.push(
      cylinderBetween([x, 0.43, -0.23], [x, 0.43, 0.3], 0.017, 6),
      cylinderBetween([x, 0.445, -0.24], [x, 0.98, -0.37], 0.021, 6),
      cylinderBetween([x, 0.44, 0.3], [x, 0.07, 0.34], 0.02, 6),
      boxPart(0.038, 0.035, 0.1, x, 0.72, 0.24, 0, 0, 0),
    );
  });
  const frame = mergeParts(frameParts, materials.silver, {
    castShadow: true,
    receiveShadow: true,
  });
  if (frame) bench.add(frame);

  contactSpot(shadowSpots, 1.03, 4.57, 2.1, 0.9, SIDEWALK);
  return bench;
}

function makePottedPlant(materials, x, z, scale, variant, shadowSpots) {
  const pot = new THREE.Group();
  pot.position.set(x, SIDEWALK, z);
  pot.scale.setScalar(scale);
  const rng = mulberry32(340 + variant * 71);

  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.16, 0.0),
    new THREE.Vector2(0.18, 0.035),
    new THREE.Vector2(0.15, 0.07),
    new THREE.Vector2(0.17, 0.22),
    new THREE.Vector2(0.2, 0.26),
    new THREE.Vector2(0.19, 0.3),
    new THREE.Vector2(0.0, 0.3),
  ];
  const potMesh = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 16),
    variant % 2 === 0 ? materials.pot : materials.ceramicCream,
  );
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  pot.add(potMesh);
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.148, 0.142, 0.014, 16),
    materials.soilDark,
  );
  soil.position.y = 0.256;
  pot.add(soil);

  const leafParts = [];
  const blades = 13 + variant * 2;
  for (let i = 0; i < blades; i += 1) {
    const angle = (i / blades) * TAU + rand(rng, -0.25, 0.25);
    const height = rand(rng, 0.36, 0.66) * (1 + variant * 0.06);
    const reach = rand(rng, 0.09, 0.24);
    const width = rand(rng, 0.032, 0.054);
    const segments = 4;
    const positions = [];
    const indices = [];
    for (let s = 0; s <= segments; s += 1) {
      const t = s / segments;
      const bend = Math.sin(t * Math.PI * 0.7) * reach;
      const px = Math.cos(angle) * (0.025 + bend);
      const pz = Math.sin(angle) * (0.025 + bend);
      const py = 0.25 + height * t;
      const w = width * (1 - t * 0.78) * (0.4 + Math.sin(t * Math.PI) * 0.85);
      const sideX = Math.cos(angle + Math.PI / 2) * w;
      const sideZ = Math.sin(angle + Math.PI / 2) * w;
      positions.push(
        px - sideX,
        py,
        pz - sideZ,
        px + sideX,
        py,
        pz + sideZ,
      );
    }
    for (let s = 0; s < segments; s += 1) {
      const a = s * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    leafParts.push(geometry);
  }
  const leaves = mergeParts(leafParts, materials.fern, {
    castShadow: true,
    receiveShadow: true,
  });
  if (leaves) {
    leaves.scale.y = 1;
    pot.add(leaves);
  }
  contactSpot(
    shadowSpots,
    x,
    z,
    0.6 * scale,
    0.6 * scale,
    SIDEWALK,
  );
  return pot;
}

function makeMagazineRack(materials, shadowSpots) {
  const rack = new THREE.Group();
  rack.name = 'magazine-rack';
  rack.position.set(2.43, SIDEWALK, 4.57);
  const parts = [];
  const sideZ = 0.14;
  [-0.35, 0.35].forEach((x) => {
    parts.push(
      boxPart(0.03, 0.92, 0.03, x, 0.46, -sideZ),
      boxPart(0.03, 0.92, 0.03, x, 0.46, sideZ),
      boxPart(0.03, 0.03, 0.28, x, 0.88, 0),
    );
  });
  for (let i = 0; i < 3; i += 1) {
    const y = 0.2 + i * 0.28;
    parts.push(boxPart(0.7, 0.027, 0.3, 0, y, 0));
    parts.push(boxPart(0.7, 0.024, 0.024, 0, y + 0.11, 0.15, -0.34, 0, 0));
  }
  const frame = mergeParts(parts, materials.iron, {
    castShadow: true,
    receiveShadow: true,
  });
  if (frame) rack.add(frame);

  const magazineRng = mulberry32(451);
  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i < 3; i += 1) {
      const cover = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.245),
        materials.magazineCovers[(row + i) % materials.magazineCovers.length],
      );
      cover.position.set(-0.23 + i * 0.23, 0.335 + row * 0.28, 0.16);
      cover.rotation.x = -0.38;
      cover.castShadow = false;
      rack.add(cover);
      const backing = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.25, 0.012),
        materials.posterPapers[0],
      );
      backing.visible = false;
      rack.add(backing);
      if (magazineRng() < 0.15) {
        cover.visible = false;
      }
    }
  }
  const stack = new THREE.Mesh(
    new THREE.BoxGeometry(0.33, 0.045, 0.24),
    materials.posterPapers[1],
  );
  stack.position.set(0.2, 0.035, 0.25);
  stack.rotation.y = 0.1;
  stack.castShadow = true;
  rack.add(stack);
  contactSpot(shadowSpots, 2.43, 4.57, 0.95, 0.48, SIDEWALK);
  return rack;
}

function makeBicycle(materials, shadowSpots) {
  const bike = new THREE.Group();
  bike.name = 'bicycle';
  bike.position.set(5.08, SIDEWALK + 0.01, -2.78);
  bike.rotation.z = 0.115;
  bike.rotation.y = 0.06;

  const wheelGeometry = new THREE.TorusGeometry(0.335, 0.021, 6, 30);
  wheelGeometry.rotateY(Math.PI / 2);
  const spokeParts = [];
  const hubParts = [];
  [-0.47, 0.47].forEach((z) => {
    const wheel = new THREE.Mesh(wheelGeometry, materials.tire);
    wheel.position.set(0, 0.355, z);
    wheel.castShadow = true;
    bike.add(wheel);
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * TAU;
      spokeParts.push(
        cylinderBetween(
          [0, 0.355, z],
          [0, 0.355 + Math.cos(angle) * 0.315, z + Math.sin(angle) * 0.315],
          0.0045,
          3,
        ),
      );
    }
    hubParts.push(
      cylinderBetween([-0.035, 0.355, z], [0.035, 0.355, z], 0.025, 8),
    );
  });
  const spokes = mergeParts(spokeParts, materials.silver, {
    castShadow: false,
    receiveShadow: false,
  });
  const hubs = mergeParts(hubParts, materials.silver, {
    castShadow: true,
    receiveShadow: true,
  });
  if (spokes) bike.add(spokes);
  if (hubs) bike.add(hubs);

  const points = {
    rear: [0, 0.355, -0.47],
    bottom: [0, 0.355, 0.015],
    seat: [0, 0.79, -0.16],
    head: [0, 0.78, 0.34],
    front: [0, 0.355, 0.47],
    headLow: [0, 0.55, 0.4],
  };
  const frameParts = [
    cylinderBetween(points.rear, points.bottom, 0.017, 6),
    cylinderBetween(points.bottom, points.seat, 0.018, 6),
    cylinderBetween(points.seat, points.rear, 0.016, 6),
    cylinderBetween(points.bottom, points.head, 0.019, 6),
    cylinderBetween(points.seat, points.head, 0.018, 6),
    cylinderBetween(points.head, points.front, 0.015, 6),
    cylinderBetween(points.headLow, points.front, 0.012, 6),
    cylinderBetween(points.head, [0, 0.93, 0.45], 0.014, 6),
    cylinderBetween([-0.18, 0.93, 0.48], [0.18, 0.93, 0.48], 0.014, 6),
    cylinderBetween([0.18, 0.93, 0.48], [0.22, 0.96, 0.43], 0.014, 6),
    cylinderBetween([-0.18, 0.93, 0.48], [-0.22, 0.96, 0.43], 0.014, 6),
    cylinderBetween([0, 0.79, 0.34], [0, 0.95, 0.39], 0.015, 6),
    cylinderBetween(points.seat, [0, 0.875, -0.18], 0.013, 6),
    cylinderBetween(points.bottom, [-0.08, 0.35, -0.12], 0.004, 4),
    cylinderBetween(points.bottom, [0.08, 0.35, -0.12], 0.004, 4),
  ];
  const frame = mergeParts(frameParts, materials.bikeFrame, {
    castShadow: true,
    receiveShadow: true,
  });
  if (frame) bike.add(frame);

  const saddle = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 6, 0, TAU, 0, Math.PI / 2),
    materials.leather,
  );
  saddle.scale.set(0.65, 0.18, 1.25);
  saddle.rotation.z = Math.PI;
  saddle.position.set(0, 0.89, -0.2);
  saddle.castShadow = true;
  bike.add(saddle);

  const gripGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.1, 7);
  [-0.2, 0.2].forEach((x) => {
    const grip = new THREE.Mesh(gripGeom, materials.leather);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(x, 0.955, 0.46);
    bike.add(grip);
  });
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.012, 12),
    materials.ironSoft,
  );
  disc.rotation.z = Math.PI / 2;
  disc.position.set(-0.045, 0.36, -0.12);
  bike.add(disc);
  const pedal = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.03, 0.06),
    materials.leather,
  );
  pedal.position.set(-0.14, 0.18, 0.08);
  bike.add(pedal);

  contactSpot(shadowSpots, 5.03, -2.78, 0.8, 1.38, SIDEWALK);
  return bike;
}

function makeStreetLamp(materials, config, shadowSpots) {
  const lamp = new THREE.Group();
  lamp.name = config.id;
  lamp.position.set(config.x, config.y, config.z);
  const ironParts = [];
  ironParts.push(
    new THREE.CylinderGeometry(0.16, 0.2, 0.17, 10),
  );
  ironParts[0].translate(0, 0.085, 0);
  ironParts.push(
    new THREE.CylinderGeometry(0.105, 0.145, 0.16, 10),
  );
  ironParts[1].translate(0, 0.23, 0);
  const post = new THREE.CylinderGeometry(0.042, 0.07, 2.36, 9);
  post.translate(0, 1.43, 0);
  ironParts.push(post);
  for (const y of [0.44, 0.58, 2.12, 2.56]) {
    const collar = new THREE.CylinderGeometry(0.075, 0.075, 0.055, 10);
    collar.translate(0, y, 0);
    ironParts.push(collar);
  }
  const lampBase = new THREE.CylinderGeometry(0.12, 0.08, 0.11, 6);
  lampBase.translate(0, 2.6, 0);
  ironParts.push(lampBase);
  const glassHeight = 0.31;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, glassHeight, 6),
    materials.lampGlass,
  );
  glass.position.y = 2.82;
  glass.castShadow = false;
  lamp.add(glass);
  const cap = new THREE.ConeGeometry(0.24, 0.16, 6);
  cap.translate(0, 3.065, 0);
  ironParts.push(cap);
  const finial = new THREE.SphereGeometry(0.047, 8, 6);
  finial.translate(0, 3.16, 0);
  ironParts.push(finial);
  // Slender mullions around the lantern.
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * TAU + Math.PI / 6;
    ironParts.push(
      boxPart(
        0.018,
        glassHeight + 0.03,
        0.018,
        Math.cos(angle) * 0.155,
        2.82,
        Math.sin(angle) * 0.155,
      ),
    );
  }
  const iron = mergeParts(ironParts, materials.iron, {
    castShadow: true,
    receiveShadow: true,
  });
  if (iron) lamp.add(iron);

  const glowMaterial = new THREE.SpriteMaterial({
    map: materials.glowMap,
    color: '#ffd89b',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.set(1.8, 1.8, 1);
  glow.position.y = 2.82;
  lamp.add(glow);

  const localPosition = new THREE.Vector3(0, 2.8, 0);
  const spot = new THREE.SpotLight('#ffc47c', 0, 10, 0.76, 0.58, 1.75);
  spot.position.copy(localPosition);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 0.3;
  spot.shadow.camera.far = 9;
  spot.shadow.bias = -0.0007;
  spot.shadow.normalBias = 0.02;
  const target = new THREE.Object3D();
  target.position.set(
    config.target[0] - config.x,
    config.target[1] - config.y,
    config.target[2] - config.z,
  );
  spot.target = target;
  lamp.add(spot, target);

  const point = new THREE.PointLight('#ffbf7a', 0, 6.4, 1.85);
  point.position.copy(localPosition);
  lamp.add(point);

  contactSpot(shadowSpots, config.x, config.z, 0.52, 0.52, config.y, 0.32);
  return {
    group: lamp,
    glowMaterial,
    spot,
    point,
    config,
    position: new THREE.Vector3(config.x, config.y + 2.8, config.z),
  };
}

function contactSpot(
  shadowSpots,
  x,
  z,
  width,
  depth,
  y,
  opacity = 1,
) {
  shadowSpots.push({ x, z, width, depth, y, opacity });
}

export function buildProps(materials) {
  const group = new THREE.Group();
  group.name = 'street-props';
  const shadowSpots = [];
  const lamps = [];

  group.add(makeBench(materials, shadowSpots));
  group.add(makeMagazineRack(materials, shadowSpots));
  group.add(makePottedPlant(materials, -0.23, 4.7, 1.08, 0, shadowSpots));
  group.add(makePottedPlant(materials, 3.25, 4.63, 0.88, 1, shadowSpots));
  group.add(makePottedPlant(materials, 5.05, 2.84, 0.82, 2, shadowSpots));
  group.add(makePottedPlant(materials, 2.05, -5.58, 0.8, 3, shadowSpots));
  group.add(makeBicycle(materials, shadowSpots));

  LAMP_CONFIGS.forEach((config) => {
    const lamp = makeStreetLamp(materials, config, shadowSpots);
    group.add(lamp.group);
    lamps.push(lamp);
  });

  return { group, lamps, shadowSpots };
}

export function buildContactShadows(materials, spots) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(
    geometry,
    materials.contactShadow,
    spots.length,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  spots.forEach((spot, index) => {
    dummy.position.set(spot.x, spot.y + 0.007, spot.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(spot.width, spot.depth, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    color.setScalar(spot.opacity ?? 1);
    mesh.setColorAt(index, color);
  });
  mesh.renderOrder = 2;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
