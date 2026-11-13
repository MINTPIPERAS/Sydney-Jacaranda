import * as THREE from 'three';
import { WORLD, TREE_CONFIGS } from './worldConfig.js';
import {
  clamp,
  lerp,
  mergeParts,
  mulberry32,
  rand,
  randInt,
  TAU,
  taperedBranchGeometry,
} from './utils.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const FLOWER_FORWARD = new V3(0, 0, 1);
const SUN_LOCAL = new V3(-0.42, 0.82, 0.36).normalize();
const B = WORLD.building;

const BLOSSOM_PALETTES = [
  ['#5a4290', '#7b62b4', '#a18ad2', '#cbb8e8', '#e4d8f4'],
  ['#4f4d8d', '#6b62ad', '#9281c8', '#bcaadd', '#ded0f0'],
  ['#61458e', '#8067b2', '#a98fd1', '#d0bce6', '#e8dcf3'],
];
const CAMERA_DIR_LOCAL = new V3(0.62, 0.16, 0.77).normalize();

/* ------------------------------------------------------------------ */
/* Reusable botanical geometry                                         */
/* ------------------------------------------------------------------ */

let blossomGeometry;
let leafSprayGeometry;

export function getBlossomGeometry() {
  if (blossomGeometry) return blossomGeometry;

  const positions = [];
  const colors = [];
  const indices = [];

  const push = (x, y, z, brightness) => {
    positions.push(x, y, z);
    colors.push(brightness, brightness * 0.97, brightness * 1.04);
    return positions.length / 3 - 1;
  };

  // The narrow trumpet throat.
  const segments = 8;
  const rings = [
    [-0.078, 0.009, 0.3],
    [-0.044, 0.019, 0.44],
    [-0.004, 0.032, 0.7],
  ];
  const ringIndices = [];
  rings.forEach(([z, radius, brightness]) => {
    const ring = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * TAU;
      ring.push(
        push(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          z,
          brightness,
        ),
      );
    }
    ringIndices.push(ring);
  });
  for (let r = 0; r < rings.length - 1; r += 1) {
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % segments;
      indices.push(
        ringIndices[r][i],
        ringIndices[r + 1][i],
        ringIndices[r][j],
        ringIndices[r][j],
        ringIndices[r + 1][i],
        ringIndices[r + 1][j],
      );
    }
  }
  const baseCenter = push(0, 0, -0.08, 0.3);
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    indices.push(baseCenter, ringIndices[0][i], ringIndices[0][j]);
  }

  // Five five-lobed petals, each opening asymmetrically.
  const petalCount = 5;
  const LENGTH_SEGMENTS = 2;
  const WIDTH_SEGMENTS = 1;
  for (let petal = 0; petal < petalCount; petal += 1) {
    const petalAngle = (petal / petalCount) * TAU + 0.04;
    const grid = [];
    for (let i = 0; i <= LENGTH_SEGMENTS; i += 1) {
      const t = i / LENGTH_SEGMENTS;
      const radius = 0.031 + 0.078 * t;
      const spread = lerp(0.17, 0.034, Math.pow(t, 2.25)) + 0.025 * Math.sin(t * Math.PI);
      const z = 0.006 + 0.031 * Math.sin(t * Math.PI * 0.94) + 0.008 * t;
      const row = [];
      for (let j = 0; j <= WIDTH_SEGMENTS; j += 1) {
        const lateral = (j / WIDTH_SEGMENTS - 0.5) * 2;
        const angle = petalAngle + lateral * spread;
        const brightness = 0.72 + t * 0.34;
        row.push(
          push(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            z - Math.abs(lateral) * 0.008 * t,
            brightness,
          ),
        );
      }
      grid.push(row);
    }
    for (let i = 0; i < LENGTH_SEGMENTS; i += 1) {
      for (let j = 0; j < WIDTH_SEGMENTS; j += 1) {
        const a = grid[i][j];
        const b = grid[i + 1][j];
        const c = grid[i + 1][j + 1];
        const d = grid[i][j + 1];
        indices.push(a, b, d, b, c, d);
      }
    }
  }

  // A luminous little throat.
  const center = push(0, 0, 0.024, 1.03);
  const throatRadius = 0.011;
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * TAU;
    const next = ((i + 1) / 6) * TAU;
    const a = push(
      Math.cos(angle) * throatRadius,
      Math.sin(angle) * throatRadius,
      0.016,
      1.08,
    );
    const b = push(
      Math.cos(next) * throatRadius,
      Math.sin(next) * throatRadius,
      0.016,
      1.08,
    );
    indices.push(center, a, b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  blossomGeometry = geometry;
  return geometry;
}

