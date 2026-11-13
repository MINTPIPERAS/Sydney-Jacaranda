import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD } from './worldConfig.js';
import { addRoofTerrace } from './roofTerrace.js';
import {
  boxPart,
  mergeParts,
  mulberry32,
  TAU,
  tubeFromCurve,
  tubeFromPolyline,
} from './utils.js';

const B = WORLD.building;
const SIDEWALK = WORLD.sidewalkY;
const CORNER_ANGLE = Math.PI / 4;

const pointOnArc = (angle, radius = B.cornerRadius, inset = 0) =>
  new THREE.Vector3(
    B.cornerX + Math.cos(angle) * (radius - inset),
    SIDEWALK + inset,
    B.cornerZ + Math.sin(angle) * (radius - inset),
  );

function footprintShape(offset = 0) {
  const left = B.left - offset;
  const right = B.right + offset;
  const back = B.back - offset;
  const front = B.front + offset;
  const radius = B.cornerRadius + offset;
  const shape = new THREE.Shape();
  shape.moveTo(left, -back);
  shape.lineTo(right, -back);
  shape.lineTo(right, -B.cornerZ);
  shape.absarc(B.cornerX, -B.cornerZ, radius, 0, -Math.PI / 2, true);
  shape.lineTo(left, -front);
  shape.closePath();
  return shape;
}

function extrudedFootprint(offset, height) {
  const geometry = new THREE.ExtrudeGeometry(footprintShape(offset), {
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 40,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function addFootprintBlock(group, material, { offset, height, y, shadow = true }) {
  const geometry = extrudedFootprint(offset, height);
  geometry.translate(0, y, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function footprintOutline(offset = 0, y = 0, segments = 16) {
  const left = B.left - offset;
  const right = B.right + offset;
  const back = B.back - offset;
  const front = B.front + offset;
  const radius = B.cornerRadius + offset;
  const points = [
    new THREE.Vector3(left, y, front),
    new THREE.Vector3(B.cornerX, y, front),
  ];
  for (let i = 1; i <= segments; i += 1) {
    const angle = Math.PI / 2 - (i / segments) * (Math.PI / 2);
    points.push(
      new THREE.Vector3(
        B.cornerX + Math.cos(angle) * radius,
        y,
        B.cornerZ + Math.sin(angle) * radius,
      ),
    );
  }
  points.push(new THREE.Vector3(right, y, back));
  points.push(new THREE.Vector3(left, y, back));
  points.push(new THREE.Vector3(left, y, front));
  return points;
}

function addCornice(group, materials, { y, projection, height, dentils = false, baseOffset = 0 }) {
  addFootprintBlock(group, materials.trim, {
    offset: baseOffset + projection - 0.045,
    height: height * 0.76,
    y,
    shadow: true,
  });
  addFootprintBlock(group, materials.trimBright, {
    offset: baseOffset + projection,
    height: height * 0.24,
    y: y + height * 0.76,
    shadow: true,
  });
  // A pulled, slightly rounded nosing catches the light.
  const rail = tubeFromPolyline(
    footprintOutline(baseOffset + projection + 0.012, y + height + 0.005, 24),
    0.028,
    materials.trimBright,
    { segments: 180, radialSegments: 5, castShadow: true },
  );
  group.add(rail);

  if (dentils) {
    const parts = [];
    const rng = mulberry32(Math.round(y * 100));
    const frontZ = B.front + projection + 0.01;
    const sideX = B.right + projection + 0.01;
    for (let x = B.left + 0.32; x < B.cornerX - 0.1; x += 0.21) {
      parts.push(
        boxPart(0.11, 0.13, 0.09, x, y - 0.08, frontZ, 0, 0, 0),
      );
    }
    for (let z = B.back + 0.22; z < B.cornerZ - 0.1; z += 0.21) {
      parts.push(
        boxPart(0.09, 0.13, 0.11, sideX, y - 0.08, z, 0, 0, 0),
      );
    }
    const mesh = mergeParts(parts, materials.trim, {
      castShadow: true,
      receiveShadow: true,
    });
    if (mesh) group.add(mesh);
  }
}

function addWallQuoins(group, materials) {
  const parts = [];
  const blockHeight = 0.28;
  for (let i = 0; i < 20; i += 1) {
    const y = 0.72 + i * 0.31;
    if (y > 6.35) break;
    const long = i % 2 === 0;
    const width = long ? 0.46 : 0.3;
    // Front-left quoins.
    parts.push(boxPart(width, blockHeight, 0.055, B.left + width / 2, y, B.front + 0.018));
    parts.push(boxPart(0.055, blockHeight, width, B.left - 0.018, y, B.front - width / 2));
    // Rear-right return, useful when the model is turned around.
    parts.push(
      boxPart(width, blockHeight, 0.055, B.right - width / 2, y, B.back - 0.018),
    );
    parts.push(boxPart(0.055, blockHeight, width, B.right + 0.018, y, B.back + width / 2));
  }
  const meshes = new THREE.Group();
  const mesh = mergeParts(parts, materials.plasterDark, {
    castShadow: true,
    receiveShadow: true,
  });
  if (mesh) meshes.add(mesh);
  group.add(meshes);
}

function addDentilsForParapet(group, materials) {
  const parts = [];
  const frontZ = B.front - B.thirdInset + 0.095;
  const sideX = B.right - B.thirdInset + 0.095;
  for (let x = B.left + B.thirdInset + 0.28; x < B.cornerX - 0.08; x += 0.19) {
    parts.push(boxPart(0.1, 0.1, 0.08, x, 9.17, frontZ));
  }
  for (let z = B.back + B.thirdInset + 0.25; z < B.cornerZ - 0.08; z += 0.19) {
    parts.push(boxPart(0.08, 0.1, 0.1, sideX, 9.17, z));
  }
  const mesh = mergeParts(parts, materials.trim, {
    castShadow: true,
    receiveShadow: true,
  });
  if (mesh) group.add(mesh);
}

function addDownpipe(group, materials, x, z, height, outerRotation = 0) {
  const pipe = tubeFromCurve(
    [
      [x, 0.52, z],
      [x, 2.6, z],
      [x + 0.015 * Math.sin(outerRotation), 4.1, z],
      [x, height, z],
      [x - 0.12 * Math.cos(outerRotation), height + 0.12, z - 0.09],
    ],
    0.047,
    materials.ironSoft,
    { segments: 20, radialSegments: 6, castShadow: true },
  );
  group.add(pipe);
  for (let i = 0; i < 4; i += 1) {
    const bracket = new THREE.Mesh(
      new THREE.TorusGeometry(0.074, 0.016, 4, 16, Math.PI * 1.4),
      materials.ironSoft,
    );
    bracket.rotation.y = Math.PI / 2;
    bracket.position.set(x + 0.02, 1.1 + i * 1.35, z);
    group.add(bracket);
  }
}

function makeWindow(materials, {
  width = 1.15,
  height = 2.05,
  style = 'ground',
  interiorVariant = 0,
  woodKick = false,
}) {
  const group = new THREE.Group();
  const frameParts = [];
  const stoneParts = [];
  const trim = materials.trimBright;
  const halfW = width / 2;
  const frameDepth = 0.11;
  const zFrame = 0.07;

  // A shallow dark reveal keeps the panes from looking pasted on.
  const reveal = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.055),
    materials.ironSoft,
  );
  reveal.position.set(0, height / 2, 0.012);
  reveal.receiveShadow = true;
  group.add(reveal);

  const interior = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.11, height - 0.11),
    materials.windowInteriors[interiorVariant % materials.windowInteriors.length],
  );
  interior.position.set(0, height / 2, 0.043);
  group.add(interior);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.16, height - 0.16),
    materials.glass,
  );
  glass.position.set(0, height / 2, 0.067);
  glass.renderOrder = 3;
  group.add(glass);

  // Outer architrave.
  frameParts.push(
    boxPart(0.082, height + 0.2, frameDepth, -halfW - 0.035, height / 2, zFrame),
    boxPart(0.082, height + 0.2, frameDepth, halfW + 0.035, height / 2, zFrame),
    boxPart(width + 0.15, 0.095, frameDepth, 0, height + 0.07, zFrame),
    boxPart(width + 0.15, 0.07, frameDepth, 0, 0.035, zFrame),
  );

  // Inner casing around the glazing.
  frameParts.push(
    boxPart(0.054, height - 0.03, 0.05, -halfW + 0.044, height / 2, 0.095),
    boxPart(0.054, height - 0.03, 0.05, halfW - 0.044, height / 2, 0.095),
    boxPart(width - 0.06, 0.05, 0.05, 0, height - 0.055, 0.095),
  );

  // Mullions: more panes on the high third-floor windows.
  const mullionZ = 0.1;
  frameParts.push(boxPart(0.032, height - 0.14, 0.055, 0, height / 2, mullionZ));
  if (style === 'upper') {
    frameParts.push(
      boxPart(width - 0.12, 0.028, 0.052, 0, height * 0.47, mullionZ),
      boxPart(width - 0.12, 0.028, 0.052, 0, height * 0.71, mullionZ),
      boxPart(width - 0.12, 0.035, 0.052, 0, height * 0.25, mullionZ),
    );
  } else {
    frameParts.push(
      boxPart(width - 0.12, 0.037, 0.052, 0, height * 0.61, mullionZ),
      boxPart(width - 0.12, 0.031, 0.052, 0, height * 0.32, mullionZ),
    );
  }

  if (woodKick) {
    frameParts.push(
      boxPart(width - 0.16, 0.64, 0.06, 0, 0.53, 0.105),
      boxPart(width - 0.23, 0.52, 0.016, 0, 0.54, 0.142),
      boxPart(width - 0.31, 0.06, 0.022, 0, 0.32, 0.152),
      boxPart(width - 0.31, 0.06, 0.022, 0, 0.76, 0.152),
    );
    frameParts.push(
      boxPart(0.02, 0.45, 0.021, -0.17, 0.54, 0.153),
      boxPart(0.02, 0.45, 0.021, 0.17, 0.54, 0.153),
    );
  }

  const frameMesh = mergeParts(frameParts, trim, {
    castShadow: true,
    receiveShadow: true,
  });
  if (frameMesh) group.add(frameMesh);
  const casing = stoneParts.length ? mergeParts(stoneParts, materials.trim) : null;
  if (casing) group.add(casing);

  // Independent sill and hood.
  const sillParts = [
    boxPart(width + 0.32, 0.075, 0.23, 0, -0.012, 0.09),
    boxPart(width + 0.22, 0.032, 0.17, 0, 0.023, 0.085),
    boxPart(width + 0.28, 0.085, 0.15, 0, height + 0.133, 0.062),
    boxPart(0.15, 0.13, 0.18, 0, height + 0.15, 0.07),
  ];
  const sill = mergeParts(sillParts, materials.stone, {
    castShadow: true,
    receiveShadow: true,
  });
  if (sill) group.add(sill);
  const trimBelow = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.36, 0.035, 0.12),
    materials.stoneDark,
  );
  trimBelow.position.set(0, -0.052, 0.055);
  group.add(trimBelow);
  return group;
}

