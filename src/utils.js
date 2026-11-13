import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (rng, min, max) => min + rng() * (max - min);
export const randInt = (rng, min, max) => Math.floor(rand(rng, min, max + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export function normalizeAngle(a) {
  return ((a % TAU) + TAU) % TAU;
}

export function disposeObject(root) {
  root.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else if (child.material) {
      child.material.dispose();
    }
  });
}

export function applyMatrixToGeometry(geometry, matrix) {
  geometry.applyMatrix4(matrix);
  return geometry;
}

export function boxPart(w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rx, ry, rz),
  );
  matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(1, 1, 1));
  geometry.applyMatrix4(matrix);
  return geometry;
}

export function cylinderBetween(a, b, radius, radialSegments = 7, radiusEnd = radius) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 0.0001) return null;
  const geometry = new THREE.CylinderGeometry(
    radiusEnd,
    radius,
    length,
    radialSegments,
    1,
    false,
  );
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  const matrix = new THREE.Matrix4().compose(
    start.clone().add(end).multiplyScalar(0.5),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

export function mergeParts(parts, material, options = {}) {
  const clean = parts.filter(Boolean);
  if (!clean.length) return null;
  const merged = mergeGeometries(clean, false);
  clean.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error('Could not merge geometry parts');
  merged.computeBoundingSphere();
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  return mesh;
}

export function tubeFromCurve(points, radius, material, options = {}) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) =>
      point.isVector3 ? point.clone() : new THREE.Vector3(...point),
    ),
    options.closed ?? false,
    'catmullrom',
    options.tension ?? 0.5,
  );
  const segments = options.segments ?? 48;
  const radialSegments = options.radialSegments ?? 5;
  const geometry = new THREE.TubeGeometry(
    curve,
    segments,
    radius,
    radialSegments,
    options.closed ?? false,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? false;
  return mesh;
}

/**
 * A tapered, capped tube used for every branch of the trees.
 * Points are actual control points on the branch skeleton.
 */
