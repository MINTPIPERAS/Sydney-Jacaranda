import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD, TREE_CONFIGS } from './worldConfig.js';
import {
  boxPart,
  mergeParts,
  mulberry32,
  rand,
  TAU,
} from './utils.js';

const { building, walks, half, sidewalkY, streetY, farWalkY, gardenY } = WORLD;

function addGroundPlane(group, material, width, depth, y, x = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addFlatBox(group, material, width, height, depth, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  group.add(mesh);
  return mesh;
}

function makeCurbInstances(group, materials) {
  const segments = [];
  const rng = mulberry32(2309);
  const addRun = (axis, fixed, from, to, top, near, depth = 0.17) => {
    let cursor = from;
    while (cursor < to - 0.1) {
      const length = Math.min(rand(rng, 0.62, 0.98), to - cursor);
      if (length < 0.22) break;
      const center = cursor + length / 2;
      segments.push({
        axis,
        x: axis === 'x' ? center : fixed,
        z: axis === 'x' ? fixed : center,
        length: Math.max(0.12, length - 0.018),
        top: top + rand(rng, -0.004, 0.004),
        near,
        depth,
      });
      cursor += length + 0.012;
    }
  };

  // Street-facing faces of the near pavements and the far pavements.
  addRun('x', 6.235, -10, 6.15, sidewalkY + 0.012, true);
  addRun('z', 6.235, -10, 6.15, sidewalkY + 0.012, true);
  addRun('x', 8.79, -10, 10, farWalkY + 0.011, false);
  addRun('z', 8.79, -10, 8.79, farWalkY + 0.011, false);

  const base = new THREE.BoxGeometry(1, 1, 1);
  base.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(base, materials.curb, segments.length);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  segments.forEach((segment, index) => {
    dummy.position.set(segment.x, streetY, segment.z);
    dummy.scale.set(
      segment.axis === 'x' ? segment.length : segment.depth,
      segment.top - streetY,
      segment.axis === 'x' ? segment.depth : segment.length,
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    const shade = 0.92 + rng() * 0.11;
    color.setRGB(shade, shade * 0.995, shade * 0.97);
    mesh.setColorAt(index, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

function makeTreePits(group, materials) {
  const grateMaterial = materials.metalGrate;
  const grateGeometry = (() => {
    const parts = [];
    const y = 0;
    parts.push(boxPart(0.96, 0.03, 0.052, 0, y, -0.454));
    parts.push(boxPart(0.96, 0.03, 0.052, 0, y, 0.454));
    parts.push(boxPart(0.052, 0.03, 0.856, -0.454, y, 0));
    parts.push(boxPart(0.052, 0.03, 0.856, 0.454, y, 0));
    for (let i = -4; i <= 4; i += 1) {
      if (i === 0) continue;
      parts.push(boxPart(0.84, 0.022, 0.023, 0, y + 0.002, i * 0.083));
    }
    for (const x of [-0.17, 0.17]) {
      parts.push(boxPart(0.022, 0.018, 0.66, x, y + 0.006, 0));
    }
    for (const x of [-0.29, 0.29]) {
      parts.push(boxPart(0.026, 0.018, 0.82, x, y + 0.008, 0));
    }
    return mergeParts(parts, grateMaterial, {
      castShadow: false,
      receiveShadow: true,
    }).geometry;
  })();

  const grateMesh = new THREE.InstancedMesh(
    grateGeometry,
    grateMaterial,
    TREE_CONFIGS.length,
  );
  grateMesh.castShadow = false;
  grateMesh.receiveShadow = true;

  const pitMatrices = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    materials.soilDark,
    TREE_CONFIGS.length,
  );
  const borderGeometryParts = [];
  borderGeometryParts.push(boxPart(1.02, 0.07, 0.07, 0, 0, -0.505));
  borderGeometryParts.push(boxPart(1.02, 0.07, 0.07, 0, 0, 0.505));
  borderGeometryParts.push(boxPart(0.07, 0.07, 0.94, -0.505, 0, 0));
  borderGeometryParts.push(boxPart(0.07, 0.07, 0.94, 0.505, 0, 0));
  const borderGeometry = mergeParts(borderGeometryParts, materials.stoneDark, {
    castShadow: false,
    receiveShadow: true,
  }).geometry;
  const borderMesh = new THREE.InstancedMesh(
    borderGeometry,
    materials.stoneDark,
    TREE_CONFIGS.length,
  );
  borderMesh.castShadow = false;
  borderMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  TREE_CONFIGS.forEach((tree, index) => {
    const y = tree.groundY;
    dummy.position.set(tree.x, y + 0.006, tree.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(tree.pit, tree.pit, 1);
    dummy.updateMatrix();
    pitMatrices.setMatrixAt(index, dummy.matrix);

    dummy.position.set(tree.x, y + 0.014, tree.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(tree.pit, 1, tree.pit);
    dummy.updateMatrix();
    grateMesh.setMatrixAt(index, dummy.matrix);

    dummy.position.set(tree.x, y + 0.008, tree.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(tree.pit, 1, tree.pit);
    dummy.updateMatrix();
    borderMesh.setMatrixAt(index, dummy.matrix);
  });

  pitMatrices.receiveShadow = true;
  pitMatrices.instanceMatrix.needsUpdate = true;
  borderMesh.instanceMatrix.needsUpdate = true;
  grateMesh.instanceMatrix.needsUpdate = true;
  group.add(pitMatrices, grateMesh, borderMesh);
}

function makeRoadDetails(group, materials) {
  const rng = mulberry32(1612);
  const dashGeometry = new THREE.BoxGeometry(1, 0.007, 0.085);
  const paintY = streetY + 0.028;
  const dashes = [];
  for (let x = -9.25; x < 5.45; x += 1.17) {
    dashes.push({ x, z: 7.5, axis: 'x' });
  }
  for (let z = -9.2; z < 5.35; z += 1.17) {
    dashes.push({ x: 7.5, z, axis: 'z' });
  }
  const dashMesh = new THREE.InstancedMesh(
    dashGeometry,
    materials.roadPaint,
    dashes.length,
  );
  const dummy = new THREE.Object3D();
  dashes.forEach((dash, index) => {
    dummy.position.set(dash.x, paintY, dash.z);
    dummy.rotation.set(0, dash.axis === 'z' ? Math.PI / 2 : 0, 0);
    dummy.scale.set(0.52 + rng() * 0.11, 1, 1);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(index, dummy.matrix);
  });
  dashMesh.renderOrder = 1;
  dashMesh.instanceMatrix.needsUpdate = true;
  group.add(dashMesh);

  // A quiet parking bay marking on the front street.
  const bayLine = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.007, 0.045), materials.roadPaint);
  bayLine.position.set(-6.8, paintY, 6.43);
  bayLine.renderOrder = 1;
  group.add(bayLine);
  const bayEnd = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.007, 0.54), materials.roadPaint);
  bayEnd.position.set(-8.25, paintY, 6.68);
  bayEnd.renderOrder = 1;
  group.add(bayEnd);

  // Gutters catch the fallen petals and read as a slight tonal line.
  const gutterMaterial = new THREE.MeshBasicMaterial({
    color: '#4f5055',
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const gutterFront = new THREE.Mesh(new THREE.PlaneGeometry(16.15, 0.25), gutterMaterial);
  gutterFront.rotation.x = -Math.PI / 2;
  gutterFront.position.set(-1.9, streetY + 0.023, 6.39);
  group.add(gutterFront);
  const gutterRight = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 16.15), gutterMaterial);
  gutterRight.rotation.x = -Math.PI / 2;
  gutterRight.position.set(6.39, streetY + 0.023, -1.9);
  group.add(gutterRight);

  const drainAt = (x, z, rotation) => {
    const drainGroup = new THREE.Group();
    const recess = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.012, 0.27),
      materials.drainDark,
    );
    recess.position.y = 0.002;
    drainGroup.add(recess);
    for (let i = 0; i < 6; i += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.012, 0.235),
        materials.metalGrate,
      );
      bar.position.set(-0.245 + i * 0.098, 0.009, 0);
      drainGroup.add(bar);
    }
    drainGroup.position.set(x, streetY + 0.018, z);
    drainGroup.rotation.y = rotation;
    group.add(drainGroup);
  };
  drainAt(4.78, 6.34, 0);
  drainAt(-2.36, 6.34, 0);
  drainAt(6.34, 1.28, Math.PI / 2);
  drainAt(6.34, -5.64, Math.PI / 2);

  const manhole = new THREE.Group();
  const cover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.016, 28),
    materials.manhole,
  );
  cover.position.y = 0.018;
  cover.receiveShadow = true;
  manhole.add(cover);
  for (let r = 0.08; r <= 0.23; r += 0.075) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.006, 4, 28),
      materials.ironSoft,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.028;
    manhole.add(ring);
  }
  manhole.position.set(7.67, streetY, 7.48);
  group.add(manhole);

  // A few cracks keep the asphalt from reading as a flat colour field.
  const crackPoints = [
    [-4.6, 8.1],
    [-2.8, 8.25],
    [1.2, 7.1],
    [8.2, -4.3],
    [8.05, -6.1],
  ];
  crackPoints.forEach(([x, z], crackIndex) => {
    const points = [];
    let px = x;
    let pz = z;
    for (let i = 0; i < 4; i += 1) {
      points.push(new THREE.Vector3(px, streetY + 0.022, pz));
      px += (rng() - 0.5) * 0.48;
      pz += (rng() - 0.35) * 0.4;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, materials.crack);
    if (crackIndex > 2) line.rotation.y = Math.PI / 2;
    group.add(line);
  });
}

