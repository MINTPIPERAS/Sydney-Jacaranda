import * as THREE from 'three';
import {
  boxPart,
  mergeParts,
  mulberry32,
  rand,
  tubeFromCurve,
} from './utils.js';

/**
 * A small rooftop terrace tucked inside the parapet: teak deck, bistro table,
 * two chairs, flowering planters and a sagging run of warm festoon lights.
 */
export function addRoofTerrace(group, materials) {
  const random = mulberry32(6412);
  const terrace = new THREE.Group();
  terrace.name = 'roof-terrace';
  group.add(terrace);

  const roofY = 9.405;
  const deckY = roofY + 0.05;
  const deckTop = deckY + 0.028;
  const deckX = -1.18;
  const deckZ = 1.25;
  const deckW = 4.08;
  const deckD = 2.58;

  const plankParts = [];
  for (let i = 0; i < 11; i += 1) {
    const z = deckZ - deckD / 2 + 0.15 + i * 0.215;
    plankParts.push(
      boxPart(
        deckW - 0.12,
        0.055,
        0.205,
        deckX + rand(random, -0.018, 0.018),
        deckY,
        z,
      ),
    );
  }
  terrace.add(
    mergeParts(plankParts, materials.deckWood, {
      castShadow: true,
      receiveShadow: true,
    }),
  );

  const deckTrim = [
    boxPart(deckW, 0.07, 0.08, deckX, deckY + 0.038, deckZ - deckD / 2),
    boxPart(deckW, 0.07, 0.08, deckX, deckY + 0.038, deckZ + deckD / 2),
    boxPart(0.08, 0.07, deckD, deckX - deckW / 2, deckY + 0.038, deckZ),
    boxPart(0.08, 0.07, deckD, deckX + deckW / 2, deckY + 0.038, deckZ),
  ];
  terrace.add(
    mergeParts(deckTrim, materials.deckWoodDark, {
      castShadow: true,
      receiveShadow: true,
    }),
  );

  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(1.88, 1.2),
    materials.trim,
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(deckX - 0.05, deckTop + 0.004, deckZ);
  rug.receiveShadow = true;
  terrace.add(rug);
  for (const offset of [-0.62, -0.21, 0.21, 0.62]) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.006, 1.17),
      materials.benchWood,
    );
    stripe.position.set(deckX - 0.05 + offset, deckTop + 0.009, deckZ);
    stripe.castShadow = false;
    terrace.add(stripe);
  }

  // Cast-iron pedestal table with a pale stone top.
  const tableX = -1.55;
  const tableZ = 1.23;
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.06, 0.67, 9),
    materials.iron,
  );
  pedestal.position.set(tableX, deckTop + 0.355, tableZ);
  pedestal.castShadow = true;
  terrace.add(pedestal);
  const tableFoot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.035, 12),
    materials.iron,
  );
  tableFoot.position.set(tableX, deckTop + 0.018, tableZ);
  tableFoot.castShadow = true;
  tableFoot.receiveShadow = true;
  terrace.add(tableFoot);
  const tabletop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.045, 24),
    materials.stone,
  );
  tabletop.position.set(tableX, deckTop + 0.71, tableZ);
  tabletop.castShadow = true;
  tabletop.receiveShadow = true;
  terrace.add(tabletop);
  const tableInset = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.012, 24),
    materials.trim,
  );
  tableInset.position.set(tableX, deckTop + 0.738, tableZ);
  terrace.add(tableInset);

  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.045, 0.16, 9),
    materials.roofPot,
  );
  vase.position.set(tableX, deckTop + 0.82, tableZ);
  vase.castShadow = true;
  terrace.add(vase);
  const vaseBlooms = [];
  for (let i = 0; i < 5; i += 1) {
    const bloom = new THREE.IcosahedronGeometry(0.055, 1);
    bloom.scale(1, 1.35, 1);
    bloom.translate(
      tableX + rand(random, -0.12, 0.12),
      deckTop + 0.93 + rand(random, 0, 0.1),
      tableZ + rand(random, -0.1, 0.1),
    );
    vaseBlooms.push(bloom);
  }
  terrace.add(
    mergeParts(vaseBlooms, materials.roofBloom, {
      castShadow: false,
      receiveShadow: false,
    }),
  );

  const makeChair = () => {
    const chair = new THREE.Group();
    const metal = [];
    const wood = [];
    for (const x of [-0.19, 0.19]) {
      for (const z of [-0.17, 0.19]) {
        metal.push(boxPart(0.025, 0.43, 0.025, x, 0.215, z));
      }
      metal.push(boxPart(0.026, 0.48, 0.026, x, 0.67, -0.19));
      metal.push(boxPart(0.026, 0.045, 0.4, x, 0.44, 0.01));
      metal.push(boxPart(0.026, 0.035, 0.34, x, 0.8, -0.18));
    }
    for (let i = 0; i < 3; i += 1) {
      wood.push(boxPart(0.42, 0.026, 0.105, 0, 0.46, -0.12 + i * 0.115));
    }
    for (let i = 0; i < 2; i += 1) {
      wood.push(boxPart(0.4, 0.075, 0.028, 0, 0.59 + i * 0.13, -0.205));
    }
    chair.add(
      mergeParts(metal, materials.iron, {
        castShadow: true,
        receiveShadow: true,
      }),
      mergeParts(wood, materials.deckWood, {
        castShadow: true,
        receiveShadow: true,
      }),
    );
    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.045, 0.32),
      materials.benchWood,
    );
    cushion.position.set(0, 0.49, 0);
    cushion.castShadow = true;
    chair.add(cushion);
    return chair;
  };

  const leftChair = makeChair();
  leftChair.position.set(-2.43, deckTop, tableZ);
  leftChair.rotation.y = Math.PI / 2;
  terrace.add(leftChair);
  const rightChair = makeChair();
  rightChair.position.set(-0.67, deckTop, tableZ);
  rightChair.rotation.y = -Math.PI / 2;
  terrace.add(rightChair);

  const makePlanter = (x, z, width, depth, height, leafDensity = 1) => {
    const planter = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      materials.deckWoodDark,
    );
    box.position.y = height / 2;
    box.castShadow = true;
    box.receiveShadow = true;
    planter.add(box);
    const rimParts = [
      boxPart(width + 0.04, 0.055, 0.045, 0, height, -depth / 2),
      boxPart(width + 0.04, 0.055, 0.045, 0, height, depth / 2),
      boxPart(0.045, 0.055, depth, -width / 2, height, 0),
      boxPart(0.045, 0.055, depth, width / 2, height, 0),
    ];
    planter.add(
      mergeParts(rimParts, materials.deckWood, {
        castShadow: true,
        receiveShadow: true,
      }),
    );
    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.09, 0.035, depth - 0.09),
      materials.soil,
    );
    soil.position.y = height - 0.006;
    planter.add(soil);

    const leaves = [];
    const leafCount = Math.max(5, Math.round(((width * depth) / 0.13) * leafDensity));
    for (let i = 0; i < leafCount; i += 1) {
      const blob = new THREE.IcosahedronGeometry(rand(random, 0.1, 0.19), 1);
      blob.scale(1, rand(random, 0.65, 1.2), 1);
      blob.translate(
        rand(random, -width * 0.4, width * 0.4),
        height + rand(random, 0.1, 0.3),
        rand(random, -depth * 0.38, depth * 0.38),
      );
      leaves.push(blob);
    }
    planter.add(
      mergeParts(leaves, materials.roofLeaf, {
        castShadow: true,
        receiveShadow: true,
      }),
    );

    const blooms = [];
    for (let i = 0; i < 5 + Math.round(width * 2); i += 1) {
      const bloom = new THREE.IcosahedronGeometry(0.055, 1);
      bloom.translate(
        rand(random, -width * 0.36, width * 0.36),
        height + rand(random, 0.24, 0.46),
        rand(random, -depth * 0.34, depth * 0.34),
      );
      blooms.push(bloom);
    }
    planter.add(
      mergeParts(blooms, materials.roofBloom, {
        castShadow: false,
        receiveShadow: false,
      }),
    );
    planter.position.set(x, roofY + 0.01, z);
    return planter;
  };

  terrace.add(makePlanter(-3.72, 1.25, 0.44, 1.82, 0.36, 1.15));
  terrace.add(makePlanter(-0.55, 3.07, 1.6, 0.36, 0.34, 0.9));
  terrace.add(makePlanter(3.53, 0.2, 0.4, 1.55, 0.33, 0.95));

  // One taller potted shrub breaks the low roof line gently.
  const pot = new THREE.Group();
  const potMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.4, 12),
    materials.roofPot,
  );
  potMesh.position.y = 0.2;
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  pot.add(potMesh);
  const potSoil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.025, 12),
    materials.soil,
  );
  potSoil.position.y = 0.4;
  pot.add(potSoil);
  for (let i = 0; i < 3; i += 1) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.022, 0.62, 5),
      materials.deckWoodDark,
    );
    stem.position.set(
      rand(random, -0.08, 0.08),
      0.68,
      rand(random, -0.08, 0.08),
    );
    stem.rotation.z = rand(random, -0.3, 0.3);
    stem.rotation.x = rand(random, -0.25, 0.25);
    stem.castShadow = true;
    pot.add(stem);
  }
  const canopy = [];
  for (let i = 0; i < 6; i += 1) {
    const blob = new THREE.IcosahedronGeometry(rand(random, 0.16, 0.27), 1);
    blob.scale(1, rand(random, 0.7, 1.1), 1);
    blob.translate(
      rand(random, -0.24, 0.24),
      rand(random, 0.88, 1.2),
      rand(random, -0.24, 0.24),
    );
    canopy.push(blob);
  }
  pot.add(
    mergeParts(canopy, materials.roofLeafLight, {
      castShadow: true,
      receiveShadow: true,
    }),
  );
  const potBlooms = [];
  for (let i = 0; i < 5; i += 1) {
    const bloom = new THREE.IcosahedronGeometry(0.055, 1);
    bloom.translate(
      rand(random, -0.22, 0.22),
      rand(random, 1.0, 1.28),
      rand(random, -0.22, 0.22),
    );
    potBlooms.push(bloom);
  }
  pot.add(
    mergeParts(potBlooms, materials.roofBloom, {
      castShadow: false,
      receiveShadow: false,
    }),
  );
  pot.position.set(-3.72, roofY + 0.01, 2.92);
  terrace.add(pot);

  // Festoon lights on two slim posts.
  const postA = new THREE.Vector3(-3.08, deckTop + 0.88, 0.26);
  const postB = new THREE.Vector3(0.72, deckTop + 0.88, 2.36);
  const postParts = [];
  [postA, postB].forEach((post) => {
    postParts.push(
      boxPart(0.035, 0.88, 0.035, post.x, deckTop + 0.44, post.z),
      boxPart(0.12, 0.04, 0.12, post.x, deckTop + 0.02, post.z),
      boxPart(0.09, 0.026, 0.035, post.x, post.y, post.z),
    );
  });
  terrace.add(
    mergeParts(postParts, materials.iron, {
      castShadow: true,
      receiveShadow: true,
    }),
  );

  const wirePoints = [];
  const bulbPoints = [];
  const bulbCount = 13;
  const start = postA.clone();
  const end = postB.clone();
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const point = start.clone().lerp(end, t);
    point.y -= Math.sin(t * Math.PI) * 0.4;
    wirePoints.push(point);
  }
  terrace.add(
    tubeFromCurve(wirePoints, 0.007, materials.iron, {
      segments: 36,
      radialSegments: 4,
      castShadow: false,
      receiveShadow: false,
    }),
  );
  for (let i = 0; i < bulbCount; i += 1) {
    const t = (i + 1) / (bulbCount + 1);
    const point = start.clone().lerp(end, t);
    point.y -= Math.sin(t * Math.PI) * 0.4;
    bulbPoints.push(point);
  }
  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.034, 6, 5),
    materials.bulb,
    bulbPoints.length,
  );
  const bulbDummy = new THREE.Object3D();
  bulbPoints.forEach((point, index) => {
    bulbDummy.position.copy(point);
    bulbDummy.updateMatrix();
    bulbs.setMatrixAt(index, bulbDummy.matrix);
  });
  bulbs.instanceMatrix.needsUpdate = true;
  bulbs.castShadow = false;
  terrace.add(bulbs);

  const glowMaterial = new THREE.PointsMaterial({
    map: materials.glowMap,
    color: '#ffd49b',
    size: 0.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  });
  const glowGeometry = new THREE.BufferGeometry().setFromPoints(
    bulbPoints.map((point) =>
      point.clone().add(new THREE.Vector3(0, -0.012, 0)),
    ),
  );
  terrace.add(new THREE.Points(glowGeometry, glowMaterial));

  const roofLight = new THREE.PointLight('#ffc27c', 0, 4.8, 1.9);
  roofLight.position.set(-1.15, deckTop + 1.55, 1.25);
  terrace.add(roofLight);

  return { glowMaterials: [glowMaterial], light: roofLight };
}