export function taperedBranchGeometry(
  controlPoints,
  {
    radiusStart = 0.1,
    radiusEnd = 0.01,
    radialSegments = 6,
    segments = 7,
    color = new THREE.Color('#44322a'),
    colorEnd = color,
    twist = 0,
    taperPower = 1.15,
  } = {},
) {
  const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.42);
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const tempColor = new THREE.Color();
  const ringCount = segments + 1;

  const startColor = color.isColor ? color : new THREE.Color(color);
  const endColor = colorEnd.isColor ? colorEnd : new THREE.Color(colorEnd);

  const pushVertex = (position, normal, u, v, t) => {
    tempColor.copy(startColor).lerp(endColor, t);
    positions.push(position.x, position.y, position.z);
    normals.push(normal.x, normal.y, normal.z);
    uvs.push(u, v);
    colors.push(tempColor.r, tempColor.g, tempColor.b);
  };

  for (let i = 0; i < ringCount; i += 1) {
    const t = i / segments;
    const point = curve.getPoint(t);
    const frameNormal = frames.normals[Math.min(i, segments)];
    const frameBinormal = frames.binormals[Math.min(i, segments)];
    const radius = lerp(radiusStart, radiusEnd, Math.pow(t, taperPower));
    const ringTwist = twist * t;
    for (let j = 0; j < radialSegments; j += 1) {
      const angle = (j / radialSegments) * TAU + ringTwist;
      const normal = new THREE.Vector3()
        .addScaledVector(frameNormal, Math.cos(angle))
        .addScaledVector(frameBinormal, Math.sin(angle))
        .normalize();
      const vertex = point.clone().addScaledVector(normal, radius);
      pushVertex(vertex, normal, j / radialSegments, t, t);
    }
  }

  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const nextJ = (j + 1) % radialSegments;
      const a = i * radialSegments + j;
      const b = (i + 1) * radialSegments + j;
      const c = (i + 1) * radialSegments + nextJ;
      const d = i * radialSegments + nextJ;
      indices.push(a, b, d, b, c, d);
    }
  }

  const startPoint = curve.getPoint(0);
  const startTangent = curve.getTangent(0).normalize();
  const startCenterIndex = positions.length / 3;
  pushVertex(startPoint, startTangent.clone().negate(), 0.5, 0.5, 0);
  for (let j = 0; j < radialSegments; j += 1) {
    const nextJ = (j + 1) % radialSegments;
    indices.push(startCenterIndex, nextJ, j);
  }

  const endPoint = curve.getPoint(1);
  const endTangent = curve.getTangent(1).normalize();
  const endCenterIndex = positions.length / 3;
  pushVertex(endPoint, endTangent, 0.5, 0.5, 1);
  const endRingOffset = segments * radialSegments;
  for (let j = 0; j < radialSegments; j += 1) {
    const nextJ = (j + 1) % radialSegments;
    indices.push(endCenterIndex, endRingOffset + j, endRingOffset + nextJ);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function makeCanvasTexture(
  width,
  height,
  draw,
  { repeat = [1, 1], colorSpace = THREE.SRGBColorSpace } = {},
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;
  return texture;
}

export function makePaverTexture() {
  return makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const rng = mulberry32(2911);
      ctx.fillStyle = '#d8d2c6';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const cols = 4;
      const blockH = h / rows;
      const blockW = w / cols;
      for (let row = 0; row < rows; row += 1) {
        const offset = row % 2 === 0 ? 0 : -blockW / 2;
        for (let col = -1; col < cols + 1; col += 1) {
          const x = col * blockW + offset;
          const shade = 213 + Math.floor(rng() * 13);
          const warm = Math.floor(rng() * 7);
          ctx.fillStyle = `rgb(${shade + warm},${shade + warm - 4},${shade - 9})`;
          ctx.fillRect(x + 1.5, row * blockH + 1.5, blockW - 3, blockH - 3);
          ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.025})`;
          ctx.fillRect(x + 4, row * blockH + 4, blockW - 8, 5);
        }
      }
      ctx.strokeStyle = 'rgba(104, 94, 86, 0.22)';
      ctx.lineWidth = 1.5;
      for (let row = 0; row <= rows; row += 1) {
        ctx.beginPath();
        ctx.moveTo(0, row * blockH);
        ctx.lineTo(w, row * blockH);
        ctx.stroke();
      }
      for (let i = 0; i < 620; i += 1) {
        const dark = rng() > 0.52;
        ctx.fillStyle = dark
          ? `rgba(91, 78, 71, ${0.02 + rng() * 0.055})`
          : `rgba(255, 250, 236, ${0.02 + rng() * 0.06})`;
        ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2.5, 1 + rng() * 2.5);
      }
    },
    { repeat: [3, 3] },
  );
}

export function makeAsphaltTexture() {
  return makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const rng = mulberry32(7823);
      ctx.fillStyle = '#707378';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i += 1) {
        const value = 80 + Math.floor(rng() * 54);
        const alpha = 0.025 + rng() * 0.12;
        ctx.fillStyle = `rgba(${value},${value + 1},${value + 3},${alpha})`;
        const size = rng() * 2.2 + 0.4;
        ctx.fillRect(rng() * w, rng() * h, size, size);
      }
      for (let i = 0; i < 7; i += 1) {
        ctx.strokeStyle = `rgba(49, 49, 53, ${0.08 + rng() * 0.07})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        let x = rng() * w;
        let y = rng() * h;
        ctx.moveTo(x, y);
        for (let s = 0; s < 4; s += 1) {
          x += (rng() - 0.5) * 70;
          y += rng() * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, 'rgba(255,255,255,0.025)');
      gradient.addColorStop(0.55, 'rgba(0,0,0,0.02)');
      gradient.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
    { repeat: [5, 5] },
  );
}