function makeGarden(group, materials) {
  const rng = mulberry32(9934);
  const leftBed = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.1, 13.45),
    materials.garden,
  );
  leftBed.position.set(-8.65, gardenY - 0.05, -0.575);
  leftBed.receiveShadow = true;
  group.add(leftBed);
  const backBed = new THREE.Mesh(
    new THREE.BoxGeometry(16.15, 0.1, 2.7),
    materials.garden,
  );
  backBed.position.set(-1.925, gardenY - 0.05, -8.65);
  backBed.receiveShadow = true;
  group.add(backBed);

  const edgeMaterial = materials.stoneDark;
  const edgeFrontBack = new THREE.Mesh(
    new THREE.BoxGeometry(16.15, 0.12, 0.08),
    edgeMaterial,
  );
  edgeFrontBack.position.set(-1.925, 0.12, -7.31);
  group.add(edgeFrontBack);
  const edgeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 13.43), edgeMaterial);
  edgeLeft.position.set(-7.3, 0.12, -0.58);
  group.add(edgeLeft);

  // Stepping stones through the rear garden.
  const stoneGeometry = new THREE.CylinderGeometry(0.26, 0.29, 0.055, 7);
  const stoneMaterial = materials.curb;
  for (let i = 0; i < 5; i += 1) {
    const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
    stone.position.set(-1.1 + i * 0.54 + (rng() - 0.5) * 0.18, 0.117, -7.78 + i * 0.19);
    stone.scale.set(1.1, 1, 0.82);
    stone.rotation.y = rng() * 0.5;
    stone.receiveShadow = true;
    stone.castShadow = true;
    group.add(stone);
  }

  // Rounded stepping stones run from the back door into the planted court.
  const pathStone = new THREE.CylinderGeometry(0.31, 0.35, 0.065, 8);
  for (let i = 0; i < 6; i += 1) {
    const stone = new THREE.Mesh(pathStone, materials.stone);
    stone.position.set(2.0 - i * 0.58 + (rng() - 0.5) * 0.16, 0.125, -7.48 - i * 0.2);
    stone.scale.set(1.06, 1, 0.82);
    stone.rotation.y = rng() * TAU;
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }
  const boulderGeometry = new THREE.DodecahedronGeometry(0.32, 0);
  for (let i = 0; i < 5; i += 1) {
    const boulder = new THREE.Mesh(boulderGeometry, materials.stoneDark);
    boulder.position.set(
      rand(rng, -9.4, -7.8),
      0.17,
      rand(rng, -9.4, 5.4),
    );
    boulder.scale.set(rand(rng, 0.65, 1.3), rand(rng, 0.55, 0.95), rand(rng, 0.65, 1.2));
    boulder.rotation.set(rng(), rng() * TAU, rng());
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    group.add(boulder);
  }

  // Low clipped hedges make the planted edges feel intentional.
  const hedgeParts = [];
  const hedgeSegments = [
    [-9.22, 3.75, 0.55, 2.4, 0.4],
    [-9.22, 0.55, 0.54, 2.0, 0.48],
    [-9.22, -2.95, 0.55, 2.1, 0.43],
    [-9.22, -5.55, 0.52, 1.2, 0.38],
    [-6.45, -9.05, 3.1, 0.55, 0.42],
    [-2.05, -9.1, 2.8, 0.52, 0.47],
    [1.55, -9.1, 2.35, 0.5, 0.4],
    [4.65, -9.06, 1.5, 0.48, 0.44],
  ];
  hedgeSegments.forEach(([x, z, width, depth, height], index) => {
    const geo = new RoundedBoxGeometry(width, height, depth, 2, 0.12);
    hedgeParts.push(geo.translate(x, gardenY + height / 2, z));
  });
  group.add(mergeParts(hedgeParts, materials.hedge, { castShadow: true, receiveShadow: true }));

  const shrubGeometry = (() => {
    const lobes = [];
    const lobe = new THREE.IcosahedronGeometry(0.52, 1);
    lobes.push(lobe.clone().translate(-0.3, 0.03, 0.03));
    lobes.push(lobe.clone().scale(0.78, 0.72, 0.8).translate(0.22, 0.13, -0.1));
    lobes.push(lobe.clone().scale(0.6, 0.7, 0.68).translate(0.04, 0.24, 0.25));
    lobes.push(lobe.clone().scale(0.62, 0.56, 0.6).translate(-0.12, -0.03, -0.28));
    const merged = mergeParts(lobes, materials.hedgeLight, { castShadow: true, receiveShadow: true });
    return merged.geometry;
  })();
  const shrubs = [];
  const addShrubCluster = (cx, cz, count, spread, scaleMin, scaleMax) => {
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * TAU;
      const radius = Math.sqrt(rng()) * spread;
      shrubs.push({
        x: cx + Math.cos(angle) * radius,
        z: cz + Math.sin(angle) * radius,
        s: rand(rng, scaleMin, scaleMax),
        sy: rand(rng, 0.7, 1.25),
        hue: rng(),
      });
    }
  };
  for (let i = 0; i < 5; i += 1) {
    addShrubCluster(-8.65, 4.6 - i * 2.3, 6, 0.72, 0.14, 0.32);
  }
  for (let i = 0; i < 7; i += 1) {
    addShrubCluster(-5.4 + i * 1.8, -8.65, 5, 0.68, 0.13, 0.3);
  }
  addShrubCluster(-8.85, -8.55, 10, 0.78, 0.14, 0.32);
  addShrubCluster(-9.35, 0.2, 7, 0.48, 0.12, 0.26);
  addShrubCluster(-8.15, -6.95, 5, 0.48, 0.12, 0.24);
  addShrubCluster(-7.75, -8.55, 4, 0.42, 0.14, 0.28);

  const shrubMesh = new THREE.InstancedMesh(
    shrubGeometry,
    materials.hedgeLight,
    shrubs.length,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  shrubs.forEach((shrub, index) => {
    dummy.position.set(shrub.x, gardenY + shrub.s * shrub.sy * 0.66, shrub.z);
    dummy.rotation.set(0, rng() * TAU, 0);
    dummy.scale.set(shrub.s, shrub.s * shrub.sy, shrub.s * rand(rng, 0.8, 1.15));
    dummy.updateMatrix();
    shrubMesh.setMatrixAt(index, dummy.matrix);
    color.setHSL(
      0.27 + shrub.hue * 0.035,
      0.16 + shrub.hue * 0.07,
      0.39 + shrub.hue * 0.12,
    );
    shrubMesh.setColorAt(index, color);
  });
  shrubMesh.castShadow = true;
  shrubMesh.receiveShadow = true;
  shrubMesh.instanceMatrix.needsUpdate = true;
  if (shrubMesh.instanceColor) shrubMesh.instanceColor.needsUpdate = true;
  group.add(shrubMesh);

  // Fine tufts of grass along the beds.
  const tuftParts = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * TAU;
    tuftParts.push(
      boxPart(0.018, 0.27 + (i % 3) * 0.05, 0.018, Math.cos(angle) * 0.035, 0.13, Math.sin(angle) * 0.035, 0.22 * Math.cos(angle), 0, 0.22 * Math.sin(angle)),
    );
  }
  const tuftGeometry = mergeParts(tuftParts, materials.grass, {
    castShadow: false,
    receiveShadow: true,
  }).geometry;
  const tuftMesh = new THREE.InstancedMesh(tuftGeometry, materials.grass, 52);
  for (let i = 0; i < 52; i += 1) {
    const back = i < 30;
    dummy.position.set(
      back ? rand(rng, -9.6, 5.8) : rand(rng, -9.6, -7.6),
      gardenY,
      back ? rand(rng, -9.55, -7.55) : rand(rng, -6.8, 5.7),
    );
    dummy.rotation.set(0, rng() * TAU, 0);
    dummy.scale.setScalar(rand(rng, 0.8, 1.5));
    dummy.updateMatrix();
    tuftMesh.setMatrixAt(i, dummy.matrix);
  }
  tuftMesh.castShadow = false;
  tuftMesh.receiveShadow = true;
  tuftMesh.instanceMatrix.needsUpdate = true;
  group.add(tuftMesh);
}