function addWindows(group, materials) {
  const windowRecords = [];
  const specs = [];

  const add = (facade, u, y, options) => specs.push({ facade, u, y, options });

  // Ground floor.
  [-3.92, -1.86, 0.31].forEach((x, i) =>
    add('front', x, 0.74, {
      width: 1.14,
      height: 2.02,
      interiorVariant: i === 1 ? 2 : i,
    }),
  );
  [-3.87, -1.75, 0.34].forEach((z, i) =>
    add('right', z, 0.74, {
      width: 1.14,
      height: 2.02,
      interiorVariant: i === 1 ? 0 : 2,
    }),
  );
  [-2.8, 0.3].forEach((x, i) =>
    add('back', x, 0.82, {
      width: 1.02,
      height: 1.86,
      interiorVariant: i === 0 ? 2 : 1,
    }),
  );
  [-3.42, -1.28].forEach((z, i) =>
    add('left', z, 0.82, {
      width: 1.0,
      height: 1.82,
      interiorVariant: i === 0 ? 0 : 2,
    }),
  );

  // First floor, opening onto the wraparound balcony.
  [-3.56, -1.32, 0.92].forEach((x, i) =>
    add('front', x, 4.08, {
      width: 1.2,
      height: 2.15,
      style: 'french',
      woodKick: true,
      interiorVariant: i === 1 ? 1 : 0,
    }),
  );
  [-0.86, 1.12].forEach((z, i) =>
    add('right', z, 4.08, {
      width: 1.2,
      height: 2.15,
      style: 'french',
      woodKick: true,
      interiorVariant: i === 0 ? 2 : 1,
    }),
  );
  [-3.45, -0.9, 1.15].forEach((z, i) =>
    add('left', z, 4.2, {
      width: 1.02,
      height: 1.92,
      style: 'upper',
      interiorVariant: i === 1 ? 0 : 2,
    }),
  );
  [-3.05, 0.05, 2.64].forEach((x, i) =>
    add('back', x, 4.2, {
      width: 1.02,
      height: 1.9,
      style: 'upper',
      interiorVariant: i === 0 ? 2 : i === 1 ? 1 : 0,
    }),
  );

  // Recessed top floor.
  [-3.52, -1.24, 1.08].forEach((x, i) =>
    add('third-front', x, 6.98, {
      width: 0.86,
      height: 1.88,
      style: 'upper',
      interiorVariant: i === 1 ? 0 : 2,
    }),
  );
  [-3.86, -1.72].forEach((z, i) =>
    add('third-right', z, 6.98, {
      width: 0.86,
      height: 1.88,
      style: 'upper',
      interiorVariant: i === 0 ? 0 : 2,
    }),
  );
  [-3.34, -0.92, 1.2].forEach((z, i) =>
    add('third-left', z, 7.02, {
      width: 0.77,
      height: 1.78,
      style: 'upper',
      interiorVariant: 2,
    }),
  );
  [-2.88, 0.12, 2.6].forEach((x, i) =>
    add('third-back', x, 7.02, {
      width: 0.77,
      height: 1.78,
      style: 'upper',
      interiorVariant: i === 1 ? 1 : 2,
    }),
  );

  const place = (spec) => {
    const { facade, u, y, options } = spec;
    const windowGroup = makeWindow(materials, options);
    if (facade === 'front') {
      windowGroup.position.set(u, y, B.front + 0.032);
    } else if (facade === 'right') {
      windowGroup.position.set(B.right + 0.032, y, u);
      windowGroup.rotation.y = Math.PI / 2;
    } else if (facade === 'back') {
      windowGroup.position.set(u, y, B.back - 0.032);
      windowGroup.rotation.y = Math.PI;
    } else if (facade === 'left') {
      windowGroup.position.set(B.left - 0.032, y, u);
      windowGroup.rotation.y = -Math.PI / 2;
    } else if (facade === 'third-front') {
      windowGroup.position.set(u, y, B.front - B.thirdInset + 0.032);
    } else if (facade === 'third-right') {
      windowGroup.position.set(B.right - B.thirdInset + 0.032, y, u);
      windowGroup.rotation.y = Math.PI / 2;
    } else if (facade === 'third-left') {
      windowGroup.position.set(B.left + B.thirdInset - 0.032, y, u);
      windowGroup.rotation.y = -Math.PI / 2;
    } else if (facade === 'third-back') {
      windowGroup.position.set(u, y, B.back + B.thirdInset - 0.032);
      windowGroup.rotation.y = Math.PI;
    }
    group.add(windowGroup);
    windowRecords.push(windowGroup);
  };
  specs.forEach(place);

  // The corner window above the entrance ties the whole composition together.
  const cornerSecond = makeWindow(materials, {
    width: 1.12,
    height: 2.12,
    style: 'french',
    woodKick: true,
    interiorVariant: 0,
  });
  const secondPoint = pointOnArc(CORNER_ANGLE);
  cornerSecond.position.set(secondPoint.x + 0.02 * Math.cos(CORNER_ANGLE), 4.08, secondPoint.z + 0.02 * Math.sin(CORNER_ANGLE));
  cornerSecond.rotation.y = CORNER_ANGLE;
  group.add(cornerSecond);
  windowRecords.push(cornerSecond);

  const cornerThird = makeWindow(materials, {
    width: 0.78,
    height: 1.82,
    style: 'upper',
    interiorVariant: 1,
  });
  const insetCornerRadius = B.cornerRadius - B.thirdInset;
  const thirdPoint = new THREE.Vector3(
    B.cornerX + Math.cos(CORNER_ANGLE) * insetCornerRadius,
    SIDEWALK,
    B.cornerZ + Math.sin(CORNER_ANGLE) * insetCornerRadius,
  );
  cornerThird.position.set(
    thirdPoint.x + 0.02 * Math.cos(CORNER_ANGLE),
    6.98,
    thirdPoint.z + 0.02 * Math.sin(CORNER_ANGLE),
  );
  cornerThird.rotation.y = CORNER_ANGLE;
  group.add(cornerThird);
  windowRecords.push(cornerThird);

  return windowRecords;
}

