import * as THREE from 'three';
import { clamp, easeInOutCubic, lerp } from './utils.js';

const C = (value) => new THREE.Color(value);

const PRESETS = [
  {
    name: 'day',
    exposure: 1.08,
    fog: C('#e7e2dc'),
    fogDensity: 0.0075,
    hemiSky: C('#d9e7f1'),
    hemiGround: C('#c8b39c'),
    hemiIntensity: 0.58,
    key: C('#fff1db'),
    keyIntensity: 2.2,
    keyPosition: new THREE.Vector3(-9.5, 15.8, 10.5),
    fill: C('#b9c8d8'),
    fillIntensity: 0.33,
    fillPosition: new THREE.Vector3(10, 7.5, -8.5),
    windowInteriors: [C('#2d2c33'), C('#29282d'), C('#24242b')],
    glass: C('#aec4cd'),
    glassOpacity: 0.58,
    glassEnv: 1.8,
    glassRoughness: 0.075,
    lampGlass: C('#d9cfb9'),
    bulb: C('#e7dbc4'),
    lampIntensity: 0,
    lampPoint: 0,
    entranceLight: 0,
    glowOpacity: 0,
    paperTint: C('#ffffff'),
    roadPaintOpacity: 0.58,
    blossomEmissive: 0.018,
    environmentIntensity: 0.9,
  },
  {
    name: 'dusk',
    exposure: 1.04,
    fog: C('#d8c5c9'),
    fogDensity: 0.009,
    hemiSky: C('#a7abd4'),
    hemiGround: C('#6d5b56'),
    hemiIntensity: 0.7,
    key: C('#ffd0a2'),
    keyIntensity: 1.8,
    keyPosition: new THREE.Vector3(12.5, 6.1, 9.2),
    fill: C('#6c8bd2'),
    fillIntensity: 1.02,
    fillPosition: new THREE.Vector3(-10, 7, -7),
    windowInteriors: [C('#dbb07b'), C('#a17b63'), C('#3e3a46')],
    glass: C('#bfb6c2'),
    glassOpacity: 0.42,
    glassEnv: 1.15,
    glassRoughness: 0.09,
    lampGlass: C('#ffd29b'),
    bulb: C('#ffdbab'),
    lampIntensity: 23,
    lampPoint: 2.8,
    entranceLight: 1.4,
    glowOpacity: 0.44,
    paperTint: C('#d6c2bd'),
    roadPaintOpacity: 0.48,
    blossomEmissive: 0.045,
    environmentIntensity: 0.72,
  },
  {
    name: 'night',
    exposure: 1.08,
    fog: C('#1d2133'),
    fogDensity: 0.0095,
    hemiSky: C('#4a5689'),
    hemiGround: C('#211c2a'),
    hemiIntensity: 0.76,
    key: C('#9bb2e9'),
    keyIntensity: 0.84,
    keyPosition: new THREE.Vector3(-9.5, 13.5, -7.5),
    fill: C('#314e86'),
    fillIntensity: 0.3,
    fillPosition: new THREE.Vector3(9, 6, 7),
    windowInteriors: [C('#f5c98f'), C('#dca06c'), C('#3a3548')],
    glass: C('#6f7b97'),
    glassOpacity: 0.34,
    glassEnv: 0.8,
    glassRoughness: 0.12,
    lampGlass: C('#ffe1a7'),
    bulb: C('#ffe8bd'),
    lampIntensity: 78,
    lampPoint: 12.5,
    entranceLight: 4.4,
    glowOpacity: 0.86,
    paperTint: C('#625d70'),
    roadPaintOpacity: 0.4,
    blossomEmissive: 0.055,
    environmentIntensity: 0.32,
  },
];

function resolvePhase(phase) {
  if (phase <= 1) {
    return {
      a: PRESETS[0],
      b: PRESETS[1],
      t: clamp(phase, 0, 1),
    };
  }
  return {
    a: PRESETS[1],
    b: PRESETS[2],
    t: clamp(phase - 1, 0, 1),
  };
}