function getLeafSprayGeometry() {
  if (leafSprayGeometry) return leafSprayGeometry;
  const positions = [];
  const indices = [];
  const addQuad = (a, b, c, d) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  // Stem.
  addQuad(
    [-0.004, 0, 0],
    [0.004, 0, 0],
    [0.004, 0.37, 0],
    [-0.004, 0.37, 0],
  );
  const pairs = [0.065, 0.115, 0.165, 0.215, 0.265, 0.315];
  pairs.forEach((y, pairIndex) => {
    const spread = 0.082 - pairIndex * 0.0085;
    for (const sign of [-1, 1]) {
      const baseX = sign * 0.012;
      const tipX = sign * spread;
      const baseY = y;
      const tipY = y + 0.056 - pairIndex * 0.0045;
      addQuad(
        [baseX, baseY, 0],
        [tipX, baseY + 0.02, 0.006],
        [tipX + sign * 0.023, tipY + 0.018, -0.003],
        [baseX + sign * 0.012, tipY, 0],
      );
    }
  });
  // A small terminal leaflet closes the frond.
  addQuad(
    [-0.012, 0.325, 0],
    [0.012, 0.325, 0],
    [0.026, 0.39, 0.004],
    [-0.026, 0.39, 0.004],
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  leafSprayGeometry = geometry;
  return geometry;
}

/* ------------------------------------------------------------------ */
/* Tree growth                                                          */
/* ------------------------------------------------------------------ */

function insideFootprint(x, z, margin = 0) {
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

function insideBalconyEnvelope(x, z, y, margin) {
  if (y < B.balconyTop - 0.25 || y > B.balconyTop + 1.15 + margin) {
    return false;
  }
  const extent = B.balconyExtent;
  if (
    x > -4.52 - margin &&
    x < B.cornerX + margin &&
    z > B.front - 0.1 &&
    z < B.front + extent + margin + 0.06
  ) {
    return true;
  }
  if (
    x > B.right - 0.1 &&
    x < B.right + extent + margin + 0.06 &&
    z > -1.92 - margin &&
    z < B.cornerZ + margin
  ) {
    return true;
  }
  if (x > B.cornerX && z > B.cornerZ) {
    const distance = Math.hypot(x - B.cornerX, z - B.cornerZ);
    if (
      distance > B.cornerRadius - 0.04 &&
      distance < B.cornerRadius + extent + margin + 0.06
    ) {
      return true;
    }
  }
  return false;
}

function buildJacaranda(cfg, index, materials, canopyGeometry) {
  const random = mulberry32(cfg.seed);
  const group = new THREE.Group();
  group.name = `jacaranda-${cfg.id}`;
  group.position.set(cfg.x, cfg.groundY + 0.008, cfg.z);
  group.userData.treeIndex = index;
  group.userData.treeId = cfg.id;

  const barkParts = [];
  const bloomData = [];
  const leafData = [];
  const canopyPoints = [];
  const branchTips = [];
  const H = cfg.height;
  const palette = BLOSSOM_PALETTES[cfg.palette % BLOSSOM_PALETTES.length].map(
    (color) => new THREE.Color(color),
  );

  const blockedWorld = (x, z, y, margin) => {
    if (y < B.parapetTop + 0.12 && insideFootprint(x, z, margin + 0.11)) {
      return true;
    }
    if (insideBalconyEnvelope(x, z, y, margin + 0.04)) return true;
    if (
      y > 3.02 &&
      y < 3.72 &&
      insideFootprint(x, z, margin + 0.42) &&
      x > 2.2 &&
      z > 2.1
    ) {
      // Keep the awning pocket legible from the street.
      return true;
    }
    return false;
  };

  const fixedStretch = cfg.verticalScale ?? null;
  const blockedLocal = (point, radius = 0.02) =>
    blockedWorld(
      cfg.x + point.x,
      cfg.z + point.z,
      cfg.groundY + point.y * (fixedStretch ?? 1),
      radius,
    );

  const trunkHeight = H * rand(random, 0.46, 0.54);
  const trunkBaseRadius = 0.18 + H * 0.013 + random() * 0.022;
  const trunkEndRadius = trunkBaseRadius * rand(random, 0.37, 0.49);
  const phase = random() * TAU;

  const trunkControl = [];
  for (let i = 0; i < 6; i += 1) {
    const t = i / 5;
    const x =
      cfg.trunkLean[0] * trunkHeight * 0.42 * (0.1 + 0.9 * t) +
      Math.sin(t * 2.8 + phase) * trunkHeight * 0.028 * (1 - Math.abs(t - 0.5));
    const z =
      cfg.trunkLean[1] * trunkHeight * 0.42 * (0.1 + 0.9 * t) +
      Math.cos(t * 2.1 + phase * 0.7) * trunkHeight * 0.024 * (1 - Math.abs(t - 0.5));
    trunkControl.push(
      new V3(
        x + (i === 0 ? 0 : rand(random, -0.026, 0.026)),
        t === 0 ? 0.0 : trunkHeight * t,
        z + (i === 0 ? 0 : rand(random, -0.026, 0.026)),
      ),
    );
  }
  const trunkCurve = new THREE.CatmullRomCurve3(
    trunkControl,
    false,
    'catmullrom',
    0.46,
  );
  barkParts.push(
    taperedBranchGeometry(trunkControl, {
      radiusStart: trunkBaseRadius,
      radiusEnd: trunkEndRadius,
      radialSegments: 9,
      segments: 14,
      color: new THREE.Color('#36261f'),
      colorEnd: new THREE.Color('#4b362b'),
      twist: rand(random, -0.3, 0.4),
      taperPower: 1.25,
    }),
  );

  // A few radial roots flare over the tree grate and make the trunk feel planted.
  const rootCount = randInt(random, 4, 6);
  for (let i = 0; i < rootCount; i += 1) {
    const angle = (i / rootCount) * TAU + rand(random, -0.35, 0.35);
    const length = rand(random, 0.26, 0.43);
    const reach = new V3(
      Math.cos(angle) * length,
      0.01,
      Math.sin(angle) * length,
    );
    const start = new V3(
      Math.cos(angle) * 0.05,
      rand(random, 0.15, 0.3),
      Math.sin(angle) * 0.05,
    );
    const mid = new V3(
      Math.cos(angle) * length * 0.55,
      rand(random, 0.06, 0.14),
      Math.sin(angle) * length * 0.55,
    );
    barkParts.push(
      taperedBranchGeometry([start, mid, reach], {
        radiusStart: trunkBaseRadius * rand(random, 0.28, 0.42),
        radiusEnd: 0.018,
        radialSegments: 6,
        segments: 5,
        color: new THREE.Color('#33241e'),
        colorEnd: new THREE.Color('#453027'),
      }),
    );
  }

  const radiusAt = (t) =>
    lerp(trunkBaseRadius, trunkEndRadius, Math.pow(t, 1.25));

  const addBloomCluster = (position, direction, density = 1, depth = 3, ignoreBlocking = false) => {
    if (!ignoreBlocking && blockedLocal(position, 0.035)) return;
    const count = Math.max(
      3,
      Math.round(randInt(random, 3, depth >= 4 ? 5 : 6) * density),
    );
    const tangent = direction.clone().normalize();
    const clusterCenter = position
      .clone()
      .addScaledVector(tangent, rand(random, -0.04, 0.12))
      .add(
        new V3(
          rand(random, -0.06, 0.06),
          rand(random, -0.1, 0.03),
          rand(random, -0.06, 0.06),
        ),
      );
    const size = rand(random, 0.17, 0.33) * (depth >= 3 ? 1 : 1.1);
    for (let i = 0; i < count; i += 1) {
      let offset;
      if (i < count * 0.35) {
        offset = new V3(
          rand(random, -0.035, 0.035),
          rand(random, -0.025, 0.035),
          rand(random, -0.035, 0.035),
        );
      } else {
        offset = new V3(
          tangent.x * rand(random, 0.05, 0.34) + rand(random, -0.7, 0.7),
          tangent.y * rand(random, 0.02, 0.25) + rand(random, -0.72, 0.5),
          tangent.z * rand(random, 0.05, 0.34) + rand(random, -0.7, 0.7),
        )
          .normalize()
          .multiplyScalar(size * Math.cbrt(random()));
      }
      const position2 = clusterCenter.clone().add(offset);
      if (blockedLocal(position2, 0.025)) continue;
      const radial = new V3(position2.x, 0, position2.z);
      if (radial.lengthSq() < 0.0001) radial.set(rand(random, -1, 1), 0, rand(random, -1, 1));
      radial.normalize();
      const downward = random() < 0.3;
      const face = new V3(
        radial.x * rand(random, 0.3, 0.8) +
          tangent.x * 0.2 +
          CAMERA_DIR_LOCAL.x * 0.22 +
          rand(random, -0.38, 0.38),
        downward
          ? rand(random, -0.9, -0.22)
          : rand(random, -0.15, 0.48),
        radial.z * rand(random, 0.3, 0.8) +
          tangent.z * 0.2 +
          CAMERA_DIR_LOCAL.z * 0.22 +
          rand(random, -0.38, 0.38),
      ).normalize();
      const faceQuat = new THREE.Quaternion().setFromUnitVectors(
        FLOWER_FORWARD,
        face,
      );
      const roll = new THREE.Quaternion().setFromAxisAngle(
        FLOWER_FORWARD,
        random() * TAU,
      );
      faceQuat.multiply(roll);
      const scale = rand(random, 0.82, 1.16) * (H / 8.6) ** 0.15;
      const matrix = new THREE.Matrix4().compose(
        position2,
        faceQuat,
        new V3(scale, scale * rand(random, 0.9, 1.08), scale),
      );
      const sunLit = face.dot(SUN_LOCAL);
      const inner = 1 - clamp(offset.length() / Math.max(0.12, size), 0, 1);
      const colorIndex = clamp(
        0.34 + sunLit * 0.46 + (1 - inner) * 0.16 + rand(random, -0.12, 0.23),
        0,
        1,
      );
      const baseLow = palette[0].clone();
      const baseHigh = palette[3].clone();
      const tint = baseLow.lerp(baseHigh, colorIndex);
      if (random() < 0.09 + sunLit * 0.16) {
        tint.lerp(palette[4], rand(random, 0.12, 0.46));
      }
      bloomData.push({ matrix, color: tint });
      canopyPoints.push(position2);
    }
  };

  const addLeafSpray = (position, direction) => {
    if (leafData.length > 430) return;
    if (random() < 0.045) return;
    if (blockedLocal(position, 0.03)) return;
    const dir = direction
      .clone()
      .add(new V3(rand(random, -0.6, 0.6), rand(random, -0.2, 0.4), rand(random, -0.6, 0.6)))
      .normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new V3(0, 1, 0),
      dir,
    );
    const roll = new THREE.Quaternion().setFromAxisAngle(
      new V3(0, 1, 0),
      random() * TAU,
    );
    quaternion.multiply(roll);
    const scale = rand(random, 0.86, 1.5);
    const matrix = new THREE.Matrix4().compose(
      position,
      quaternion,
      new V3(scale, scale * rand(random, 0.8, 1.25), scale),
    );
    leafData.push({
      matrix,
      color: new THREE.Color().setHSL(
        0.25 + random() * 0.05,
        0.2 + random() * 0.1,
        0.25 + random() * 0.12,
      ),
    });
  };

  const growBranch = (
    start,
    initialDirection,
    length,
    radiusStart,
    radiusEnd,
    depth,
    parentCurve = null,
  ) => {
    const steps = depth === 0 ? 5 : depth === 1 ? 4 : 3;
    const direction = initialDirection.clone().normalize();
    const norm = Math.hypot(direction.x, direction.z) || 1;
    const outward = new V3(direction.x / norm, 0, direction.z / norm);
    const control = [start.clone()];
    let current = start.clone();
    let stopped = false;

    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      direction.x +=
        cfg.bias[0] * 0.024 +
        rand(random, -0.15, 0.15) +
        outward.x * 0.025;
      direction.z +=
        cfg.bias[2] * 0.024 +
        rand(random, -0.15, 0.15) +
        outward.z * 0.025;
      direction.y += depth < 2 ? 0.035 : -0.055;
      const useSwayCap = 0.94 - depth * 0.05;
      direction.normalize();
      direction.y = clamp(direction.y, -0.4, useSwayCap);
      direction.normalize();
      const next = current.clone().addScaledVector(direction, length / steps);
      if (blockedLocal(next, 0.12 + radiusEnd * 1.5)) {
        stopped = true;
        break;
      }
      control.push(next);
      current = next;
    }

    if (control.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(
      control,
      false,
      'catmullrom',
      0.42,
    );
    const barkColorStart = new THREE.Color(
      depth === 0 ? '#473129' : depth === 1 ? '#4d392e' : '#584237',
    );
    const barkColorEnd = new THREE.Color(
      depth >= 2 ? '#6a5342' : '#503b30',
    );
    barkParts.push(
      taperedBranchGeometry(control, {
        radiusStart,
        radiusEnd,
        radialSegments: depth === 0 ? 7 : depth === 1 ? 6 : 5,
        segments: Math.max(5, steps * 3),
        color: barkColorStart,
        colorEnd: barkColorEnd,
        twist: rand(random, -0.35, 0.35),
        taperPower: 1.08,
      }),
    );
    canopyPoints.push(curve.getPoint(1));

    if (depth === 2) {
      branchTips.push({ position: curve.getPoint(1), tangent: curve.getTangent(1) });
      const clusterT = stopped ? 0.8 : rand(random, 0.52, 0.92);
      if (random() < 0.8 * cfg.flowerDensity) {
        addBloomCluster(
          curve.getPoint(clusterT),
          curve.getTangent(clusterT),
          cfg.flowerDensity,
          depth,
        );
      }
      if (random() < 0.4) {
        addBloomCluster(
          curve.getPoint(stopped ? 0.94 : 1),
          curve.getTangent(stopped ? 0.94 : 1),
          cfg.flowerDensity * 0.62,
          3,
        );
      }
    }

    if (depth === 3) {
      branchTips.push({ position: curve.getPoint(1), tangent: curve.getTangent(1) });
      // Divide the last twig into a few airy pedicels. This is what makes the
      // outermost blossom layer read as sprays rather than a single grape-like ball.
      const pedicelCount = 3;
      for (let pedicelIndex = 0; pedicelIndex < pedicelCount; pedicelIndex += 1) {
        const startT = clamp(
          0.34 + (pedicelIndex / Math.max(1, pedicelCount - 1)) * 0.54 +
            rand(random, -0.08, 0.08),
          0.2,
          0.94,
        );
        const startPoint = curve.getPoint(startT);
        const tangent = curve.getTangent(startT).normalize();
        const side = new V3().crossVectors(UP, tangent).normalize();
        const radial = new V3(startPoint.x, 0, startPoint.z);
        if (radial.lengthSq() < 0.0001) radial.set(rand(random, -1, 1), 0, rand(random, -1, 1));
        radial.normalize();
        const direction = new V3()
          .addScaledVector(tangent, rand(random, 0.25, 0.62))
          .addScaledVector(radial, rand(random, 0.18, 0.5))
          .addScaledVector(UP, rand(random, -0.35, 0.18))
          .addScaledVector(side, rand(random, -0.45, 0.45))
          .normalize();
        const pedicelLength = rand(random, 0.16, 0.34);
        const mid = startPoint.clone().addScaledVector(direction, pedicelLength * 0.55);
        mid.y -= pedicelLength * rand(random, 0.02, 0.12);
        const end = mid
          .clone()
          .addScaledVector(
            direction
              .clone()
              .add(new V3(rand(random, -0.2, 0.2), -rand(random, 0.06, 0.24), rand(random, -0.2, 0.2)))
              .normalize(),
            pedicelLength * 0.45,
          );
        if (blockedLocal(mid, 0.025) || blockedLocal(end, 0.04)) continue;
        barkParts.push(
          taperedBranchGeometry([startPoint, mid, end], {
            radiusStart: 0.009,
            radiusEnd: 0.0038,
            radialSegments: 4,
            segments: 4,
            color: new THREE.Color('#5b4335'),
            colorEnd: new THREE.Color('#725747'),
            taperPower: 1.05,
          }),
        );
        canopyPoints.push(end);
        addBloomCluster(end, direction, cfg.flowerDensity * 0.72, 4);
        if (random() < 0.36) {
          addBloomCluster(mid, direction, cfg.flowerDensity * 0.45, 4);
        }
        if (random() < 0.38) {
          addLeafSpray(startPoint.lerp(end, 0.55), direction);
        }
      }
      addBloomCluster(
        curve.getPoint(stopped ? 0.92 : 1),
        curve.getTangent(stopped ? 0.92 : 1),
        cfg.flowerDensity * 0.42,
        4,
      );
      addLeafSpray(curve.getPoint(rand(random, 0.16, 0.56)), curve.getTangent(0.38));
      if (random() < 0.72) {
        addLeafSpray(curve.getPoint(rand(random, 0.4, 0.88)), curve.getTangent(0.72));
      }
    } else if (depth === 2) {
      if (random() < 0.66) {
        addLeafSpray(curve.getPoint(rand(random, 0.26, 0.76)), curve.getTangent(0.5));
      }
    } else if (depth === 1 && random() < 0.28) {
      addBloomCluster(
        curve.getPoint(0.95),
        curve.getTangent(0.95),
        cfg.flowerDensity * 0.8,
        2,
      );
    }

    if (depth < 3) {
      const childTs =
        depth === 0
          ? [0.26, 0.47, 0.67, 0.87]
          : depth === 1
            ? [0.35, 0.61, 0.85]
            : [0.52, 0.82];
      if (depth === 2 && random() < 0.32) childTs.push(0.94);
      const children = [];
      childTs.forEach((baseT, childIndex) => {
        const t = clamp(baseT + rand(random, -0.06, 0.06), 0.16, 0.96);
        const childStart = curve.getPoint(t);
        const tangent = curve.getTangent(t).normalize();
        const radial = new V3(childStart.x, 0, childStart.z);
        if (radial.lengthSq() < 0.0001) radial.set(rand(random, -1, 1), 0, rand(random, -1, 1));
        radial.normalize();
        const side = new V3().crossVectors(UP, tangent).normalize();
        const childDir = new V3()
          .addScaledVector(tangent, depth === 0 ? 0.22 : 0.36)
          .addScaledVector(radial, depth === 0 ? 0.72 : 0.52)
          .addScaledVector(UP, depth === 0 ? 0.52 : depth === 1 ? 0.37 : 0.12)
          .addScaledVector(side, rand(random, -0.52, 0.52))
          .add(
            new V3(
              cfg.bias[0] * 0.14,
              0,
              cfg.bias[2] * 0.14,
            ),
          )
          .normalize();
        const radiusHere = radiusAt(t);
        const childLength =
          length *
          (depth === 0
            ? rand(random, 0.42, 0.56)
            : depth === 1
              ? rand(random, 0.43, 0.59)
              : rand(random, 0.42, 0.58));
        const childStartRadius = Math.max(
          0.008,
          Math.min(radiusEnd * rand(random, 0.78, 1.05), radiusHere * 0.64),
        );
        const childEndRadius = Math.max(0.0045, childStartRadius * rand(random, 0.18, 0.3));
        children.push({
          start: childStart,
          dir: childDir,
          length: childLength,
          r0: childStartRadius,
          r1: childEndRadius,
          depth: depth + 1,
        });
      });
      children.forEach((child) =>
        growBranch(
          child.start,
          child.dir,
          child.length,
          child.r0,
          child.r1,
          child.depth,
          curve,
        ),
      );
    }

    // Continue thick limbs into a fine tip. This hides capped branch ends and
    // keeps every major bough connected to the blossom layer.
    if (depth < 3 && (!stopped ? depth <= 1 : true)) {
      const tip = curve.getPoint(1);
      const tipTangent = curve.getTangent(1).normalize();
      const tipRadial = new V3(tip.x, 0, tip.z);
      if (tipRadial.lengthSq() < 0.0001) {
        tipRadial.set(rand(random, -1, 1), 0, rand(random, -1, 1));
      }
      tipRadial.normalize();
      const tipSide = new V3().crossVectors(UP, tipTangent).normalize();
      let extension = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const tipLength = rand(random, 0.1, depth === 0 ? 0.34 : 0.23);
        const direction = new V3()
          .addScaledVector(tipTangent, 0.58)
          .addScaledVector(tipRadial, 0.42)
          .addScaledVector(tipSide, rand(random, -0.55, 0.55))
          .addScaledVector(UP, rand(random, -0.3, 0.2))
          .normalize();
        const mid = tip
          .clone()
          .addScaledVector(direction, tipLength * 0.55);
        mid.y -= tipLength * rand(random, 0.02, 0.16);
        const end = mid
          .clone()
          .addScaledVector(
            direction
              .clone()
              .add(new V3(rand(random, -0.15, 0.15), -rand(random, 0.04, 0.18), rand(random, -0.15, 0.15)))
              .normalize(),
            tipLength * 0.45,
          );
        if (blockedLocal(mid, 0.02) || blockedLocal(end, 0.03)) continue;
        extension = { mid, end, direction, tipLength };
        break;
      }
      if (extension) {
        const tipStartRadius = Math.max(0.007, Math.min(radiusEnd * 0.72, 0.03));
        barkParts.push(
          taperedBranchGeometry([tip, extension.mid, extension.end], {
            radiusStart: tipStartRadius,
            radiusEnd: 0.0032,
            radialSegments: 4,
            segments: 4,
            color: new THREE.Color('#5b4336'),
            colorEnd: new THREE.Color('#745948'),
            taperPower: 1,
          }),
        );
        canopyPoints.push(extension.end);
        branchTips.push({ position: extension.end, tangent: extension.direction });
        addBloomCluster(
          extension.end,
          extension.direction,
          cfg.flowerDensity * 0.48,
          4,
        );
        if (depth === 0 && random() < 0.6) {
          addBloomCluster(
            extension.mid,
            extension.direction,
            cfg.flowerDensity * 0.3,
            4,
          );
        }
        addLeafSpray(extension.mid, extension.direction);
      }
    }
  };

  // Main vase-shaped limbs, each with its own height, azimuth and fork point.
  const primaryCount = H > 9 ? 5 : 4;
  const baseAzimuth = random() * TAU;
  for (let i = 0; i < primaryCount; i += 1) {
    const t = clamp(
      0.52 + (i / primaryCount) * 0.46 + rand(random, -0.045, 0.045),
      0.43,
      0.99,
    );
    const start = trunkCurve.getPoint(t);
    const tangent = trunkCurve.getTangent(t).normalize();
    const azimuth =
      baseAzimuth + i * 2.399963 + rand(random, -0.36, 0.36);
    const outward = new V3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const lower = i === 0;
    const spreadPower = lower
      ? rand(random, 1.0, 1.22)
      : rand(random, 0.68, 0.96);
    const direction = new V3()
      .addScaledVector(outward, spreadPower)
      .addScaledVector(UP, lower ? rand(random, 0.38, 0.58) : rand(random, 0.72, 1.04))
      .addScaledVector(tangent, rand(random, 0.12, 0.3))
      .add(new V3(cfg.bias[0] * 0.16, 0, cfg.bias[2] * 0.16))
      .normalize();
    const length =
      H *
      (lower ? rand(random, 0.25, 0.31) : rand(random, 0.22, 0.275)) *
      (0.86 + cfg.spread / 7.4);
    const startRadius = Math.max(
      0.03,
      radiusAt(t) * rand(random, 0.55, 0.72),
    );
    growBranch(
      start,
      direction,
      length,
      startRadius,
      Math.max(0.022, startRadius * rand(random, 0.36, 0.48)),
      0,
    );
  }

  // A slightly taller central continuation keeps the crown from looking pruned flat.
  const leaderStart = trunkCurve.getPoint(0.96);
  growBranch(
    leaderStart,
    new V3(rand(random, -0.12, 0.12), 1, rand(random, -0.12, 0.12)).add(
      new V3(0, 0, 0),
    ),
    H * rand(random, 0.21, 0.26),
    Math.max(0.025, radiusAt(0.96) * 0.5),
    Math.max(0.017, trunkEndRadius * 0.36),
    0,
  );

  // Work out the final vertical proportion before adding the high canopy
  // bridges, so we can keep every bridge above the roof in world space.
  const bbox = new THREE.Box3();
  canopyPoints.forEach((point) => bbox.expandByPoint(point));
  if (bbox.isEmpty()) {
    bbox.setFromCenterAndSize(
      new V3(0, H * 0.7, 0),
      new V3(cfg.spread * 2, H * 0.5, cfg.spread * 2),
    );
  }
  const crownTop = bbox.max.y;
  const stretch = fixedStretch
    ? fixedStretch
    : clamp((cfg.height - 0.05) / Math.max(crownTop, 1), 1, 1.34);
  group.scale.set(1, stretch, 1);

  // A few slender, level boughs reach out from the tallest crowns. They sit
  // just above the roofline and stitch the seven crowns into one loose canopy.
  let bridgeCount = 0;
  if (H > 9.3 && !fixedStretch) {
    const roofLocal = (B.parapetTop + 0.35 - cfg.groundY) / stretch;
    const towardBuilding = new V3(-cfg.x, 0, 0.2 - cfg.z);
    if (towardBuilding.lengthSq() < 0.01) towardBuilding.set(0, 0, -1);
    towardBuilding.normalize();
    const side = new V3(-towardBuilding.z, 0, towardBuilding.x);
    const candidates = branchTips
      .filter((tip) => tip.position.y > roofLocal + 0.16)
      .sort((a, b) => {
        const aScore =
          a.position.y +
          (a.position.x * towardBuilding.x + a.position.z * towardBuilding.z) * 0.35;
        const bScore =
          b.position.y +
          (b.position.x * towardBuilding.x + b.position.z * towardBuilding.z) * 0.35;
        return bScore - aScore;
      });
    const selected = [];
    for (const candidate of candidates) {
      if (selected.length >= (H > 12 ? 3 : 2)) break;
      if (
        selected.some(
          (chosen) =>
            chosen.position.distanceTo(candidate.position) < 0.75,
        )
      ) {
        continue;
      }
      selected.push(candidate);
    }
    selected.forEach((tip, bridgeIndex) => {
      const start = tip.position.clone();
      if (start.y < roofLocal + 0.2) return;
      const length = rand(random, 1.05, 1.95);
      const lateral = rand(random, -0.55, 0.55) + (bridgeIndex % 2 ? 0.22 : -0.2);
      const upgrade = rand(random, 0.1, 0.28);
      const mid = start
        .clone()
        .addScaledVector(towardBuilding, length * 0.52)
        .addScaledVector(side, lateral * 0.35)
        .addScaledVector(UP, upgrade * 0.5);
      const end = mid
        .clone()
        .addScaledVector(towardBuilding, length * 0.48)
        .addScaledVector(side, lateral * 0.35)
        .addScaledVector(UP, upgrade);
      end.y = Math.max(end.y, roofLocal + 0.32);
      if (cfg.groundY + end.y * stretch < B.parapetTop + 0.25) return;
      const direction = end.clone().sub(start).normalize();
      barkParts.push(
        taperedBranchGeometry([start, mid, end], {
          radiusStart: 0.015,
          radiusEnd: 0.0055,
          radialSegments: 4,
          segments: 6,
          color: new THREE.Color('#503a2e'),
          colorEnd: new THREE.Color('#6b5140'),
          taperPower: 1.05,
        }),
      );
      canopyPoints.push(mid, end);
      addBloomCluster(
        mid,
        direction,
        cfg.flowerDensity * 0.72,
        4,
        true,
      );
      addBloomCluster(
        end,
        direction,
        cfg.flowerDensity * 0.8,
        4,
        true,
      );
      addLeafSpray(mid, direction);
      bridgeCount += 1;
    });
  }

  bbox.makeEmpty();
  canopyPoints.forEach((point) => bbox.expandByPoint(point));
  const center = bbox.getCenter(new V3());
  const size = bbox.getSize(new V3());

  // Merge the bark.
  const barkMesh = mergeParts(barkParts, materials.treeBark, {
    castShadow: true,
    receiveShadow: true,
  });
  if (barkMesh) group.add(barkMesh);

  // Blossoms: one draw call per tree, with colour and shape variation per instance.
  const flowerMesh = new THREE.InstancedMesh(
    getBlossomGeometry(),
    materials.blossom,
    bloomData.length,
  );
  bloomData.forEach((flower, i) => {
    flowerMesh.setMatrixAt(i, flower.matrix);
    flowerMesh.setColorAt(i, flower.color);
  });
  flowerMesh.receiveShadow = false;
  flowerMesh.castShadow = true;
  flowerMesh.instanceMatrix.needsUpdate = true;
  if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
  flowerMesh.computeBoundingSphere();
  group.add(flowerMesh);

  const leafMesh = new THREE.InstancedMesh(
    getLeafSprayGeometry(),
    materials.treeLeaf,
    leafData.length,
  );
  leafData.forEach((leaf, i) => {
    leafMesh.setMatrixAt(i, leaf.matrix);
    leafMesh.setColorAt(i, leaf.color);
  });
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = false;
  leafMesh.instanceMatrix.needsUpdate = true;
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
  group.add(leafMesh);

  // An invisible, low-poly volume provides generous crown hit targets.
  const proxy = new THREE.Mesh(canopyGeometry, materials.canopyProxy);
  proxy.position.copy(center);
  proxy.scale.set(
    Math.max(0.8, size.x * 0.53),
    Math.max(0.65, size.y * 0.55),
    Math.max(0.8, size.z * 0.53),
  );
  proxy.userData.isCanopy = true;
  proxy.userData.treeId = cfg.id;
  proxy.userData.treeIndex = index;
  proxy.name = 'canopy-hit';
  group.add(proxy);

  // Wind pivots at the trunk base, so nothing slides through the tree grate.
  group.userData.swayPhase = random() * TAU;
  group.userData.swayAmount = cfg.sway;
  group.userData.canopyCenter = center.clone();
  group.userData.canopyRadius = Math.max(size.x, size.y, size.z) * 0.5;
  group.userData.heightStretch = stretch;
  group.userData.bridgeCount = bridgeCount;
  group.userData.flowerCount = bloomData.length;
  group.userData.branchCount = barkParts.length;
  group.userData.canopy = proxy;

  return {
    group,
    config: cfg,
    barkMesh,
    flowerMesh,
    leafMesh,
    proxy,
    canopyCenter: center,
    branchCount: barkParts.length,
    flowerCount: bloomData.length,
  };
}

export function buildJacarandas(materials) {
  const canopyGeometry = new THREE.SphereGeometry(1, 12, 8);
  const trees = TREE_CONFIGS.map((cfg, index) =>
    buildJacaranda(cfg, index, materials, canopyGeometry),
  );
  const group = new THREE.Group();
  group.name = 'jacarandas';
  trees.forEach((tree) => group.add(tree.group));
  return {
    group,
    trees,
    canopyGeometry,
    totals: trees.reduce(
      (totals, tree) => ({
        flowers: totals.flowers + tree.flowerCount,
        branches: totals.branches + tree.branchCount,
      }),
      { flowers: 0, branches: 0 },
    ),
  };
}