function addPosters(group, materials) {
  const makePoster = (variant, width, height) => {
    const poster = new THREE.Group();
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      materials.posterPapers[variant],
    );
    paper.position.z = 0.022;
    poster.add(paper);
    const frameMaterial = materials.posterFrames;
    const parts = [
      boxPart(width + 0.1, 0.045, 0.045, 0, height / 2 + 0.028, 0),
      boxPart(width + 0.1, 0.045, 0.045, 0, -height / 2 - 0.028, 0),
      boxPart(0.045, height + 0.02, 0.045, -width / 2 - 0.028, 0, 0),
      boxPart(0.045, height + 0.02, 0.045, width / 2 + 0.028, 0, 0),
    ];
    poster.add(mergeParts(parts, frameMaterial, { castShadow: true, receiveShadow: true }));
    return poster;
  };

  const frontPoster = makePoster(0, 0.67, 0.93);
  frontPoster.position.set(-0.6, 1.72, B.front + 0.03);
  group.add(frontPoster);

  const sidePoster = makePoster(1, 0.58, 0.82);
  sidePoster.position.set(B.right + 0.03, 1.55, -0.6);
  sidePoster.rotation.y = Math.PI / 2;
  group.add(sidePoster);
}

function addEntryDoor(group, materials) {
  const doorGroup = new THREE.Group();
  const doorPoint = pointOnArc(CORNER_ANGLE);
  doorGroup.position.set(doorPoint.x, SIDEWALK, doorPoint.z);
  doorGroup.rotation.y = CORNER_ANGLE;
  group.add(doorGroup);

  // The flat case resolves the curved wall into a doorway.
  const backing = new THREE.Mesh(
    new RoundedBoxGeometry(2.66, 3.06, 0.16, 2, 0.035),
    materials.trim,
  );
  backing.position.set(0, 1.56, 0.02);
  backing.castShadow = true;
  backing.receiveShadow = true;
  doorGroup.add(backing);

  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(2.17, 2.82, 0.05),
    materials.ironSoft,
  );
  recess.position.set(0, 1.44, 0.112);
  doorGroup.add(recess);

  const darkDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(2.08, 2.72),
    materials.doorDark,
  );
  darkDoor.position.set(0, 1.44, 0.143);
  doorGroup.add(darkDoor);

  // Stepped stone threshold.
  const steps = new THREE.Group();
  const stepA = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.08, 0.48), materials.stone);
  stepA.position.set(0, 0.04, 0.29);
  const stepB = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.055, 0.25), materials.trim);
  stepB.position.set(0, 0.027, 0.58);
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(2.22, 0.045, 0.22),
    materials.brass,
  );
  threshold.position.set(0, 0.11, 0.12);
  [stepA, stepB, threshold].forEach((item) => {
    item.castShadow = true;
    item.receiveShadow = true;
    steps.add(item);
  });
  doorGroup.add(steps);

  // Door casing and entablature.
  const whiteParts = [];
  whiteParts.push(
    boxPart(0.14, 2.74, 0.16, -1.08, 1.45, 0.19),
    boxPart(0.14, 2.74, 0.16, 1.08, 1.45, 0.19),
    boxPart(2.3, 0.16, 0.17, 0, 2.87, 0.19),
  );
  // Double leaves.
  const leafCenters = [-0.47, 0.47];
  leafCenters.forEach((center) => {
    whiteParts.push(
      boxPart(0.075, 2.28, 0.075, center - 0.44, 1.27, 0.19),
      boxPart(0.075, 2.28, 0.075, center + 0.44, 1.27, 0.19),
      boxPart(0.87, 0.09, 0.075, center, 2.36, 0.19),
      boxPart(0.87, 0.1, 0.075, center, 0.18, 0.19),
      boxPart(0.87, 0.09, 0.075, center, 0.97, 0.19),
      // Raised kick panels.
      boxPart(0.63, 0.61, 0.035, center, 0.57, 0.235),
      boxPart(0.49, 0.09, 0.015, center, 0.78, 0.259),
      boxPart(0.49, 0.09, 0.015, center, 0.36, 0.259),
      boxPart(0.49, 0.5, 0.012, center, 0.57, 0.254),
      // Slim glazing bars in the upper panel.
      boxPart(0.028, 1.25, 0.05, center, 1.68, 0.2),
      boxPart(0.83, 0.032, 0.05, center, 1.48, 0.2),
    );
  });
  // Transom framing.
  whiteParts.push(
    boxPart(2.2, 0.08, 0.11, 0, 2.46, 0.2),
    boxPart(2.2, 0.08, 0.11, 0, 2.81, 0.2),
    boxPart(0.055, 0.35, 0.09, -0.72, 2.65, 0.2),
    boxPart(0.055, 0.35, 0.09, 0, 2.65, 0.2),
    boxPart(0.055, 0.35, 0.09, 0.72, 2.65, 0.2),
  );
  // Pediment.
  whiteParts.push(
    boxPart(2.46, 0.12, 0.24, 0, 2.94, 0.14),
    boxPart(2.3, 0.065, 0.19, 0, 3.02, 0.12),
    boxPart(0.18, 0.15, 0.25, 0, 3.08, 0.14),
  );
  const white = mergeParts(whiteParts, materials.trimBright, {
    castShadow: true,
    receiveShadow: true,
  });
  doorGroup.add(white);

  // Upper door lights and transom. Warm light sits behind the glass.
  const interiorMaterial = materials.windowInteriors[0];
  const glassPanels = [
    { w: 0.74, h: 1.28, x: -0.47, y: 1.68, z: 0.162 },
    { w: 0.74, h: 1.28, x: 0.47, y: 1.68, z: 0.162 },
    { w: 0.63, h: 0.3, x: -0.72, y: 2.65, z: 0.25 },
    { w: 0.63, h: 0.3, x: 0, y: 2.65, z: 0.25 },
    { w: 0.63, h: 0.3, x: 0.72, y: 2.65, z: 0.25 },
  ];
  glassPanels.forEach((panel) => {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(panel.w, panel.h),
      interiorMaterial,
    );
    glow.position.set(panel.x, panel.y, panel.z - 0.012);
    doorGroup.add(glow);
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(panel.w, panel.h),
      materials.doorGlass,
    );
    pane.position.set(panel.x, panel.y, panel.z + 0.006);
    pane.renderOrder = 4;
    doorGroup.add(pane);
  });

  // A suspended central shadow line makes the two leaves legible.
  const doorSeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 2.24, 0.018),
    materials.ironSoft,
  );
  doorSeam.position.set(0, 1.28, 0.236);
  doorGroup.add(doorSeam);

  // Handles and finger plates.
  leafCenters.forEach((center) => {
    const x = center > 0 ? center - 0.075 : center + 0.075;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.26, 0.02),
      materials.brass,
    );
    plate.position.set(x, 1.16, 0.246);
    doorGroup.add(plate);
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.021, 0.31, 8),
      materials.brass,
    );
    bar.position.set(x, 1.17, 0.286);
    doorGroup.add(bar);
    for (const y of [1.045, 1.295]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.07, 6),
        materials.brass,
      );
      arm.rotation.x = Math.PI / 2;
      arm.position.set(x, y, 0.254);
      doorGroup.add(arm);
    }
  });

  // A little brass house number above the door.
  const numberPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.11, 0.025),
    materials.brass,
  );
  numberPlate.position.set(1.04, 2.97, 0.255);
  doorGroup.add(numberPlate);

  // Wall lanterns flank the entrance.
  const sconceGlows = [];
  [-1.22, 1.22].forEach((x) => {
    const sconce = new THREE.Group();
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.035, 0.24),
      materials.iron,
    );
    arm.position.set(0, 0.17, 0.14);
    sconce.add(arm);
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.24, 0.14),
      materials.lampGlass,
    );
    lantern.position.set(0, 0.23, 0.31);
    sconce.add(lantern);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.08, 4),
      materials.iron,
    );
    cap.rotation.y = Math.PI / 4;
    cap.position.set(0, 0.39, 0.31);
    sconce.add(cap);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: materials.glowMap,
        color: '#ffd9a0',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    );
    glow.scale.set(0.7, 0.7, 1);
    glow.position.set(0, 0.24, 0.33);
    sconce.add(glow);
    sconceGlows.push(glow.material);
    sconce.position.set(x, 1.98, 0.14);
    doorGroup.add(sconce);
  });

  return { doorGroup, sconceGlows, doorPoint };
}