export function createAtmosphere({
  scene,
  renderer,
  materials,
  lamps,
  building,
  isMobile = false,
}) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1);
  scene.add(hemi);

  const key = new THREE.DirectionalLight('#ffffff', 2);
  key.castShadow = true;
  key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 52;
  key.shadow.camera.left = -16;
  key.shadow.camera.right = 16;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -14;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.025;
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight('#ffffff', 0.5);
  fill.castShadow = false;
  fill.target.position.set(0, 0, 0);
  scene.add(fill, fill.target);

  const doorWarm = new THREE.PointLight('#ffb56e', 0, 4.8, 1.8);
  doorWarm.position.set(
    building.userData.warmSpots.door.x,
    building.userData.warmSpots.door.y,
    building.userData.warmSpots.door.z,
  );
  const awningWarm = new THREE.PointLight('#ffc17d', 0, 3.2, 1.8);
  awningWarm.position.set(
    building.userData.warmSpots.awning.x,
    building.userData.warmSpots.awning.y,
    building.userData.warmSpots.awning.z,
  );
  scene.add(doorWarm, awningWarm);

  const spill = new THREE.PointLight('#ffc785', 0, 5.5, 1.7);
  spill.position.set(1.6, 3.3, 4.85);
  const windowSpillFront = new THREE.PointLight('#ffbd75', 0, 3.4, 1.8);
  windowSpillFront.position.set(0.2, 2.15, 4.94);
  const windowSpillRight = new THREE.PointLight('#ffbd75', 0, 3.2, 1.8);
  windowSpillRight.position.set(4.96, 2.0, -0.55);
  scene.add(spill, windowSpillFront, windowSpillRight);

  scene.fog = new THREE.FogExp2('#e7e2dc', 0.0075);
  scene.environment = materials.envMap;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.9;

  const warmGlowMaterials = [
    ...lamps.map((lamp) => lamp.glowMaterial),
    ...(building.userData.glowMaterials ?? []),
  ];
  const lampPointLights = lamps.map((lamp) => lamp.point);
  const roofLight = building.userData.roofLight ?? null;
  const lampSpotLights = lamps.map((lamp) => lamp.spot);
  const posterMaterials = [...materials.posterPapers, ...materials.magazineCovers];
  const reflectiveMaterials = [
    materials.iron,
    materials.ironSoft,
    materials.silver,
    materials.brass,
    materials.bikeFrame,
  ];

  let phase = 0;
  let transition = null;
  let lastShadowUpdate = 0;
  let lastEmittedName = 'day';
  let uiName = 'day';

  const state = {
    currentTimeOfDay: 'day',
    phase,
  };

  const setUIActive = (name) => {
    document.body.dataset.time = name;
    document
      .querySelectorAll('[data-time-choice]')
      .forEach((button) => {
        const active = button.dataset.timeChoice === name;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
  };

  const apply = (nextPhase, forceShadow = false) => {
    phase = nextPhase;
    const { a, b, t } = resolvePhase(phase);
    const mix = (below, above = below) => lerp(below, above, t);
    const colorMix = (below, above, target) =>
      target.copy(below).lerp(above, t);

    renderer.toneMappingExposure = mix(a.exposure, b.exposure);
    colorMix(a.fog, b.fog, scene.fog.color);
    scene.fog.density = mix(a.fogDensity, b.fogDensity);
    scene.environmentIntensity = mix(
      a.environmentIntensity,
      b.environmentIntensity,
    );

    colorMix(a.hemiSky, b.hemiSky, hemi.color);
    colorMix(a.hemiGround, b.hemiGround, hemi.groundColor);
    hemi.intensity = mix(a.hemiIntensity, b.hemiIntensity);

    colorMix(a.key, b.key, key.color);
    key.intensity = mix(a.keyIntensity, b.keyIntensity);
    key.position.lerpVectors(a.keyPosition, b.keyPosition, t);

    colorMix(a.fill, b.fill, fill.color);
    fill.intensity = mix(a.fillIntensity, b.fillIntensity);
    fill.position.lerpVectors(a.fillPosition, b.fillPosition, t);

    materials.windowInteriors.forEach((material, index) => {
      colorMix(
        a.windowInteriors[index],
        b.windowInteriors[index],
        material.color,
      );
    });

    colorMix(a.glass, b.glass, materials.glass.color);
    materials.glass.opacity = mix(a.glassOpacity, b.glassOpacity);
    materials.glass.envMapIntensity = mix(a.glassEnv, b.glassEnv);
    materials.glass.roughness = mix(a.glassRoughness, b.glassRoughness);
    materials.doorGlass.color.lerpColors(
      a.glass.clone().lerp(C('#ffffff'), 0.08),
      b.glass.clone().lerp(C('#ffffff'), 0.08),
      t,
    );
    materials.doorGlass.envMapIntensity = materials.glass.envMapIntensity;

    colorMix(a.lampGlass, b.lampGlass, materials.lampGlass.color);
    colorMix(a.bulb, b.bulb, materials.bulb.color);

    const lampIntensity = mix(a.lampIntensity, b.lampIntensity);
    lampSpotLights.forEach((light) => {
      light.intensity = lampIntensity;
    });
    const lampPoint = mix(a.lampPoint, b.lampPoint);
    lampPointLights.forEach((light) => {
      light.intensity = lampPoint;
    });
    const entranceLight = mix(a.entranceLight, b.entranceLight);
    doorWarm.intensity = entranceLight * 1.1;
    awningWarm.intensity = entranceLight * 0.7;
    spill.intensity = entranceLight * 0.55;
    windowSpillFront.intensity = entranceLight * 0.7;
    windowSpillRight.intensity = entranceLight * 0.55;
    if (roofLight) roofLight.intensity = entranceLight * 0.26;

    const glow = mix(a.glowOpacity, b.glowOpacity);
    warmGlowMaterials.forEach((material) => {
      material.opacity = glow;
    });

    const tint = a.paperTint.clone().lerp(b.paperTint, t);
    posterMaterials.forEach((material) => {
      material.color.copy(tint);
    });
    materials.roadPaint.opacity = mix(a.roadPaintOpacity, b.roadPaintOpacity);
    materials.blossom.emissiveIntensity = mix(
      a.blossomEmissive,
      b.blossomEmissive,
    );

    const environmentIntensity = mix(
      a.environmentIntensity,
      b.environmentIntensity,
    );
    reflectiveMaterials.forEach((material) => {
      material.envMapIntensity =
        environmentIntensity *
        (material === materials.iron ? 1.0 : 1.15);
    });

    const newName =
      phase < 0.5 ? 'day' : phase < 1.5 ? 'dusk' : 'night';
    if (newName !== lastEmittedName) {
      lastEmittedName = newName;
      state.currentTimeOfDay = newName;
    }
    const shadowNow = performance.now();
    if (forceShadow || shadowNow - lastShadowUpdate > 160) {
      renderer.shadowMap.needsUpdate = true;
      lastShadowUpdate = shadowNow;
    }
  };

  apply(0, true);

  const setTime = (name) => {
    const targetIndex = PRESETS.findIndex((preset) => preset.name === name);
    if (targetIndex === -1) return;
    setUIActive(name);
    uiName = name;
    const duration = 2100 + Math.abs(targetIndex - phase) * 260;
    transition = {
      start: performance.now(),
      from: phase,
      to: targetIndex,
      duration,
    };
  };

  const update = (now) => {
    if (!transition) return;
    const progress = clamp(
      (now - transition.start) / transition.duration,
      0,
      1,
    );
    const eased = easeInOutCubic(progress);
    apply(lerp(transition.from, transition.to, eased));
    if (progress >= 1) {
      transition = null;
      renderer.shadowMap.needsUpdate = true;
    }
  };

  return {
    presets: PRESETS,
    hemi,
    key,
    fill,
    doorWarm,
    awningWarm,
    spill,
    windowSpillFront,
    windowSpillRight,
    setTime,
    update,
    state,
    get uiName() {
      return uiName;
    },
    get phase() {
      return phase;
    },
    get isTransitioning() {
      return Boolean(transition);
    },
  };
}
