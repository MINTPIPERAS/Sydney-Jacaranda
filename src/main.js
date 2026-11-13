import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials } from './materials.js';
import { buildGround } from './ground.js';
import { buildBuilding } from './building.js';
import { buildJacarandas } from './trees.js';
import { buildProps, buildContactShadows } from './props.js';
import { buildPetalSystem, addBaseShadow } from './fx.js';
import { createAtmosphere } from './atmosphere.js';
import { HOME_VIEW, TREE_CONFIGS } from './worldConfig.js';
import { clamp, easeInOutCubic } from './utils.js';

const canvas = document.querySelector('#scene');
const stage = document.querySelector('.stage');
const timeButtons = [...document.querySelectorAll('[data-time-choice]')];
const resetButton = document.querySelector('.reset-button');
const toast = document.querySelector('.toast');

const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;
const isMobile =
  isCoarsePointer || window.matchMedia('(max-width: 720px)').matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.6));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 120);
camera.position.set(16, 12, 21);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.8;
controls.minDistance = 10;
controls.maxDistance = 62;
controls.minPolarAngle = 0.46;
controls.maxPolarAngle = 1.47;
controls.target.set(...HOME_VIEW.target);

const materials = createMaterials(renderer);
const building = buildBuilding(materials);
const treeSystem = buildJacarandas(materials);
const props = buildProps(materials);
const ground = buildGround(materials);

scene.add(ground);
scene.add(building);
scene.add(treeSystem.group);
scene.add(props.group);

const shadowSpots = [
  ...props.shadowSpots,
  ...TREE_CONFIGS.map((tree) => ({
    x: tree.x,
    z: tree.z,
    width: tree.pit * 1.65,
    depth: tree.pit * 1.65,
    y: tree.groundY,
    opacity: 0.72,
  })),
];
scene.add(buildContactShadows(materials, shadowSpots));
addBaseShadow(scene, materials);

const petals = buildPetalSystem(scene, materials, {
  fallingCount: isMobile ? 95 : 175,
});

const atmosphere = createAtmosphere({
  scene,
  renderer,
  materials,
  lamps: props.lamps,
  building,
  isMobile,
});

// ---------------------------------------------------------------------------
// Camera home / responsive framing
// ---------------------------------------------------------------------------

const homeDirection = new THREE.Vector3(...HOME_VIEW.direction).normalize();
const homeTarget = new THREE.Vector3(...HOME_VIEW.target);

function getHomeView() {
  const aspect =
    stage.clientHeight > 0 ? stage.clientWidth / stage.clientHeight : 16 / 9;
  let fov = 27;
  let distance = 45;
  if (stage.clientHeight < 480 && aspect > 1.6) {
    // Short landscape windows get a closer, more legible composition.
    fov = 33;
    distance = 25;
  } else if (aspect < 0.72) {
    fov = 44;
    distance = 41;
  } else if (aspect < 1.02) {
    fov = 40;
    distance = 35;
  } else if (aspect < 1.3) {
    // A taller tablet window needs a little more room to keep the complete
    // square base, still without crushing the building.
    distance = Math.min(58, 45 * (1.3 / aspect));
  }
  return {
    fov,
    target: homeTarget.clone(),
    position: homeTarget.clone().addScaledVector(homeDirection, distance),
  };
}

let previousAspect = 0;
let cameraTween = null;
let hasCameraMoved = false;

function resize() {
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  const aspect = width / height;
  const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.6);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = aspect;
  const home = getHomeView();
  camera.fov = home.fov;
  camera.updateProjectionMatrix();
  if (!hasCameraMoved && Math.abs(aspect - previousAspect) > 0.001) {
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    controls.update();
  }
  previousAspect = aspect;
}

const initialHome = getHomeView();
camera.fov = initialHome.fov;
camera.position.copy(initialHome.position);
controls.target.copy(initialHome.target);
camera.updateProjectionMatrix();
controls.update();
resize();

// ---------------------------------------------------------------------------
// Camera reset tween
// ---------------------------------------------------------------------------

function cancelCameraTween() {
  cameraTween = null;
}

controls.addEventListener('start', () => {
  hasCameraMoved = true;
  cancelCameraTween();
});

function resetCamera() {
  const home = getHomeView();
  cameraTween = {
    start: performance.now(),
    fromPosition: camera.position.clone(),
    toPosition: home.position,
    fromTarget: controls.target.clone(),
    toTarget: home.target,
    duration: 1050,
  };
  hasCameraMoved = false;
  resetButton.blur();
}

resetButton.addEventListener('click', resetCamera);

function updateCameraTween(now) {
  if (!cameraTween) return;
  const progress = clamp(
    (now - cameraTween.start) / cameraTween.duration,
    0,
    1,
  );
  const t = easeInOutCubic(progress);
  camera.position.lerpVectors(
    cameraTween.fromPosition,
    cameraTween.toPosition,
    t,
  );
  controls.target.lerpVectors(
    cameraTween.fromTarget,
    cameraTween.toTarget,
    t,
  );
  if (progress >= 1) cameraTween = null;
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

timeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    atmosphere.setTime(button.dataset.timeChoice);
    button.blur();
  });
});