function addAwning(group, materials, doorPoint) {
  const pivot = new THREE.Group();
  pivot.position.set(
    doorPoint.x + Math.cos(CORNER_ANGLE) * 0.02,
    3.45,
    doorPoint.z + Math.sin(CORNER_ANGLE) * 0.02,
  );
  pivot.rotation.y = CORNER_ANGLE;
  group.add(pivot);

  const slope = new THREE.Group();
  slope.rotation.x = 0.19;
  pivot.add(slope);

  const depth = 1.26;
  const width = 3.18;
  const corrugationCount = 9;
  const corrugationDepth = 0.034;
  const cols = 54;
  const rows = 7;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let col = 0; col <= cols; col += 1) {
      const u = col / cols;
      const x = (u - 0.5) * width;
      const z = v * depth;
      const y =
        corrugationDepth *
        (0.5 + 0.5 * Math.cos(u * corrugationCount * TAU)) +
        0.008;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * (cols + 1) + col;
      const b = a + cols + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const sheetGeometry = new THREE.BufferGeometry();
  sheetGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  sheetGeometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(uvs, 2),
  );
  sheetGeometry.setIndex(indices);
  sheetGeometry.computeVertexNormals();
  const top = new THREE.Mesh(sheetGeometry, materials.awning);
  top.castShadow = true;
  top.receiveShadow = true;
  slope.add(top);

  const under = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.02, 0.016, depth - 0.015),
    materials.awningUnder,
  );
  under.position.set(0, -0.026, depth / 2);
  under.receiveShadow = true;
  slope.add(under);

  // A scalloped valance makes the corrugation legible from the street.
  const valancePositions = [];
  const valanceUvs = [];
  const valanceIndices = [];
  const valanceCols = 45;
  for (let col = 0; col <= valanceCols; col += 1) {
    const u = col / valanceCols;
    const x = (u - 0.5) * (width + 0.13);
    const topY = -0.015;
    const bottomY =
      -0.145 - Math.abs(Math.sin(u * corrugationCount * Math.PI)) * 0.035;
    valancePositions.push(x, topY, 0, x, bottomY, 0);
    valanceUvs.push(u, 1, u, 0);
  }
  for (let col = 0; col < valanceCols; col += 1) {
    const a = col * 2;
    valanceIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const valanceGeometry = new THREE.BufferGeometry();
  valanceGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(valancePositions, 3),
  );
  valanceGeometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(valanceUvs, 2),
  );
  valanceGeometry.setIndex(valanceIndices);
  valanceGeometry.computeVertexNormals();
  const valance = new THREE.Mesh(valanceGeometry, materials.awningEdge);
  valance.position.z = depth + 0.012;
  valance.castShadow = true;
  slope.add(valance);

  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, width + 0.12, 7),
    materials.trimBright,
  );
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, -0.015, depth + 0.03);
  slope.add(roll);

  [-width / 2 + 0.01, width / 2 - 0.01].forEach((x) => {
    const sideRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.14, depth + 0.02),
      materials.trim,
    );
    sideRail.position.set(x, -0.055, depth / 2);
    slope.add(sideRail);
  });

  // Visible diagonal stays carry the outer edge back to the wall.
  [-1.5, 1.5].forEach((x) => {
    const start = new THREE.Vector3(x, -0.6, 0.02);
    const end = new THREE.Vector3(x, -0.17, depth - 0.06);
    const direction = end.clone().sub(start);
    const stay = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, direction.length(), 6),
      materials.iron,
    );
    stay.position.copy(start).add(end).multiplyScalar(0.5);
    stay.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    stay.castShadow = true;
    pivot.add(stay);
    const wallPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.018, 10),
      materials.brass,
    );
    wallPlate.rotation.x = Math.PI / 2;
    wallPlate.position.set(x, -0.58, 0.035);
    pivot.add(wallPlate);
    const edgePlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.016, 10),
      materials.brass,
    );
    edgePlate.rotation.x = Math.PI / 2;
    edgePlate.position.set(x, -0.17, depth - 0.06);
    pivot.add(edgePlate);
  });

  const bulbGlows = [];
  [-0.82, 0.82].forEach((x) => {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5),
      materials.iron,
    );
    stem.position.set(x, -0.1, 0.77);
    slope.add(stem);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), materials.bulb);
    bulb.position.set(x, -0.17, 0.77);
    slope.add(bulb);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: materials.glowMap,
        color: '#ffd69b',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    );
    glow.scale.set(0.9, 0.9, 1);
    glow.position.set(x, -0.16, 0.79);
    slope.add(glow);
    bulbGlows.push(glow.material);
  });

  return { pivot, bulbGlows };
}

