import * as THREE from 'three';
import { WORLD, TREE_CONFIGS } from './worldConfig.js';
import {
  clamp,
  makeContactShadowTexture,
  mulberry32,
  rand,
  TAU,
} from './utils.js';
import { getBlossomGeometry } from './trees.js';

const B = WORLD.building;

const PETAL_COLORS = [
  '#8a72ba',
  '#a189ca',
  '#b8a1da',
  '#ccb7e7',
  '#9981c4',
  '#d8c8ef',
];

function insideBuilding(x, z, margin = 0) {
  if (
    x < B.left - margin ||
    x > B.right + margin ||
    z < B.back - margin ||
    z > B.front + margin
  ) {
    return false;
  }
  if (x > B.cornerX && z > B.cornerZ) {
    return Math.hypot(x - B.cornerX, z - B.cornerZ) <= B.cornerRadius + margin;
  }
  return true;
}

function surfaceHeightAt(x, z) {
  if (Math.abs(x) > 9.92 || Math.abs(z) > 9.92) return null;
  if (insideBuilding(x, z, 0.05)) return null;
  const nearWalk =
    x > -7.3 && x < 6.15 && z > -7.3 && z < 6.15;
  if (nearWalk) return WORLD.sidewalkY + 0.012;
  const frontFar = z >= 8.85;
  const rightFar = x >= 8.85;
  if (frontFar || rightFar) return WORLD.farWalkY + 0.012;
  const frontRoad = z >= 6.15 && z < 8.85;
  const rightRoad = x >= 6.15 && x < 8.85;
  if (frontRoad || rightRoad) return 0.058;
  const inGarden =
    (x < -7.3 && z < 6.15) || (z < -7.3 && x < 6.15);
  if (inGarden) return WORLD.gardenY + 0.012;
  return 0.038;
}

function makePetalGeometry() {
  const positions = [
    -0.012, 0.0, 0,
    0.012, 0.0, 0,
    0.032, 0.038, 0.01,
    -0.032, 0.038, 0.01,
    0.026, 0.075, 0.006,
    -0.026, 0.075, 0.006,
    0.0, 0.105, -0.012,
  ];
  const indices = [
    0, 2, 1, 0, 3, 2,
    2, 3, 4, 3, 5, 4,
    4, 5, 6,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function flatQuaternion(normal, roll, tiltX = 0, tiltZ = 0) {
  const n = normal
    .clone()
    .add(new THREE.Vector3(tiltX, 0, tiltZ))
    .normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    n,
  );
  const rollQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    roll,
  );
  quaternion.multiply(rollQuat);
  return quaternion;
}

