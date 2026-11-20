import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { audio } from './audio.js';

// ---------------------------------------------------------------------------
// Asset map — every file the experience uses, grouped by scene.
// Replace a file in /public with the same name to update it.
// ---------------------------------------------------------------------------
export const ASSETS = {
  models: {
    box: '/models/the-box.glb', // 03/04 invitation box (exported from assets/modelo-3d/the-box.blend)
    bodyMale: '/models/body-male.glb', // 07 people + Keeper (Downloads/male/Lowpoly-Base.fbx, rigged)
    bodyFemale: '/models/body-female.glb', // 07 people (Downloads/female/FEMALE.fbx, rigged)
  },
  textures: {
    letter: '/images/letter-base.jpg', // 04 letter (visible ink)
    letterUV: '/images/letter-uv.png', // 04 letter (UV-only ink: password + address)
    letterCover: '/images/letter-cover.jpg', // 04 closed letter (artboard 1)
    pin: '/images/pin-badge.png', // fallback pin face (artboard 3)
    pinFace: '/images/pin-face.png', // 04 pin face (assets/modelo-3d/pin-16.png)
    symbol: '/images/logo-symbol.png', // logo symbol (box lid, keeper head)
    keeperHead: '/images/keeper-head.png', // 07 keeper head
    lockup: '/images/logo-lockup.png',
  },
  images: [
    '/images/logo-lockup.png',
    '/images/fainted-body.png', // rejection character
    '/images/fainted-head.png',
  ],
};

export const cache = { textures: {}, models: {}, images: {} };

export async function preloadAll(onProgress) {
  const texLoader = new THREE.TextureLoader();
  const gltf = new GLTFLoader();
  let done = 0;
  const jobs = [];
  const total = Object.keys(ASSETS.textures).length + Object.keys(ASSETS.models).length + ASSETS.images.length + 3 /* sfx */ + 1 /* fonts */;
  const tick = () => { done++; onProgress?.(done / total); };

  for (const [key, url] of Object.entries(ASSETS.textures)) {
    jobs.push(
      texLoader.loadAsync(url).then((t) => {
        t.colorSpace = key === 'letterUV' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        t.anisotropy = 8;
        cache.textures[key] = t;
      }).catch((e) => console.warn('[assets] texture missing', url, e)).finally(tick),
    );
  }
  for (const [key, url] of Object.entries(ASSETS.models)) {
    jobs.push(
      gltf.loadAsync(url).then((g) => { cache.models[key] = g; })
        .catch((e) => console.warn('[assets] model missing — a placeholder will be used', url, e)).finally(tick),
    );
  }
  for (const url of ASSETS.images) {
    jobs.push(new Promise((res) => {
      const img = new Image();
      img.onload = img.onerror = () => { cache.images[url] = img; tick(); res(); };
      img.src = url;
    }));
  }
  jobs.push(audio.preload(tick));
  jobs.push((document.fonts?.ready ?? Promise.resolve()).then(() =>
    Promise.all(['900 20px Satoshi', '500 20px Satoshi', '700 20px Satoshi', '20px Grace'].map((f) => document.fonts.load(f).catch(() => {}))),
  ).finally(tick));

  await Promise.all(jobs);
}