function buildBalcony(materials) {
  const balcony = new THREE.Group();
  const topY = B.balconyTop;
  const slabThickness = 0.21;
  const overview = B.balconyExtent;
  const frontZ = B.front + overview;
  const sideX = B.right + overview;
  const arcRadius = B.cornerRadius + overview;
  const sideEndZ = -1.82;
  const frontStartX = -4.42;
  const frontEndX = B.cornerX;

  // Straight floor plates.
  const frontPlate = new THREE.Mesh(
    new THREE.BoxGeometry(frontEndX - frontStartX, slabThickness, overview),
    materials.trim,
  );
  frontPlate.position.set(
    (frontStartX + frontEndX) / 2,
    topY - slabThickness / 2,
    B.front + overview / 2,
  );
  frontPlate.castShadow = true;
  frontPlate.receiveShadow = true;
  balcony.add(frontPlate);

  const sidePlate = new THREE.Mesh(
    new THREE.BoxGeometry(overview, slabThickness, B.cornerZ - sideEndZ),
    materials.trim,
  );
  sidePlate.position.set(
    B.right + overview / 2,
    topY - slabThickness / 2,
    (B.cornerZ + sideEndZ) / 2,
  );
  sidePlate.castShadow = true;
  sidePlate.receiveShadow = true;
  balcony.add(sidePlate);

  // Quarter-annulus floor around the rounded corner.
  const shape = new THREE.Shape();
  const outer = [];
  const inner = [];
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * (Math.PI / 2);
    outer.push([
      B.cornerX + Math.cos(angle) * arcRadius,
      -(B.cornerZ + Math.sin(angle) * arcRadius),
    ]);
    inner.push([
      B.cornerX + Math.cos(angle) * B.cornerRadius,
      -(B.cornerZ + Math.sin(angle) * B.cornerRadius),
    ]);
  }
  shape.moveTo(outer[0][0], outer[0][1]);
  outer.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  inner
    .slice()
    .reverse()
    .forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  const arcGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: slabThickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 24,
  });
  arcGeometry.rotateX(-Math.PI / 2);
  arcGeometry.translate(0, topY - slabThickness, 0);
  const arcPlate = new THREE.Mesh(arcGeometry, materials.trim);
  arcPlate.castShadow = true;
  arcPlate.receiveShadow = true;
  balcony.add(arcPlate);

  // Continuous stone lip around the outside.
  const lipPoints = [];
  lipPoints.push(new THREE.Vector3(frontStartX, topY - 0.03, frontZ));
  for (let i = 0; i <= 24; i += 1) {
    const angle = Math.PI / 2 - (i / 24) * (Math.PI / 2);
    lipPoints.push(
      new THREE.Vector3(
        B.cornerX + Math.cos(angle) * (arcRadius + 0.015),
        topY - 0.03,
        B.cornerZ + Math.sin(angle) * (arcRadius + 0.015),
      ),
    );
  }
  lipPoints.push(new THREE.Vector3(sideX + 0.015, topY - 0.03, sideEndZ));
  balcony.add(
    tubeFromPolyline(lipPoints, 0.055, materials.trimBright, {
      segments: 180,
      radialSegments: 5,
      castShadow: true,
    }),
  );

  // Supporting corbels below the slab.
  const bracketParts = [];
  const addBracket = (x, zwall, outward) => {
    const start = new THREE.Vector3(x, topY - 0.6, zwall + 0.01);
    const elbow = new THREE.Vector3(x, topY - 0.42, zwall + outward * 0.52);
    const end = new THREE.Vector3(x, topY - 0.21, zwall + outward * 0.9);
    const curve = new THREE.CatmullRomCurve3([start, elbow, end]);
    const tube = new THREE.TubeGeometry(curve, 10, 0.045, 5, false);
    bracketParts.push(tube);
    bracketParts.push(boxPart(0.16, 0.15, 0.3, x, topY - 0.6, zwall + 0.1));
  };
  [frontStartX + 0.35, -2.85, -0.6, 1.45].forEach((x) =>
    addBracket(x, B.front, 1),
  );
  [-0.55, 0.65, 1.55].forEach((z) => {
    const start = new THREE.Vector3(B.right + 0.01, topY - 0.6, z);
    const elbow = new THREE.Vector3(B.right + 0.52, topY - 0.42, z);
    const end = new THREE.Vector3(B.right + 0.9, topY - 0.21, z);
    const curve = new THREE.CatmullRomCurve3([start, elbow, end]);
    bracketParts.push(new THREE.TubeGeometry(curve, 10, 0.045, 5, false));
    bracketParts.push(boxPart(0.3, 0.15, 0.16, B.right + 0.1, topY - 0.6, z));
  });
  const brackets = mergeParts(bracketParts, materials.trim, {
    castShadow: true,
    receiveShadow: true,
  });
  if (brackets) balcony.add(brackets);

  // Railing geometry and instancing.
  const L1 = frontEndX - frontStartX;
  const L2 = arcRadius * (Math.PI / 2);
  const L3 = B.cornerZ - sideEndZ;
  const total = L1 + L2 + L3;
  const railBaseY = topY;
  const railTopY = topY + 1.05;
  const getStation = (distance) => {
    if (distance <= L1) {
      return {
        point: new THREE.Vector3(frontStartX + distance, railBaseY, frontZ),
        tangent: new THREE.Vector3(1, 0, 0),
        normal: new THREE.Vector3(0, 0, 1),
      };
    }
    if (distance <= L1 + L2) {
      const angle = Math.PI / 2 - (distance - L1) / arcRadius;
      return {
        point: new THREE.Vector3(
          B.cornerX + Math.cos(angle) * arcRadius,
          railBaseY,
          B.cornerZ + Math.sin(angle) * arcRadius,
        ),
        tangent: new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle)),
        normal: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      };
    }
    return {
      point: new THREE.Vector3(
        sideX,
        railBaseY,
        B.cornerZ - (distance - L1 - L2),
      ),
      tangent: new THREE.Vector3(0, 0, -1),
      normal: new THREE.Vector3(1, 0, 0),
    };
  };

  const railPoints = [];
  const lowerRailPoints = [];
  const lowerRail2Points = [];
  const sampleCount = 180;
  for (let i = 0; i <= sampleCount; i += 1) {
    const station = getStation((i / sampleCount) * total);
    railPoints.push(station.point.clone().setY(railTopY));
    lowerRailPoints.push(station.point.clone().setY(topY + 0.35));
    lowerRail2Points.push(station.point.clone().setY(topY + 0.69));
  }
  const topRail = tubeFromCurve(railPoints, 0.03, materials.iron, {
    segments: 230,
    radialSegments: 6,
    castShadow: true,
  });
  const lowerRail = tubeFromCurve(lowerRailPoints, 0.013, materials.iron, {
    segments: 180,
    radialSegments: 5,
    castShadow: true,
  });
  const lowerRail2 = tubeFromCurve(lowerRail2Points, 0.011, materials.iron, {
    segments: 180,
    radialSegments: 5,
    castShadow: true,
  });
  balcony.add(topRail, lowerRail, lowerRail2);

  const majorCount = Math.max(2, Math.round(total / 1.02));
  const postTransforms = [];
  const finialMatrices = [];
  const dummy = new THREE.Object3D();

  const addPost = (distance, radius, major = true, finial = true) => {
    const station = getStation(THREE.MathUtils.clamp(distance, 0, total));
    postTransforms.push({
      x: station.point.x,
      z: station.point.z,
      radius,
      height: 1.03,
    });
    if (finial) {
      finialMatrices.push({
        x: station.point.x,
        y: railTopY + 0.02,
        z: station.point.z,
      });
    }
    if (major) {
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.07, 0.1),
        materials.iron,
      );
      bracket.position.set(station.point.x, topY + 0.02, station.point.z);
      balcony.add(bracket);
    }
  };

  for (let i = 0; i <= majorCount; i += 1) {
    addPost((i / majorCount) * total, 0.021, true, true);
  }

  // Two slim uprights and one scroll panel per bay.
  const scrollStations = [];
  for (let i = 0; i < majorCount; i += 1) {
    const d0 = (i / majorCount) * total;
    const d1 = ((i + 1) / majorCount) * total;
    const width = d1 - d0;
    addPost(d0 + width * 0.34, 0.0095, false, false);
    addPost(d0 + width * 0.66, 0.0095, false, false);
    if (width > 0.43) {
      const middle = (d0 + d1) / 2;
      scrollStations.push(getStation(middle));
    }
  }

  const postGeometry = new THREE.CylinderGeometry(1, 1.22, 1, 5, 1);
  postGeometry.translate(0, 0.5, 0);
  const postMesh = new THREE.InstancedMesh(
    postGeometry,
    materials.iron,
    postTransforms.length,
  );
  postTransforms.forEach((post, index) => {
    dummy.position.set(post.x, topY, post.z);
    dummy.scale.set(post.radius, post.height, post.radius);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    postMesh.setMatrixAt(index, dummy.matrix);
  });
  postMesh.castShadow = true;
  postMesh.receiveShadow = true;
  postMesh.instanceMatrix.needsUpdate = true;
  balcony.add(postMesh);

  const finialGeometry = new THREE.SphereGeometry(1, 8, 6);
  const finialMesh = new THREE.InstancedMesh(
    finialGeometry,
    materials.iron,
    finialMatrices.length,
  );
  finialMatrices.forEach((position, index) => {
    dummy.position.set(position.x, position.y, position.z);
    dummy.scale.setScalar(0.038);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    finialMesh.setMatrixAt(index, dummy.matrix);
  });
  finialMesh.castShadow = true;
  finialMesh.instanceMatrix.needsUpdate = true;
  balcony.add(finialMesh);

  // A curled iron scroll, made from three tubes and shared across the balcony.
  const scrollGroup = new THREE.Group();
  const makeCurl = (sign) => {
    const pts = [
      new THREE.Vector3(0, 0.16, 0),
      new THREE.Vector3(0.02 * sign, 0.29, 0),
      new THREE.Vector3(0.095 * sign, 0.38, 0),
      new THREE.Vector3(0.185 * sign, 0.37, 0),
      new THREE.Vector3(0.235 * sign, 0.29, 0),
      new THREE.Vector3(0.21 * sign, 0.2, 0),
      new THREE.Vector3(0.15 * sign, 0.16, 0),
      new THREE.Vector3(0.105 * sign, 0.21, 0),
      new THREE.Vector3(0.12 * sign, 0.27, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 22, 0.011, 4, false);
  };
  scrollGroup.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.17, 0),
          new THREE.Vector3(0, 0.33, 0),
          new THREE.Vector3(0, 0.46, 0),
          new THREE.Vector3(0.08, 0.55, 0),
          new THREE.Vector3(0.025, 0.6, 0),
        ]),
        14,
        0.011,
        4,
        false,
      ),
      materials.iron,
    ),
    new THREE.Mesh(makeCurl(1), materials.iron),
    new THREE.Mesh(makeCurl(-1), materials.iron),
  );
  const scrollGeometry = (() => {
    const meshes = [];
    scrollGroup.traverse((child) => {
      if (child.isMesh) meshes.push(child.geometry.clone());
    });
    return mergeParts(meshes, materials.iron, {
      castShadow: true,
      receiveShadow: false,
    }).geometry;
  })();
  const scrollMesh = new THREE.InstancedMesh(
    scrollGeometry,
    materials.iron,
    scrollStations.length,
  );
  const basis = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  scrollStations.forEach((station, index) => {
    const normal = station.normal.clone().setY(0).normalize();
    const tangent = station.tangent.clone().setY(0).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    basis.makeBasis(tangent, up, normal);
    quat.setFromRotationMatrix(basis);
    dummy.position.set(station.point.x, topY + 0.24, station.point.z);
    dummy.quaternion.copy(quat);
    dummy.scale.setScalar(0.94);
    dummy.updateMatrix();
    scrollMesh.setMatrixAt(index, dummy.matrix);
  });
  scrollMesh.castShadow = true;
  scrollMesh.instanceMatrix.needsUpdate = true;
  balcony.add(scrollMesh);

  // Return rails at both open ends.
  const addReturnRail = (from, to) => {
    const p0 = from.clone().setY(topY + 1.05);
    const p1 = to.clone().setY(topY + 1.05);
    balcony.add(
      tubeFromCurve([p0, p1], 0.03, materials.iron, {
        segments: 8,
        radialSegments: 6,
        castShadow: true,
      }),
    );
    balcony.add(
      tubeFromCurve([from.clone().setY(topY + 0.35), to.clone().setY(topY + 0.35)], 0.013, materials.iron, {
        segments: 5,
        radialSegments: 5,
      }),
    );
    for (let i = 0; i < 3; i += 1) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.014, 1.03, 5),
        materials.iron,
      );
      post.position
        .copy(from)
        .lerp(to, i / 2)
        .setY(topY + 0.515);
      post.castShadow = true;
      balcony.add(post);
    }
  };
  addReturnRail(
    new THREE.Vector3(frontStartX, 0, frontZ),
    new THREE.Vector3(frontStartX, 0, B.front + 0.02),
  );
  addReturnRail(
    new THREE.Vector3(sideX, 0, sideEndZ),
    new THREE.Vector3(B.right + 0.02, 0, sideEndZ),
  );

  return balcony;
}