export function makeContactShadowTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 7, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.82)');
    gradient.addColorStop(0.32, 'rgba(245,245,245,0.55)');
    gradient.addColorStop(0.7, 'rgba(220,220,220,0.17)');
    gradient.addColorStop(1, 'rgba(210,210,210,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeGlowTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255,249,220,1)');
    gradient.addColorStop(0.12, 'rgba(255,210,137,0.8)');
    gradient.addColorStop(0.42, 'rgba(255,164,82,0.2)');
    gradient.addColorStop(1, 'rgba(255,145,65,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makePosterTexture(variant = 0) {
  return makeCanvasTexture(
    256,
    356,
    (ctx, w, h) => {
      const rng = mulberry32(812 + variant * 91);
      const dark = variant === 0;
      ctx.fillStyle = dark ? '#41374d' : '#f2e8d7';
      ctx.fillRect(0, 0, w, h);

      // A broad colour field gives the tiny print enough presence from afar.
      if (dark) {
        ctx.fillStyle = '#5d4b72';
        ctx.beginPath();
        ctx.arc(w * 0.7, h * 0.27, 72, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#d9cbe4';
        ctx.fillRect(16, h * 0.72, w - 32, h * 0.2);
      }

      ctx.fillStyle = dark ? '#f3eadb' : '#3b3542';
      ctx.font = '600 10px Georgia, serif';
      ctx.fillText(dark ? 'CORNER GALLERY' : 'PUBLIC NOTICE', 22, 42);
      ctx.strokeStyle = dark ? 'rgba(241,231,215,0.45)' : 'rgba(59,53,66,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(22, 51);
      ctx.lineTo(w - 22, 51);
      ctx.stroke();

      ctx.fillStyle = dark ? '#f3eadb' : '#4e3d63';
      ctx.font = 'italic 34px Georgia, serif';
      ctx.fillText(dark ? 'Blue' : 'Spring', 21, dark ? 105 : 98);
      ctx.fillText(dark ? 'Hour' : 'Open', 21, dark ? 139 : 130);

      ctx.strokeStyle = dark ? '#d9c9e3' : '#4e3d63';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(34, 223);
      ctx.quadraticCurveTo(91, 173, 138, 196);
      ctx.quadraticCurveTo(178, 216, 215, 169);
      ctx.stroke();
      if (dark) {
        ctx.fillStyle = '#d8c9e4';
        for (let i = 0; i < 28; i += 1) {
          const t = rng();
          const x = 38 + t * 175 + (rng() - 0.5) * 46;
          const y = 212 - Math.sin(t * Math.PI) * 32 + (rng() - 0.5) * 36;
          ctx.beginPath();
          ctx.ellipse(x, y, 4 + rng() * 4, 7 + rng() * 4, rng() * TAU, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#725b94';
        for (let i = 0; i < 26; i += 1) {
          const t = rng();
          const x = 38 + t * 175 + (rng() - 0.5) * 42;
          const y = 212 - Math.sin(t * Math.PI) * 32 + (rng() - 0.5) * 35;
          ctx.beginPath();
          ctx.ellipse(x, y, 4 + rng() * 4, 7 + rng() * 4, rng() * TAU, 0, TAU);
          ctx.fill();
        }
      }

      ctx.fillStyle = dark ? '#eee4d7' : '#453d4d';
      ctx.font = '9px Georgia, serif';
      ctx.fillText(dark ? '17 OCT — 02 NOV' : 'SATURDAY 10—4', 23, h - 52);
      ctx.fillText(dark ? 'JACARANDA CORNER / DARLINGHURST' : 'ALL WELCOME / JACARANDA CORNER', 23, h - 36);
      ctx.strokeStyle = dark ? 'rgba(246,236,219,0.28)' : 'rgba(73,61,82,0.25)';
      ctx.strokeRect(8.5, 8.5, w - 17, h - 17);
    },
    { repeat: [1, 1] },
  );
}

export function makeMagazineTexture(index = 0) {
  return makeCanvasTexture(
    128,
    176,
    (ctx, w, h) => {
      const palettes = [
        ['#d9cfdf', '#5f4d72', '#f0d7a8'],
        ['#ccd9d5', '#3d5753', '#f3cc9c'],
        ['#e5d3ca', '#7a4f52', '#f2e8d0'],
      ];
      const palette = palettes[index % palettes.length];
      ctx.fillStyle = palette[0];
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = palette[2];
      ctx.beginPath();
      ctx.arc(w * 0.62, h * 0.3, 38, 0, TAU);
      ctx.fill();
      ctx.fillStyle = palette[1];
      ctx.font = '600 14px Georgia, serif';
      ctx.fillText('STILL', 10, 29);
      ctx.fillText('LIFE', 10, 45);
      ctx.font = '7px sans-serif';
      ctx.fillText('A SMALL CITY READER', 10, 62);
      ctx.strokeStyle = palette[1];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, 126);
      ctx.quadraticCurveTo(46, 102, 94, 132);
      ctx.stroke();
      ctx.fillStyle = palette[1];
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.ellipse(24 + i * 17, 119 - Math.sin(i) * 7, 5, 8, i * 0.4, 0, TAU);
        ctx.fill();
      }
    },
    { repeat: [1, 1] },
  );
}

export function makeEnvironmentTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#b9cfe2');
  sky.addColorStop(0.29, '#d8e5ee');
  sky.addColorStop(0.5, '#f5ecdc');
  sky.addColorStop(0.58, '#e5d6c9');
  sky.addColorStop(1, '#7e786f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 512);

  const sun = ctx.createRadialGradient(744, 214, 2, 744, 214, 138);
  sun.addColorStop(0, 'rgba(255,241,203,0.95)');
  sun.addColorStop(0.2, 'rgba(255,211,154,0.35)');
  sun.addColorStop(1, 'rgba(255,211,154,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);

  const building = ctx.createLinearGradient(0, 306, 0, 430);
  building.addColorStop(0, 'rgba(225,207,181,0.65)');
  building.addColorStop(1, 'rgba(117,101,94,0.55)');
  ctx.fillStyle = building;
  ctx.fillRect(0, 306, 1024, 124);

  ctx.fillStyle = 'rgba(255,247,223,0.35)';
  ctx.fillRect(610, 330, 48, 40);
  ctx.fillRect(794, 336, 35, 34);
  ctx.fillStyle = 'rgba(77,84,93,0.25)';
  ctx.fillRect(312, 344, 34, 62);
  ctx.fillRect(418, 350, 27, 56);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSoftShadow(material, scaleX = 1, scaleZ = 1) {
  const geometry = new THREE.PlaneGeometry(scaleX, scaleZ);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

export function setShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * A polyline curve that passes exactly along its control points.
 * Catmull-Rom is lovely for branches, but gives unwanted hooks on
 * widely-spaced architectural trim points.
 */
export class PolylineCurve3 extends THREE.Curve {
  constructor(points, closed = false) {
    super();
    this.points = points.map((point) => point.clone());
    this.closed = closed;
    if (this.closed && this.points.length > 1) {
      const first = this.points[0];
      const last = this.points[this.points.length - 1];
      if (first.distanceToSquared(last) < 1e-8) this.points.pop();
    }
    this.lengths = [0];
    const segments = this.closed ? this.points.length : this.points.length - 1;
    for (let i = 0; i < segments; i += 1) {
      const a = this.points[i];
      const b = this.points[(i + 1) % this.points.length];
      this.lengths.push(this.lengths[i] + a.distanceTo(b));
    }
    this.totalLength = this.lengths[this.lengths.length - 1] || 1;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const segments = this.closed ? this.points.length : this.points.length - 1;
    if (segments < 1) return target.copy(this.points[0] ?? new THREE.Vector3());
    let normalized = this.closed
      ? ((t % 1) + 1) % 1
      : clamp(t, 0, 1);
    const distance = normalized * this.totalLength;
    let segment = 0;
    while (
      segment < segments - 1 &&
      this.lengths[segment + 1] < distance
    ) {
      segment += 1;
    }
    const segmentStart = this.lengths[segment];
    const segmentLength = this.lengths[segment + 1] - segmentStart || 1;
    const localT = clamp((distance - segmentStart) / segmentLength, 0, 1);
    const a = this.points[segment];
    const b = this.points[(segment + 1) % this.points.length];
    return target.copy(a).lerp(b, localT);
  }
}

export function tubeFromPolyline(
  points,
  radius,
  material,
  {
    segments = 180,
    radialSegments = 5,
    closed = false,
    castShadow = true,
  } = {},
) {
  const curve = new PolylineCurve3(points, closed);
  const geometry = new THREE.TubeGeometry(
    curve,
    segments,
    radius,
    radialSegments,
    closed,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  return mesh;
}