document.body.dataset.time = 'day';

// ---------------------------------------------------------------------------
// Canopy interaction
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const canopyMeshes = treeSystem.trees.map((tree) => tree.proxy);
let pointerDown = null;
let toastTimer = 0;
let lastHoverCheck = 0;

function setRayFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
}

function canopyHit(event) {
  setRayFromEvent(event);
  const hits = raycaster.intersectObjects(canopyMeshes, false);
  return hits.find((hit) => hit.object.userData.isCanopy) ?? null;
}

function showToast() {
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 1800);
}

canvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button > 0) return;
  pointerDown = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
  };
});

canvas.addEventListener('pointerup', (event) => {
  if (!pointerDown || event.pointerId !== pointerDown.id) return;
  const moved = Math.hypot(
    event.clientX - pointerDown.x,
    event.clientY - pointerDown.y,
  );
  const held = performance.now() - pointerDown.time;
  pointerDown = null;
  if (moved > 7 || held > 520) return;
  const hit = canopyHit(event);
  if (!hit) return;
  const treeIndex = hit.object.userData.treeIndex;
  const tree = treeSystem.trees[treeIndex];
  petals.triggerBurst(hit.point, 2.15, isMobile ? 50 : 78);
  tree.group.userData.burstImpulse = 1;
  showToast();
});

canvas.addEventListener('pointercancel', () => {
  pointerDown = null;
});

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || pointerDown) return;
  const now = performance.now();
  if (now - lastHoverCheck < 70) return;
  lastHoverCheck = now;
  canvas.classList.toggle('is-pointing', Boolean(canopyHit(event)));
});

canvas.addEventListener('pointerleave', () => {
  canvas.classList.remove('is-pointing');
});

// ---------------------------------------------------------------------------
// Scene lifecycle
// ---------------------------------------------------------------------------

const ro = new ResizeObserver(() => resize());
ro.observe(stage);
window.addEventListener('resize', resize);

let elapsed = 0;
let previousFrameTime = performance.now();
let firstFrame = true;
const windScale = prefersReducedMotion ? 0.18 : 1;

function animate() {
  requestAnimationFrame(animate);
  const frameNow = performance.now();
  const delta = Math.min((frameNow - previousFrameTime) / 1000, 0.06);
  previousFrameTime = frameNow;
  elapsed += delta;
  const now = performance.now();

  atmosphere.update(now);
  updateCameraTween(now);

  treeSystem.trees.forEach((tree, index) => {
    const userData = tree.group.userData;
    const impulse = userData.burstImpulse ?? 0;
    const phase = userData.swayPhase ?? index;
    const amp =
      userData.swayAmount *
      windScale *
      (0.72 + Math.sin(elapsed * 0.21 + phase) * 0.18 + impulse * 1.9);
    tree.group.rotation.z =
      (Math.sin(elapsed * (0.47 + index * 0.006) + phase) * 0.72 +
        Math.sin(elapsed * 1.21 + phase * 1.7) * 0.14) *
      amp;
    tree.group.rotation.x =
      (Math.cos(elapsed * 0.39 + phase * 0.8) * 0.42 +
        Math.sin(elapsed * 0.92 + phase) * 0.1) *
      amp;
    if (impulse > 0) {
      userData.burstImpulse = Math.max(0, impulse - delta * 1.7);
    }
  });

  petals.update(delta, elapsed);
  controls.update();
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    renderer.shadowMap.needsUpdate = true;
    requestAnimationFrame(() => {
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
      window.__SCENE_READY__ = true;
    });
  }
}

renderer.shadowMap.needsUpdate = true;
animate();

window.addEventListener('beforeunload', () => {
  ro.disconnect();
  renderer.dispose();
});

// A small read-only surface for verification and easy authoring in the browser.
window.__JACARANDA__ = Object.freeze({
  scene,
  camera,
  renderer,
  controls,
  atmosphere,
  trees: treeSystem.trees,
  petals,
  stats: {
    flowers: treeSystem.totals.flowers,
    branches: treeSystem.totals.branches,
    fallenPetals: petals.staticCount,
    fallenFlowers: petals.fallenFlowerCount,
  },
  setTime: (name) => atmosphere.setTime(name),
  resetCamera,
  setCamera: (position, target = HOME_VIEW.target) => {
    hasCameraMoved = true;
    cameraTween = null;
    camera.position.set(...position);
    controls.target.set(...target);
    camera.updateProjectionMatrix();
    controls.update();
  },
  triggerBurst: (treeIndex = 0) => {
    const tree = treeSystem.trees[treeIndex];
    const center = tree.group.localToWorld(tree.canopyCenter.clone());
    petals.triggerBurst(center, 2.2, 60);
    tree.group.userData.burstImpulse = 1;
  },
});