function addRoofline(group, materials) {
  const inset = B.thirdInset;

  // A real roof deck sits inside a low, continuous parapet ring.
  addFootprintBlock(group, materials.roofDeck, {
    offset: -inset + 0.01,
    height: 0.065,
    y: 9.34,
    shadow: false,
  });

  const outerOffset = -inset + 0.045;
  const ringThickness = 0.2;
  const ringHeight = 0.3;
  const ringBaseY = 9.36;
  const shape = footprintShape(outerOffset);
  const innerShape = footprintShape(outerOffset - ringThickness);
  const outerPoints = shape.getPoints(48);
  const innerPoints = innerShape.getPoints(48);
  const outerClockwise = THREE.ShapeUtils.isClockWise(outerPoints);
  if (THREE.ShapeUtils.isClockWise(innerPoints) === outerClockwise) {
    innerPoints.reverse();
  }
  const hole = new THREE.Path();
  hole.moveTo(innerPoints[0].x, innerPoints[0].y);
  innerPoints.slice(1).forEach((point) => hole.lineTo(point.x, point.y));
  hole.closePath();
  shape.holes.push(hole);
  const ringGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: ringHeight,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 40,
  });
  ringGeometry.rotateX(-Math.PI / 2);
  ringGeometry.translate(0, ringBaseY, 0);
  const ring = new THREE.Mesh(ringGeometry, materials.trim);
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  const capGeometry = (() => {
    const capShape = footprintShape(outerOffset + 0.035);
    const capInner = footprintShape(outerOffset - ringThickness - 0.035);
    const capOuterPoints = capShape.getPoints(48);
    const capInnerPoints = capInner.getPoints(48);
    const cw = THREE.ShapeUtils.isClockWise(capOuterPoints);
    if (THREE.ShapeUtils.isClockWise(capInnerPoints) === cw) capInnerPoints.reverse();
    const capHole = new THREE.Path();
    capHole.moveTo(capInnerPoints[0].x, capInnerPoints[0].y);
    capInnerPoints.slice(1).forEach((point) => capHole.lineTo(point.x, point.y));
    capHole.closePath();
    capShape.holes.push(capHole);
    const geometry = new THREE.ExtrudeGeometry(capShape, {
      depth: 0.075,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 40,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, ringBaseY + ringHeight, 0);
    return geometry;
  })();
  const cap = new THREE.Mesh(capGeometry, materials.trimBright);
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  const coping = tubeFromPolyline(
    footprintOutline(outerOffset + 0.045, ringBaseY + ringHeight + 0.085, 32),
    0.077,
    materials.trimBright,
    { segments: 230, radialSegments: 6, castShadow: true },
  );
  group.add(coping);

  addDentilsForParapet(group, materials);

  // A low roof vent and a slim rainwater tank break up the dark deck without
  // turning the roof into a second subject.
  const vent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.34, 8),
    materials.ironSoft,
  );
  vent.position.set(-1.95, 9.55, -2.75);
  vent.castShadow = true;
  group.add(vent);
  const ventCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.23, 0.055, 8),
    materials.iron,
  );
  ventCap.position.set(-1.95, 9.74, -2.75);
  group.add(ventCap);

  const hatch = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.17, 0.74),
    materials.deckWoodDark,
  );
  hatch.position.set(1.35, 9.455, -1.65);
  hatch.castShadow = true;
  hatch.receiveShadow = true;
  group.add(hatch);

  // Glass roof light, warm from the interior after dusk.
  const skylightGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.58),
    materials.windowInteriors[0],
  );
  skylightGlow.rotation.x = -Math.PI / 2;
  skylightGlow.position.set(1.35, 9.543, -1.65);
  group.add(skylightGlow);
  const skylightGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 0.64),
    materials.glass,
  );
  skylightGlass.rotation.x = -Math.PI / 2;
  skylightGlass.position.set(1.35, 9.551, -1.65);
  skylightGlass.renderOrder = 3;
  group.add(skylightGlass);
  const skylightFrameParts = [
    boxPart(0.98, 0.035, 0.06, 1.35, 9.556, -2.03),
    boxPart(0.98, 0.035, 0.06, 1.35, 9.556, -1.27),
    boxPart(0.06, 0.035, 0.8, 0.87, 9.556, -1.65),
    boxPart(0.06, 0.035, 0.8, 1.83, 9.556, -1.65),
    boxPart(0.98, 0.028, 0.028, 1.35, 9.56, -1.65),
  ];
  group.add(
    mergeParts(skylightFrameParts, materials.brass, {
      castShadow: true,
      receiveShadow: true,
    }),
  );
}