function collectStaticPetals() {
  const petals = [];
  const rng = mulberry32(81937);
  const colorPool = PETAL_COLORS.map((color) => new THREE.Color(color));
  const randomColor = () =>
    colorPool[Math.floor(rng() * colorPool.length)].clone();

  const push = (x, z, y, options = {}) => {
    const scale = options.scale ?? rand(rng, 0.75, 1.35);
    const normal = options.normal ?? new THREE.Vector3(0, 1, 0);
    petals.push({
      position: new THREE.Vector3(x, y, z),
      quaternion:
        options.quaternion ??
        flatQuaternion(
          normal,
          rng() * TAU,
          rand(rng, -0.2, 0.2),
          rand(rng, -0.2, 0.2),
        ),
      scale,
      color: options.color ?? randomColor(),
    });
  };

  // Drifts beneath every tree.
  TREE_CONFIGS.forEach((tree, treeIndex) => {
    let added = 0;
    let attempts = 0;
    while (added < 54 && attempts < 500) {
      attempts += 1;
      const angle = rng() * TAU;
      const radius = 0.52 + Math.sqrt(rng()) * 3.1;
      const x = tree.x + Math.cos(angle) * radius;
      const z = tree.z + Math.sin(angle) * radius;
      const y = surfaceHeightAt(x, z);
      if (y === null) continue;
      const falloff = 1 - clamp((radius - 0.55) / 3.1, 0, 1);
      if (rng() > 0.22 + falloff * 0.9) continue;
      push(x, z, y + 0.002, {
        scale: rand(rng, 0.72, 1.18),
      });
      added += 1;
    }
    // A tighter spill right at the tree pit.
    for (let i = 0; i < 12; i += 1) {
      const angle = rng() * TAU;
      const radius = tree.pit * 0.62 + rng() * 0.24;
      const x = tree.x + Math.cos(angle) * radius;
      const z = tree.z + Math.sin(angle) * radius;
      const y = surfaceHeightAt(x, z);
      if (y !== null) push(x, z, y + 0.003, { scale: rand(rng, 0.72, 1.1) });
    }

    // A few petals rest on the violet bench.
    if (treeIndex === 0) {
      for (let i = 0; i < 7; i += 1) {
        push(
          0.23 + rng() * 1.55,
          4.35 + rng() * 0.48,
          WORLD.sidewalkY + 0.469,
          { scale: rand(rng, 0.65, 0.95) },
        );
      }
    }
  });

  // Denser lines along the kerbs.
  for (let i = 0; i < 68; i += 1) {
    const x = rand(rng, -9.4, 5.8);
    const z = 5.82 + rng() * 0.4;
    const y = surfaceHeightAt(x, z);
    if (y !== null) push(x, z, y + 0.002, { scale: rand(rng, 0.6, 1.05) });
  }
  for (let i = 0; i < 56; i += 1) {
    const x = 5.82 + rng() * 0.4;
    const z = rand(rng, -7.0, 5.6);
    const y = surfaceHeightAt(x, z);
    if (y !== null) push(x, z, y + 0.002, { scale: rand(rng, 0.6, 1.05) });
  }

  // The rest of the paving gets an occasional petal, never a carpet.
  for (let i = 0; i < 120; i += 1) {
    const x = rand(rng, -9.4, 9.4);
    const z = rand(rng, -9.4, 9.6);
    const y = surfaceHeightAt(x, z);
    if (y === null) continue;
    const nearTree = TREE_CONFIGS.some(
      (tree) => Math.hypot(tree.x - x, tree.z - z) < 3.6,
    );
    if (!nearTree && rng() < 0.55) continue;
    push(x, z, y + 0.002, { scale: rand(rng, 0.6, 1.0) });
  }

  // Lower window sills.
  [
    [-3.92, 4.34, null],
    [-1.86, 4.34, null],
    [4.925, -1.75, Math.PI / 2],
    [4.925, -3.87, Math.PI / 2],
  ].forEach(([u, v, rotation]) => {
    for (let i = 0; i < 3; i += 1) {
      const x = rotation ? u + rand(rng, -0.06, 0.06) : u + rand(rng, -0.38, 0.38);
      const z = rotation ? v + rand(rng, -0.38, 0.38) : v + rand(rng, -0.06, 0.06);
      push(x, z, 0.778 + i * 0.0012, {
        scale: rand(rng, 0.58, 0.82),
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
  });

  // Petals collected on the sloped awning above the entrance.
  const doorAngle = Math.PI / 4;
  const doorX = B.cornerX + Math.cos(doorAngle) * B.cornerRadius;
  const doorZ = B.cornerZ + Math.sin(doorAngle) * B.cornerRadius;
  const tangent = new THREE.Vector3(Math.cos(doorAngle), 0, -Math.sin(doorAngle));
  const outward = new THREE.Vector3(Math.sin(doorAngle), 0, Math.cos(doorAngle));
  const awningNormal = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 18; i += 1) {
    const u = rand(rng, -1.43, 1.43);
    const v = rand(rng, 0.12, 1.14);
    const point = new THREE.Vector3(doorX, 0, doorZ)
      .addScaledVector(tangent, u)
      .addScaledVector(outward, v);
    const y = 3.45 - Math.sin(0.19) * v + 0.045;
    push(point.x, point.z, y, {
      scale: rand(rng, 0.6, 0.88),
      normal: awningNormal,
      quaternion: flatQuaternion(
        awningNormal,
        rng() * TAU,
        rand(rng, -0.14, 0.14),
        rand(rng, -0.14, 0.14),
      ),
    });
  }

  // A few on the balcony deck.
  for (let i = 0; i < 18; i += 1) {
    const front = rng() < 0.68;
    const x = front ? rand(rng, -4.1, 2.5) : B.right + rand(rng, 0.08, 0.82);
    const z = front ? B.front + rand(rng, 0.12, 0.88) : rand(rng, -1.6, 2.0);
    push(x, z, B.balconyTop + 0.006, {
      scale: rand(rng, 0.6, 0.9),
    });
  }

  // A drift against the entrance step.
  for (let i = 0; i < 14; i += 1) {
    const point = new THREE.Vector3(doorX, 0, doorZ)
      .addScaledVector(tangent, rand(rng, -1.2, 1.2))
      .addScaledVector(outward, rand(rng, 0.35, 1.0));
    const y = surfaceHeightAt(point.x, point.z);
    if (y !== null) push(point.x, point.z, y + 0.003, { scale: rand(rng, 0.65, 0.95) });
  }

  return petals;
}

export function buildPetalSystem(scene, materials, options = {}) {
  const staticPetalMaterial = materials.petal.clone();
  staticPetalMaterial.vertexColors = false;
  const petalGeometry = makePetalGeometry();
  const staticPetals = collectStaticPetals();
  const staticMesh = new THREE.InstancedMesh(
    petalGeometry,
    staticPetalMaterial,
    staticPetals.length,
  );
  const dummy = new THREE.Object3D();
  staticPetals.forEach((petal, index) => {
    dummy.position.copy(petal.position);
    dummy.quaternion.copy(petal.quaternion);
    dummy.scale.setScalar(petal.scale);
    dummy.updateMatrix();
    staticMesh.setMatrixAt(index, dummy.matrix);
    staticMesh.setColorAt(index, petal.color);
  });
  staticMesh.castShadow = false;
  staticMesh.receiveShadow = true;
  staticMesh.instanceMatrix.needsUpdate = true;
  if (staticMesh.instanceColor) staticMesh.instanceColor.needsUpdate = true;
  staticMesh.computeBoundingSphere();
  scene.add(staticMesh);

  // A handful of whole blooms come to rest on the awning, sills, bench and
  // paving. They are deliberately sparse, but let the five-lobed flower shape
  // be read at close range.
  const fallenFlowerMaterial = materials.blossom.clone();
  fallenFlowerMaterial.vertexColors = true;
  const fallenFlowerRng = mulberry32(41873);
  const fallenFlowerData = [];
  const flowerColors = ['#b39bd9', '#c6b1e2', '#9d86c9', '#d3c2e9'].map(
    (color) => new THREE.Color(color),
  );
  const upNormal = new THREE.Vector3(0, 1, 0);
  const faceUp = (normal, roll) => {
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal.clone().normalize(),
    );
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        roll,
      ),
    );
    return quaternion;
  };
  const pushFlower = (x, z, y, normal = upNormal, scale = 1) => {
    fallenFlowerData.push({
      position: new THREE.Vector3(x, y, z),
      quaternion: faceUp(normal, fallenFlowerRng() * TAU),
      scale: rand(fallenFlowerRng, 0.72, 1.08) * scale,
      color:
        flowerColors[
          Math.floor(fallenFlowerRng() * flowerColors.length)
        ].clone(),
    });
  };

  // Grounded blooms below the nearest trees.
  TREE_CONFIGS.forEach((tree) => {
    let added = 0;
    let attempts = 0;
    while (added < 7 && attempts < 60) {
      attempts += 1;
      const angle = fallenFlowerRng() * TAU;
      const radius = 0.55 + Math.sqrt(fallenFlowerRng()) * 2.2;
      const x = tree.x + Math.cos(angle) * radius;
      const z = tree.z + Math.sin(angle) * radius;
      const y = surfaceHeightAt(x, z);
      if (y === null) continue;
      pushFlower(x, z, y + 0.012, upNormal, 1.1);
      added += 1;
    }
  });

  // Some on the low window sills.
  const sills = [
    [-3.92, 4.34],
    [-1.86, 4.34],
    [4.925, -1.75],
    [4.925, -3.87],
  ];
  sills.forEach(([x, z]) => {
    for (let i = 0; i < 2; i += 1) {
      pushFlower(
        x + rand(fallenFlowerRng, -0.3, 0.3),
        z + rand(fallenFlowerRng, -0.04, 0.04),
        0.785 + i * 0.003,
        upNormal,
        0.66,
      );
    }
  });

  // A few on the sloping entrance awning.
  const doorAt = Math.PI / 4;
  const doorX = B.cornerX + Math.cos(doorAt) * B.cornerRadius;
  const doorZ = B.cornerZ + Math.sin(doorAt) * B.cornerRadius;
  const tangent = new THREE.Vector3(Math.cos(doorAt), 0, -Math.sin(doorAt));
  const outward = new THREE.Vector3(Math.sin(doorAt), 0, Math.cos(doorAt));
  const awningNormal = new THREE.Vector3(0, 1, 0)
    .multiplyScalar(Math.cos(0.19))
    .addScaledVector(outward, Math.sin(0.19))
    .normalize();
  for (let i = 0; i < 10; i += 1) {
    const u = rand(fallenFlowerRng, -1.35, 1.35);
    const v = rand(fallenFlowerRng, 0.12, 1.1);
    const point = new THREE.Vector3(doorX, 0, doorZ)
      .addScaledVector(tangent, u)
      .addScaledVector(outward, v);
    const y = 3.45 - Math.sin(0.19) * v + 0.055;
    pushFlower(point.x, point.z, y, awningNormal, 0.75);
  }

  // A couple of fallen flowers resting on the violet bench.
  for (let i = 0; i < 3; i += 1) {
    pushFlower(
      0.45 + fallenFlowerRng() * 1.25,
      4.43 + fallenFlowerRng() * 0.34,
      WORLD.sidewalkY + 0.485,
      upNormal,
      0.7,
    );
  }

  // And a few on the balcony slab.
  for (let i = 0; i < 6; i += 1) {
    const front = fallenFlowerRng() < 0.65;
    pushFlower(
      front ? rand(fallenFlowerRng, -4.0, 2.35) : B.right + rand(fallenFlowerRng, 0.1, 0.8),
      front ? B.front + rand(fallenFlowerRng, 0.16, 0.82) : rand(fallenFlowerRng, -1.5, 1.9),
      B.balconyTop + 0.014,
      upNormal,
      0.75,
    );
  }

  const fallenFlowerMesh = new THREE.InstancedMesh(
    getBlossomGeometry(),
    fallenFlowerMaterial,
    fallenFlowerData.length,
  );
  fallenFlowerData.forEach((flower, index) => {
    dummy.position.copy(flower.position);
    dummy.quaternion.copy(flower.quaternion);
    dummy.scale.setScalar(flower.scale);
    dummy.updateMatrix();
    fallenFlowerMesh.setMatrixAt(index, dummy.matrix);
    fallenFlowerMesh.setColorAt(index, flower.color);
  });
  fallenFlowerMesh.castShadow = false;
  fallenFlowerMesh.receiveShadow = false;
  fallenFlowerMesh.instanceMatrix.needsUpdate = true;
  if (fallenFlowerMesh.instanceColor) fallenFlowerMesh.instanceColor.needsUpdate = true;
  fallenFlowerMesh.computeBoundingSphere();
  scene.add(fallenFlowerMesh);

  const fallingCount = options.fallingCount ?? 170;
  const fallingMaterial = materials.petal.clone();
  fallingMaterial.vertexColors = false;
  const fallingMesh = new THREE.InstancedMesh(
    petalGeometry,
    fallingMaterial,
    fallingCount,
  );
  fallingMesh.castShadow = false;
  fallingMesh.receiveShadow = false;
  fallingMesh.frustumCulled = false;
  fallingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const colorPool = PETAL_COLORS.map((color) => new THREE.Color(color));
  const random = mulberry32(48812);
  const particles = [];
  const treeRng = mulberry32(9014);

  const findSpawn = (tree, randomWithinCrown = true) => {
    const angle = treeRng() * TAU;
    const radius = Math.sqrt(treeRng()) * tree.spread * 0.9;
    const x = tree.x + Math.cos(angle) * radius;
    const z = tree.z + Math.sin(angle) * radius;
    const y = randomWithinCrown
      ? tree.height * (0.5 + treeRng() * 0.45 - treeRng() * 0.18)
      : tree.height * (0.85 + treeRng() * 0.3);
    return new THREE.Vector3(x, y, z);
  };

  for (let i = 0; i < fallingCount; i += 1) {
    const tree = TREE_CONFIGS[Math.floor(random() * TREE_CONFIGS.length)];
    const position = findSpawn(tree, true);
    const spin = new THREE.Euler(random() * TAU, random() * TAU, random() * TAU);
    particles.push({
      position,
      homeTree: tree,
      spin,
      spinSpeed: new THREE.Vector3(
        rand(random, -1.8, 1.8),
        rand(random, -1.4, 1.4),
        rand(random, -1.8, 1.8),
      ),
      fallSpeed: rand(random, 0.17, 0.34),
      swayPhase: random() * TAU,
      swayAmp: rand(random, 0.15, 0.45),
      swaySpeed: rand(random, 0.5, 1.1),
      scale: rand(random, 0.6, 1.05),
      color: colorPool[Math.floor(random() * colorPool.length)].clone(),
      active: true,
      burst: false,
      delay: 0,
    });
    fallingMesh.setColorAt(i, particles[i].color);
  }
  if (fallingMesh.instanceColor) fallingMesh.instanceColor.needsUpdate = true;
  scene.add(fallingMesh);

  let burstIndex = 0;
  const tmpQuat = new THREE.Quaternion();
  const groundRng = mulberry32(2345);

  const triggerBurst = (worldCenter, radius = 2.4, count = 56) => {
    for (let i = 0; i < count; i += 1) {
      const particle = particles[(burstIndex + i) % particles.length];
      const angle = groundRng() * TAU;
      const r = Math.sqrt(groundRng()) * radius;
      particle.position.set(
        worldCenter.x + Math.cos(angle) * r,
        worldCenter.y + (groundRng() - 0.35) * radius * 0.6,
        worldCenter.z + Math.sin(angle) * r,
      );
      particle.homeTree =
        TREE_CONFIGS.find(
          (tree) =>
            Math.hypot(
              tree.x - worldCenter.x,
              tree.z - worldCenter.z,
            ) < 3.8,
        ) ?? particle.homeTree;
      particle.spin.set(
        groundRng() * TAU,
        groundRng() * TAU,
        groundRng() * TAU,
      );
      particle.spinSpeed.set(
        rand(groundRng, -1.9, 1.9),
        rand(groundRng, -1.4, 1.4),
        rand(groundRng, -1.9, 1.9),
      );
      particle.fallSpeed = rand(groundRng, 0.25, 0.42);
      particle.burst = true;
      particle.active = true;
      particle.delay = rand(groundRng, 0, 0.45);
      particle.scale = rand(groundRng, 1.15, 1.72);
      fallingMesh.setColorAt(
        (burstIndex + i) % particles.length,
        particle.color,
      );
    }
    burstIndex = (burstIndex + count) % particles.length;
    fallingMesh.instanceColor.needsUpdate = true;
  };

  const update = (delta, elapsed) => {
    const dt = Math.min(delta, 0.05);
    particles.forEach((particle, index) => {
      if (particle.delay > 0) {
        particle.delay -= dt;
      }
      const sway =
        Math.sin(elapsed * particle.swaySpeed + particle.swayPhase) *
        particle.swayAmp *
        dt;
      if (particle.active) {
        particle.position.y -= particle.fallSpeed * dt;
        particle.position.x += sway;
        particle.position.z += Math.cos(elapsed * particle.swaySpeed * 0.83 + particle.swayPhase) * particle.swayAmp * 0.6 * dt;
        particle.spin.x += particle.spinSpeed.x * dt;
        particle.spin.y += particle.spinSpeed.y * dt;
        particle.spin.z += particle.spinSpeed.z * dt;
        const surface = surfaceHeightAt(particle.position.x, particle.position.z);
        const threshold = surface === null ? 0.03 : surface + 0.02;
        if (particle.position.y < threshold) {
          if (particle.burst) {
            particle.active = false;
            particle.delay = rand(groundRng, 1.2, 4.2);
          } else {
            const spawn = findSpawn(
              TREE_CONFIGS[Math.floor(groundRng() * TREE_CONFIGS.length)],
              false,
            );
            particle.position.copy(spawn);
            particle.burst = false;
            particle.fallSpeed = rand(groundRng, 0.17, 0.34);
          }
        }
      } else if (particle.delay <= 0) {
        const spawn = findSpawn(
          TREE_CONFIGS[Math.floor(groundRng() * TREE_CONFIGS.length)],
          true,
        );
        particle.position.copy(spawn);
        particle.active = true;
        particle.burst = false;
        particle.fallSpeed = rand(groundRng, 0.17, 0.34);
      }
      if (!particle.active) {
        dummy.scale.setScalar(0);
      } else {
        dummy.scale.setScalar(particle.scale);
      }
      dummy.position.copy(particle.position);
      tmpQuat.setFromEuler(particle.spin);
      dummy.quaternion.copy(tmpQuat);
      dummy.updateMatrix();
      fallingMesh.setMatrixAt(index, dummy.matrix);
    });
    fallingMesh.instanceMatrix.needsUpdate = true;
  };

  // Prime matrices.
  update(0.016, 0);

  return {
    staticMesh,
    fallingMesh,
    triggerBurst,
    update,
    staticCount: staticPetals.length,
    fallenFlowerCount: fallenFlowerData.length,
    fallenFlowerMesh,
    fallingCount,
  };
}

function addBaseShadow(scene, materials) {
  const map = makeContactShadowTexture();
  const material = new THREE.MeshBasicMaterial({
    map,
    color: '#2c2730',
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(25.5, 25.5), material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.625;
  scene.add(plane);
}

export { addBaseShadow };
