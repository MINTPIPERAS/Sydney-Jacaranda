import * as THREE from 'three';
import {
  makeAsphaltTexture,
  makeCanvasTexture,
  makeEnvironmentTexture,
  makeMagazineTexture,
  makePaverTexture,
  makePosterTexture,
  makeContactShadowTexture,
  makeGlowTexture,
} from './utils.js';

function makeToonGradient() {
  const values = new Uint8Array([38, 88, 148, 207, 255]);
  const texture = new THREE.DataTexture(values, values.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function makeInteriorTexture(variant = 0) {
  return makeCanvasTexture(
    256,
    320,
    (ctx, w, h) => {
      const warm = ['#efbb77', '#d99d70', '#d8b284'][variant % 3];
      const deep = ['#51372f', '#3e3039', '#4a3a36'][variant % 3];
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, variant === 2 ? '#323443' : warm);
      bg.addColorStop(0.55, variant === 2 ? '#292b38' : '#bc805b');
      bg.addColorStop(1, deep);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(35, 27, 30, 0.45)';
      ctx.fillRect(0, h * 0.72, w, h * 0.28);

      const glow = ctx.createRadialGradient(w * 0.64, h * 0.46, 3, w * 0.64, h * 0.46, 78);
      glow.addColorStop(0, variant === 2 ? 'rgba(133,147,176,0.3)' : 'rgba(255,239,190,0.95)');
      glow.addColorStop(0.28, variant === 2 ? 'rgba(91,101,127,0.15)' : 'rgba(255,191,105,0.48)');
      glow.addColorStop(1, 'rgba(255,178,88,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = variant === 2 ? 'rgba(24,27,38,0.8)' : 'rgba(59,39,35,0.55)';
      ctx.fillRect(w * 0.59, h * 0.54, w * 0.13, h * 0.16);
      ctx.fillRect(w * 0.62, h * 0.44, 2, h * 0.12);
      ctx.beginPath();
      ctx.ellipse(w * 0.655, h * 0.42, 18, 24, 0, 0, Math.PI * 2);
      ctx.fillStyle = variant === 2 ? 'rgba(201,186,155,0.32)' : 'rgba(255,213,148,0.74)';
      ctx.fill();

      ctx.fillStyle = variant === 2 ? 'rgba(20,23,34,0.9)' : 'rgba(43,31,30,0.78)';
      ctx.fillRect(w * 0.08, h * 0.68, w * 0.36, h * 0.22);
      ctx.fillRect(w * 0.03, h * 0.62, w * 0.44, h * 0.08);

      const curtain = ctx.createLinearGradient(0, 0, w, 0);
      curtain.addColorStop(0, 'rgba(238,222,196,0.9)');
      curtain.addColorStop(0.16, 'rgba(238,222,196,0.18)');
      curtain.addColorStop(0.82, 'rgba(238,222,196,0.2)');
      curtain.addColorStop(1, 'rgba(238,222,196,0.78)');
      ctx.fillStyle = curtain;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(47,34,34,0.22)';
      for (let i = 0; i < 6; i += 1) {
        const x = 9 + i * 40;
        ctx.fillRect(x, 0, 1, h);
        ctx.fillRect(w - x, 0, 1, h);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(0, 0, w, 2);
    },
    { repeat: [1, 1] },
  );
}

export function createMaterials(renderer) {
  const gradientMap = makeToonGradient();
  const environment = makeEnvironmentTexture();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(environment).texture;
  environment.dispose();
  pmrem.dispose();

  const paverMap = makePaverTexture();
  const asphaltMap = makeAsphaltTexture();
  const shadowMap = makeContactShadowTexture();
  const glowMap = makeGlowTexture();
  const interiorMaps = [makeInteriorTexture(0), makeInteriorTexture(1), makeInteriorTexture(2)];

  const toon = (options) =>
    new THREE.MeshToonMaterial({
      gradientMap,
      ...options,
    });

  const materials = {
    gradientMap,
    envMap,
    paverMap,
    asphaltMap,
    shadowMap,
    glowMap,

    baseBody: toon({ color: '#4a3b34' }),
    wall: toon({ color: '#e9dbc3' }),
    wallUpper: toon({ color: '#eee0ca' }),
    wallShade: toon({ color: '#dfd2bc' }),
    trim: toon({ color: '#f7efdf' }),
    trimBright: toon({ color: '#fbf4e7' }),
    stone: toon({ color: '#cfbea8' }),
    stoneDark: toon({ color: '#ae9b86' }),
    plasterDark: toon({ color: '#d8c9b3' }),
    roof: toon({ color: '#a9a0a1' }),
    roofDeck: toon({ color: '#74777e' }),
    roofInset: toon({ color: '#8d8589' }),
    sidewalk: toon({ map: paverMap, color: '#f2ede4' }),
    sidewalkEdge: toon({ color: '#d2c8b9' }),
    asphalt: toon({ map: asphaltMap, color: '#c4c2be' }),
    curb: toon({ color: '#ddd2c1' }),
    garden: toon({ color: '#85866d' }),
    soil: toon({ color: '#514235' }),
    soilDark: toon({ color: '#3b312b' }),
    hedge: toon({ color: '#5b6d51' }),
    hedgeLight: toon({ color: '#788a6a' }),
    grass: toon({ color: '#80906c' }),
    roadPaint: new THREE.MeshBasicMaterial({
      color: '#eee7d8',
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
    crack: new THREE.LineBasicMaterial({
      color: '#49474a',
      transparent: true,
      opacity: 0.24,
    }),
    awning: new THREE.MeshStandardMaterial({
      color: '#676176',
      metalness: 0.2,
      roughness: 0.56,
      envMapIntensity: 0.6,
    }),
    awningUnder: toon({ color: '#e7dac6' }),
    awningEdge: toon({ color: '#f5ead8' }),
    iron: new THREE.MeshStandardMaterial({
      color: '#29272d',
      metalness: 0.74,
      roughness: 0.31,
      envMapIntensity: 0.9,
    }),
    ironSoft: new THREE.MeshStandardMaterial({
      color: '#3a3740',
      metalness: 0.55,
      roughness: 0.42,
      envMapIntensity: 0.7,
    }),
    silver: new THREE.MeshStandardMaterial({
      color: '#bdbbb2',
      metalness: 0.8,
      roughness: 0.26,
      envMapIntensity: 1.1,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: '#b9955c',
      metalness: 0.7,
      roughness: 0.32,
      envMapIntensity: 1,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#b5ced8',
      metalness: 0.24,
      roughness: 0.055,
      transparent: true,
      opacity: 0.58,
      envMapIntensity: 1.7,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    }),
    doorDark: toon({ color: '#3f3539' }),
    doorGlass: new THREE.MeshPhysicalMaterial({
      color: '#b6d0d7',
      metalness: 0.14,
      roughness: 0.06,
      transparent: true,
      opacity: 0.5,
      envMapIntensity: 1.55,
      clearcoat: 0.8,
      depthWrite: false,
    }),
    windowInteriors: interiorMaps.map(
      (map) =>
        new THREE.MeshBasicMaterial({
          map,
          color: '#2b2931',
          toneMapped: true,
          fog: true,
        }),
    ),
    posterFrames: toon({ color: '#3e383a' }),
    posterPapers: [
      new THREE.MeshBasicMaterial({ map: makePosterTexture(0), toneMapped: true }),
      new THREE.MeshBasicMaterial({ map: makePosterTexture(1), toneMapped: true }),
    ],
    magazineCovers: [
      new THREE.MeshBasicMaterial({ map: makeMagazineTexture(0), toneMapped: true }),
      new THREE.MeshBasicMaterial({ map: makeMagazineTexture(1), toneMapped: true }),
      new THREE.MeshBasicMaterial({ map: makeMagazineTexture(2), toneMapped: true }),
    ],
    benchWood: toon({ color: '#866b9a' }),
    benchWoodLight: toon({ color: '#9c82ad' }),
    bikeFrame: new THREE.MeshStandardMaterial({
      color: '#55767a',
      metalness: 0.62,
      roughness: 0.36,
      envMapIntensity: 0.85,
    }),
    tire: new THREE.MeshStandardMaterial({
      color: '#2e2e31',
      metalness: 0.05,
      roughness: 0.82,
    }),
    leather: new THREE.MeshStandardMaterial({
      color: '#5c4640',
      metalness: 0.03,
      roughness: 0.76,
    }),
    deckWood: toon({ color: '#9b7652' }),
    deckWoodDark: toon({ color: '#6c503a' }),
    roofPot: toon({ color: '#b2765b' }),
    roofLeaf: toon({ color: '#5d7354' }),
    roofLeafLight: toon({ color: '#7d9067' }),
    roofBloom: toon({ color: '#8668ad' }),
    pot: toon({ color: '#a48d76' }),
    potLight: toon({ color: '#c2a88b' }),
    potDark: toon({ color: '#766153' }),
    ceramicCream: toon({ color: '#ded1ba' }),
    leafGreen: toon({ color: '#5d7357' }),
    leafLight: toon({ color: '#7f936d' }),
    fern: toon({ color: '#587455', side: THREE.DoubleSide }),
    metalGrate: new THREE.MeshStandardMaterial({
      color: '#3f3a36',
      metalness: 0.55,
      roughness: 0.56,
    }),
    manhole: new THREE.MeshStandardMaterial({
      color: '#6e655c',
      metalness: 0.45,
      roughness: 0.66,
    }),
    drainDark: new THREE.MeshBasicMaterial({ color: '#25252a' }),
    treeBark: toon({ vertexColors: true, color: '#ffffff' }),
    blossom: toon({
      vertexColors: true,
      color: '#ffffff',
      side: THREE.DoubleSide,
      emissive: '#201224',
      emissiveIntensity: 0.03,
    }),
    buds: toon({ color: '#62477e', side: THREE.DoubleSide }),
    treeLeaf: toon({
      color: '#5f775f',
      side: THREE.DoubleSide,
    }),
    petal: toon({
      color: '#ffffff',
      side: THREE.DoubleSide,
      emissive: '#26132e',
      emissiveIntensity: 0.02,
    }),
    canopyProxy: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    }),
    contactShadow: new THREE.MeshBasicMaterial({
      map: shadowMap,
      color: '#231f27',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      toneMapped: false,
    }),
    glow: new THREE.SpriteMaterial({
      map: glowMap,
      color: '#ffdda2',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
    lampGlass: new THREE.MeshBasicMaterial({
      color: '#ffdba2',
      toneMapped: true,
    }),
    bulb: new THREE.MeshBasicMaterial({
      color: '#ffe5b6',
      toneMapped: true,
    }),
  };

  materials.lampGlow = materials.glow.clone();
  materials.bulbGlow = materials.glow.clone();
  materials.awningGlow = materials.glow.clone();

  return materials;
}