function addBackDoor(group, materials) {
  const backDoor = new THREE.Group();
  const parts = [
    boxPart(1.16, 2.24, 0.08, 0, 1.12, 0.04),
    boxPart(0.87, 0.87, 0.025, 0, 1.92, 0.09),
    boxPart(0.87, 0.6, 0.025, 0, 0.48, 0.09),
    boxPart(0.74, 0.05, 0.04, 0, 0.9, 0.11),
    boxPart(0.045, 0.045, 0.05, 0.31, 1.03, 0.12),
  ];
  const white = mergeParts(parts, materials.trim, {
    castShadow: true,
    receiveShadow: true,
  });
  backDoor.add(white);
  const dark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.88),
    materials.doorDark,
  );
  dark.position.set(0, 1.94, 0.105);
  backDoor.add(dark);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.77),
    materials.glass,
  );
  glass.position.set(0, 1.94, 0.119);
  glass.renderOrder = 3;
  backDoor.add(glass);
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.09, 0.35),
    materials.stone,
  );
  step.position.set(0, -0.04, 0.25);
  step.receiveShadow = true;
  backDoor.add(step);
  backDoor.position.set(3.15, SIDEWALK + 0.05, B.back - 0.035);
  backDoor.rotation.y = Math.PI;
  group.add(backDoor);
}