function addBaseAndUnderlay(group, materials) {
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(20.6, 0.56, 20.6, 3, 0.11),
    materials.baseBody,
  );
  base.position.y = -0.32;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const cap = new THREE.Mesh(
    new RoundedBoxGeometry(20.64, 0.085, 20.64, 3, 0.095),
    materials.trim,
  );
  cap.position.y = -0.018;
  cap.receiveShadow = true;
  group.add(cap);

  const foot = new THREE.Mesh(
    new RoundedBoxGeometry(20.5, 0.045, 20.5, 2, 0.06),
    materials.brass,
  );
  foot.position.y = -0.593;
  foot.receiveShadow = true;
  group.add(foot);

  addGroundPlane(group, materials.stone, 20.2, 20.2, 0.026);
}

export function buildGround(materials) {
  const group = new THREE.Group();
  group.name = 'ground';

  addBaseAndUnderlay(group, materials);

  // Near pavements are one raised stone plate; the house sits into it.
  addFlatBox(group, materials.sidewalk, 13.45, sidewalkY, 13.45, -0.575, sidewalkY / 2, -0.575);

  // Far pavements.
  addFlatBox(group, materials.sidewalk, 1.15, farWalkY, 18.85, 9.425, farWalkY / 2, -0.575);
  addFlatBox(group, materials.sidewalk, 20, farWalkY, 1.15, 0, farWalkY / 2, 9.425);

  // Asphalt is laid as a true T so there is no coplanar overlap at the corner.
  addFlatBox(group, materials.asphalt, 2.7, 0.04, 16.15, 7.5, streetY, -1.925);
  addFlatBox(group, materials.asphalt, 20, 0.04, 2.7, 0, streetY, 7.5);

  makeCurbInstances(group, materials);
  makeTreePits(group, materials);
  makeRoadDetails(group, materials);
  makeGarden(group, materials);

  return group;
}