export function buildBuilding(materials) {
  const group = new THREE.Group();
  group.name = 'corner-building';
  const sconceGlows = [];
  let awningBulbGlows = [];

  // Main mass: cream stucco over a sandstone base.
  addFootprintBlock(group, materials.stone, {
    offset: 0.055,
    height: 0.57,
    y: SIDEWALK - 0.03,
    shadow: true,
  });
  addFootprintBlock(group, materials.wall, {
    offset: 0,
    height: B.secondTop - SIDEWALK,
    y: SIDEWALK,
    shadow: true,
  });
  addFootprintBlock(group, materials.trim, {
    offset: 0.035,
    height: 0.09,
    y: 0.68,
    shadow: true,
  });

  // Ground floor is a touch warmer, as if worn by the street.
  // Floor divisions. Only the first floor carries a wraparound balcony.
  addCornice(group, materials, {
    y: 3.61,
    projection: 0.16,
    height: 0.2,
    dentils: false,
  });
  addCornice(group, materials, {
    y: 6.47,
    projection: 0.2,
    height: 0.22,
    dentils: true,
  });

  // Recessed third storey.
  addFootprintBlock(group, materials.wallUpper, {
    offset: -B.thirdInset,
    height: 9.35 - 6.68,
    y: 6.68,
    shadow: true,
  });
  addFootprintBlock(group, materials.trim, {
    offset: -B.thirdInset + 0.01,
    height: 0.085,
    y: 6.68,
    shadow: true,
  });
  addCornice(group, materials, {
    y: 9.26,
    projection: 0.14,
    height: 0.14,
    dentils: false,
    baseOffset: -B.thirdInset,
  });

  addWindows(group, materials);
  addPosters(group, materials);
  addWallQuoins(group, materials);

  const doorData = addEntryDoor(group, materials);
  sconceGlows.push(...doorData.sconceGlows);
  const awningData = addAwning(group, materials, doorData.doorPoint);
  awningBulbGlows = awningData.bulbGlows;

  group.add(buildBalcony(materials));
  addRoofline(group, materials);
  const roofTerrace = addRoofTerrace(group, materials);
  sconceGlows.push(...roofTerrace.glowMaterials);
  addBackDoor(group, materials);

  addDownpipe(group, materials, B.left + 0.2, B.front + 0.055, 6.2, 0);
  addDownpipe(group, materials, B.right - 0.12, B.back - 0.055, 6.15, Math.PI);

  group.userData.glowMaterials = [...sconceGlows, ...awningBulbGlows];
  group.userData.roofLight = roofTerrace.light;
  group.userData.warmSpots = {
    door: {
      x: B.cornerX + Math.cos(CORNER_ANGLE) * (B.cornerRadius + 1.15),
      y: 2.35,
      z: B.cornerZ + Math.sin(CORNER_ANGLE) * (B.cornerRadius + 1.15),
    },
    awning: {
      x: B.cornerX + Math.cos(CORNER_ANGLE) * (B.cornerRadius + 0.72),
      y: 3.12,
      z: B.cornerZ + Math.sin(CORNER_ANGLE) * (B.cornerRadius + 0.72),
    },
  };
  return group;
}
