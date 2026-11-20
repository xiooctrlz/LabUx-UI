import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createHuman, POSES, casualColors } from './humans.js';

// ---------------------------------------------------------------------------
// THE CIRCLE — the hidden garden (São Paulo, 2050). Fully procedural, stylised.
// Everything that sways shares `wind.uTime`.
// ---------------------------------------------------------------------------

// deterministic random so the garden is identical on every visit
let seed = 20500;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const range = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// small 3D value noise
function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.1;

export const wind = { uTime: { value: 0 } };

/** Adds wind sway to a standard material. mode: 'height' (merged meshes) or 'instance' */
function addWind(material, { amp = 0.1, mode = 'height', base = 0, span = 1, freq = 1 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', mode === 'instance'
        ? `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 ip = instanceMatrix[3].xyz;
            float hh = clamp(position.y * ${(1 / span).toFixed(4)}, 0.0, 1.0);
            hh *= hh;
            vec3 ww = vec3(sin(uTime * ${(1.3 * freq).toFixed(3)} + ip.x * 0.35 + ip.z * 0.21) + 0.6, 0.0, cos(uTime * ${(1.05 * freq).toFixed(3)} + ip.z * 0.3) * 0.6) * ${amp.toFixed(4)} * hh;
            transformed += inverse(mat3(instanceMatrix)) * ww;
          #endif`
        : `#include <begin_vertex>
          float hh = clamp((position.y - ${base.toFixed(3)}) / ${span.toFixed(3)}, 0.0, 1.0);
          transformed.x += sin(uTime * ${(0.9 * freq).toFixed(3)} + position.y * 0.35 + position.z * 0.2) * ${amp.toFixed(4)} * hh;
          transformed.z += cos(uTime * ${(0.7 * freq).toFixed(3)} + position.x * 0.3) * ${(amp * 0.6).toFixed(4)} * hh;`);
  };
  material.customProgramCacheKey = () => `wind-${mode}-${amp}-${base}-${span}-${freq}`;
  return material;
}

// ---------------------------------------------------------------------------
// textures
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function leafTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(64, 6);
    g.bezierCurveTo(112, 40, 104, 96, 64, 122);
    g.bezierCurveTo(24, 96, 16, 40, 64, 6);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(64, 14); g.lineTo(64, 118); g.stroke();
  });
}

function groundTexture() {
  const t = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#2b3a1f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) {
      const x = rnd() * w, y = rnd() * h;
      const c = pick(['#33461f', '#24331a', '#3d4f22', '#1f2b16', '#4a5a2a', '#2f3d1c']);
      g.fillStyle = c;
      g.globalAlpha = 0.5;
      g.fillRect(x, y, 2 + rnd() * 5, 2 + rnd() * 5);
    }
    g.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18, 18);
  return t;
}

function glowSprite(color = '255,200,140') {
  return canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, `rgba(${color},1)`);
    r.addColorStop(0.2, `rgba(${color},0.55)`);
    r.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  });
}

function windowsTexture() {
  const t = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 18) {
      for (let x = 8; x < w; x += 16) {
        if (rnd() < 0.16) {
          g.fillStyle = pick(['#ffcf8a', '#ffb36b', '#ffe2b0', '#9fc3ff']);
          g.globalAlpha = 0.5 + rnd() * 0.5;
          g.fillRect(x, y, 8, 10);
        }
      }
    }
    g.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// sky, ground, city
// ---------------------------------------------------------------------------
function buildSky() {
  const geo = new THREE.SphereGeometry(220, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: wind.uTime },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform float uTime;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){
        float y = vP.y;
        vec3 top = vec3(0.025, 0.03, 0.09);
        vec3 mid = vec3(0.10, 0.07, 0.20);
        vec3 hor = vec3(0.42, 0.18, 0.20);
        vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, y));
        c = mix(c, top, smoothstep(0.15, 0.7, y));
        // stars
        vec3 q = floor(vP * 380.0);
        float s = step(0.9975, h(q)) * smoothstep(0.12, 0.5, y);
        s *= 0.6 + 0.4 * sin(uTime * 2.0 + h(q + 1.0) * 30.0);
        c += vec3(s) * 0.9;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

function buildGround() {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(80, 96),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1, color: 0xa8b090 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // the circle: a ring of stone paving around the tree + an earth disc under it
  const earth = new THREE.Mesh(new THREE.CircleGeometry(3.7, 64), new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 1 }));
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = 0.01;
  earth.receiveShadow = true;
  group.add(earth);

  const stoneGeo = new RoundedBoxGeometry(1, 0.12, 1, 2, 0.04);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb9ad9a, roughness: 0.92 });
  const stones = [];
  // rings
  for (const [r, n, s] of [[2.5, 26, 0.55], [3.15, 32, 0.55], [7.6, 70, 0.6]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + range(-0.02, 0.02);
      stones.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: -a, sx: s * range(0.85, 1.05), sz: s * range(0.6, 0.8) });
    }
  }
  // stepping-stone path from the entrance to the circle
  for (let z = 4.2; z < 19; z += range(0.75, 0.95)) {
    stones.push({ x: range(-0.22, 0.22), z, rot: range(-0.3, 0.3), sx: range(0.7, 0.9), sz: range(0.5, 0.62) });
  }
  const inst = new THREE.InstancedMesh(stoneGeo, stoneMat, stones.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  stones.forEach((s, i) => {
    q.setFromEuler(new THREE.Euler(range(-0.03, 0.03), s.rot, range(-0.03, 0.03)));
    m.compose(new THREE.Vector3(s.x, 0.03, s.z), q, new THREE.Vector3(s.sx, range(0.7, 1), s.sz));
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, col.setHSL(0.08, range(0.08, 0.16), range(0.52, 0.66)));
  });
  inst.receiveShadow = true;
  inst.castShadow = true;
  group.add(inst);
  return group;
}

function buildCity() {
  const n = 60;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const winTex = windowsTexture();
  const mat = new THREE.MeshStandardMaterial({ color: 0x0e0c14, roughness: 0.9, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.4 });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + range(-0.04, 0.04);
    const r = range(58, 95);
    const h = range(20, 75);
    const w = range(7, 16);
    m.compose(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + range(-0.3, 0.3), 0)),
      new THREE.Vector3(w, h, range(7, 14)));
    inst.setMatrixAt(i, m);
  }
  // red aviation lights on the tallest roofs
  const g = new THREE.Group();
  g.add(inst);
  const beaconMat = new THREE.SpriteMaterial({ map: glowSprite('255,60,60'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 6; i++) {
    const a = range(0, Math.PI * 2);
    const r = range(62, 90);
    const s = new THREE.Sprite(beaconMat);
    s.position.set(Math.cos(a) * r, range(42, 76), Math.sin(a) * r);
    s.scale.setScalar(2.2);
    s.userData.phase = rnd() * 6;
    g.add(s);
  }
  g.userData.beacons = g.children.filter((c) => c.isSprite);
  return g;
}

// ---------------------------------------------------------------------------
// vegetation
// ---------------------------------------------------------------------------
function blobGeometry(radius, detail, { squash = 0.85, rough = 0.32, colA, colB, colC, seedOff = 0 }) {
  // weld the icosphere so normals are smooth (not faceted) after displacement
  let geo = new THREE.IcosahedronGeometry(radius, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const a = new THREE.Color(colA), b = new THREE.Color(colB), c = new THREE.Color(colC);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const d = fbm(n.x * 1.6 + seedOff, n.y * 1.6, n.z * 1.6 - seedOff);
    v.multiplyScalar(1 + (d - 0.5) * rough * 2);
    v.y *= squash;
    pos.setXYZ(i, v.x, v.y, v.z);
    const k = THREE.MathUtils.clamp(n.y * 0.5 + 0.5, 0, 1);
    tmp.copy(b).lerp(a, k * k).lerp(c, Math.max(0, d - 0.55) * 1.6);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function branchTubes(out, tips, start, dir, len, radius, depth, maxDepth) {
  const pts = [start.clone()];
  const segs = 4;
  const d = dir.clone();
  const p = start.clone();
  for (let i = 1; i <= segs; i++) {
    d.add(new THREE.Vector3(range(-0.18, 0.18), range(-0.05, 0.08), range(-0.18, 0.18))).normalize();
    p.addScaledVector(d, len / segs);
    pts.push(p.clone());
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 10, radius, 10, false);
  // taper the tube along its length
  const pos = tube.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / 11);
    const t = ring / 10;
    const c = curve.getPointAt(Math.min(1, t));
    v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(1 - t * 0.38).add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  tube.computeVertexNormals();
  out.push(tube);
  const end = pts[pts.length - 1];
  if (depth >= maxDepth) { tips.push({ p: end, r: radius }); return; }
  const kids = depth === 0 ? 4 : pick([2, 3, 3]);
  for (let k = 0; k < kids; k++) {
    const yaw = (k / kids) * Math.PI * 2 + range(-0.4, 0.4);
    const tilt = depth === 0 ? range(0.55, 0.85) : range(0.35, 0.75);
    const nd = new THREE.Vector3(Math.cos(yaw) * Math.sin(tilt), Math.cos(tilt), Math.sin(yaw) * Math.sin(tilt));
    nd.lerp(d, 0.25).normalize();
    branchTubes(out, tips, end.clone().addScaledVector(d, -0.05), nd, len * range(0.62, 0.78), radius * 0.62, depth + 1, maxDepth);
  }
}

export function buildTree({ scale = 1, maxDepth = 3, trunkLen = 3.0, trunkR = 0.42, clumpR = [1.3, 2.0], leafCount = 5200, leafSize = 0.3, palette } = {}) {
  const group = new THREE.Group();
  const geos = [];
  const tips = [];
  branchTubes(geos, tips, new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 1, 0), trunkLen, trunkR, 0, maxDepth);
  // root flare
  const flare = new THREE.CylinderGeometry(trunkR * 0.95, trunkR * 1.9, 0.7, 12, 3);
  flare.translate(0, 0.2, 0);
  const fp = flare.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i), y = fp.getY(i);
    const a = Math.atan2(z, x);
    const k = 1 + Math.sin(a * 5) * 0.18 * (1 - (y + 0.15) / 0.7);
    fp.setXYZ(i, x * k, y, z * k);
  }
  flare.computeVertexNormals();
  geos.push(flare);
  const merged = mergeGeometries(geos, false);
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.95 });
  const trunk = new THREE.Mesh(merged, barkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // canopy clumps on the branch tips
  const pal = palette || { a: 0x6f8a3c, b: 0x1f3418, c: 0x9aa64a };
  const clumpGeos = [];
  const clumps = [];
  tips.forEach((t, i) => {
    const r = range(clumpR[0], clumpR[1]);
    const g = blobGeometry(r, 3, { colA: pal.a, colB: pal.b, colC: pal.c, seedOff: i * 3.1 });
    const c = t.p.clone().add(new THREE.Vector3(0, r * 0.35, 0));
    g.translate(c.x, c.y, c.z);
    clumpGeos.push(g);
    clumps.push({ c, r });
  });
  const canopyGeo = mergeGeometries(clumpGeos, false);
  let minY = Infinity, maxY = -Infinity;
  clumps.forEach((c) => { minY = Math.min(minY, c.c.y - c.r); maxY = Math.max(maxY, c.c.y + c.r); });
  const canopyMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { amp: 0.08, base: minY, span: maxY - minY, freq: 0.8 });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  group.add(canopy);

  // leaf cards around the clumps to break the silhouette
  const leafGeo = new THREE.PlaneGeometry(leafSize, leafSize);
  const leafMat = addWind(new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }), { amp: 0.06, mode: 'instance', span: leafSize, freq: 1.4 });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const cA = new THREE.Color(pal.a), cB = new THREE.Color(pal.b), cC = new THREE.Color(pal.c);
  for (let i = 0; i < leafCount; i++) {
    const cl = clumps[i % clumps.length];
    const dir = new THREE.Vector3(range(-1, 1), range(-0.6, 1), range(-1, 1)).normalize();
    const p = cl.c.clone().addScaledVector(dir, cl.r * range(0.82, 1.08));
    p.y = cl.c.y + (p.y - cl.c.y) * 0.85;
    q.setFromEuler(new THREE.Euler(range(0, Math.PI), range(0, Math.PI * 2), range(0, Math.PI)));
    const s = range(0.7, 1.3);
    m.compose(p, q, new THREE.Vector3(s, s, s));
    leaves.setMatrixAt(i, m);
    const k = THREE.MathUtils.clamp(dir.y * 0.5 + 0.5, 0, 1);
    col.copy(cB).lerp(cA, k).lerp(cC, rnd() * 0.35);
    leaves.setColorAt(i, col);
  }
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(leaves);
  group.scale.setScalar(scale);
  group.userData.canopyCenter = new THREE.Vector3(0, (minY + maxY) / 2, 0);
  group.userData.canopyTop = maxY;
  return group;
}

function buildBushes() {
  const group = new THREE.Group();
  const geos = [];
  const spots = [];
  // perimeter hedge ring
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.12) continue; // the entrance gap
    spots.push({ x: Math.cos(a) * range(16.5, 18), z: Math.sin(a) * range(16.5, 18), r: range(1.5, 2.3) });
  }
  // clusters inside the garden
  for (let i = 0; i < 26; i++) {
    const a = range(0, Math.PI * 2);
    const r = range(9.5, 14.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 2.2 && z > 0) continue;
    spots.push({ x, z, r: range(0.6, 1.2) });
  }
  // around the plaza
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    if (Math.abs(a - Math.PI / 2) < 0.4) continue;
    spots.push({ x: Math.cos(a) * 4.4, z: Math.sin(a) * 4.4, r: range(0.45, 0.7) });
  }
  spots.forEach((s, i) => {
    const g = blobGeometry(s.r, 2, { colA: 0x5d7a35, colB: 0x18291a, colC: 0x86973f, squash: 0.75, seedOff: i * 1.7 });
    g.translate(s.x, s.r * 0.55, s.z);
    geos.push(g);
  });
  const mat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { amp: 0.04, base: 0, span: 3, freq: 1 });
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.userData.spots = spots;
  return group;
}

function buildGrass(count = 26000) {
  const geo = new THREE.BufferGeometry();
  // tapered blade, 4 segments, bent
  const segs = 4;
  const verts = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.045 * (1 - t * 0.92);
    const bend = t * t * 0.12;
    verts.push(-w, t, bend, w, t, bend);
    uvs.push(0, t, 1, t);
    if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = addWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9, color: 0xffffff }), { amp: 0.16, mode: 'instance', span: 1, freq: 1.1 });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const base = [new THREE.Color(0x4f6e2c), new THREE.Color(0x6b8538), new THREE.Color(0x3c5522), new THREE.Color(0x87944a)];
  let n = 0;
  while (n < count) {
    const r = Math.sqrt(rnd()) * 17;
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < 3.75) continue; // earth under the tree
    if (Math.abs(x) < 0.75 && z > 3.6) continue; // path
    // shorter near the entrance path so the foreground stays readable
    const near = THREE.MathUtils.clamp((z - 6) / 8, 0, 1) * THREE.MathUtils.clamp(1 - Math.abs(x) / 6, 0, 1);
    const h = range(0.14, 0.36) * (0.8 + fbm(x * 0.2, 0, z * 0.2) * 0.6) * (1 - near * 0.55);
    q.setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, 0));
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, h, 1));
    inst.setMatrixAt(n, m);
    col.copy(pick(base)).multiplyScalar(range(0.75, 1.15));
    inst.setColorAt(n, col);
    n++;
  }
  inst.receiveShadow = true;
  return inst;
}

function buildFlowers(bushSpots) {
  const geo = new THREE.IcosahedronGeometry(0.06, 0);
  const mat = addWind(new THREE.MeshStandardMaterial({ roughness: 0.6 }), { amp: 0.05, mode: 'instance', span: 0.1 });
  const count = 900;
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const cols = [0xc1202b, 0xc1202b, 0xf3eee2, 0xf2c14e, 0xb06ad9, 0xe86a7a];
  for (let i = 0; i < count; i++) {
    let x, z;
    if (i < 520) {
      const s = pick(bushSpots);
      const a = range(0, Math.PI * 2);
      const r = s.r + range(0.1, 1.1);
      x = s.x + Math.cos(a) * r; z = s.z + Math.sin(a) * r;
    } else {
      // a ring of flowers framing the circle
      const a = range(0, Math.PI * 2);
      const r = range(3.45, 3.75);
      x = Math.cos(a) * r; z = Math.sin(a) * r;
    }
    const s = range(0.6, 1.3);
    m.compose(new THREE.Vector3(x, range(0.18, 0.5), z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.7, s));
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, col.set(pick(cols)));
  }
  inst.castShadow = true;
  return inst;
}

// ---------------------------------------------------------------------------
// furniture + lights
// ---------------------------------------------------------------------------
// shared materials so all furniture can be merged into a handful of draw calls
const MATS = {};
const woodMat = () => (MATS.wood ||= new THREE.MeshStandardMaterial({ color: 0x7a4d2e, roughness: 0.75 }));
const stemMat = () => (MATS.stem ||= new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.6, metalness: 0.4 }));
const jarMat = () => (MATS.jar ||= new THREE.MeshStandardMaterial({ color: 0xffe3b8, emissive: 0xffa654, emissiveIntensity: 2.4, roughness: 0.3 }));

/** Bakes every mesh under `root` into one merged mesh per material; sprites are kept as they are. */
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  root.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!buckets.has(o.material)) buckets.set(o.material, []);
      buckets.get(o.material).push(g.index ? g : g);
    } else if (o.isSprite) keep.push(o);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of buckets) {
    const indexed = geos.map((g) => (g.index ? g : mergeVertices(g)));
    const m = new THREE.Mesh(mergeGeometries(indexed, false), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    out.add(m);
  }
  for (const s of keep) {
    const p = s.getWorldPosition(new THREE.Vector3());
    out.add(s);
    s.position.copy(p);
  }
  return out;
}

function buildTable(withCandle = true) {
  const g = new THREE.Group();
  const wm = woodMat();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 40), wm);
  top.position.y = 0.76;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.74, 12), stemMat());
  stem.position.y = 0.37;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.04, 24), stemMat());
  foot.position.y = 0.02;
  g.add(top, stem, foot);
  if (withCandle) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 16), jarMat());
    jar.position.y = 0.84;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xffb066, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
    glow.position.y = 0.88;
    glow.scale.setScalar(0.9);
    g.add(jar, glow);
    g.userData.glow = glow;
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildChair() {
  const g = new THREE.Group();
  const wm = woodMat();
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.05, 0.42, 2, 0.015), wm);
  seat.position.y = 0.45;
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.42, 0.04, 2, 0.015), wm);
  back.position.set(0, 0.68, -0.2);
  back.rotation.x = -0.1;
  g.add(seat, back);
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.45, 8), wm);
    leg.position.set(x, 0.225, z);
    g.add(leg);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function catenary(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

function buildStringLights(scene) {
  const group = new THREE.Group();
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x15100d, roughness: 0.8 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.8 });
  const wires = [];
  const bulbs = [];
  const strands = 10;
  const poles = [];
  // offset so no pole stands on the entrance axis (+Z), keeping the tree in view
  const A0 = Math.PI / 2 + Math.PI / strands;
  for (let i = 0; i < strands; i++) {
    const a = (i / strands) * Math.PI * 2 + A0;
    const r = 9.2;
    const top = new THREE.Vector3(Math.cos(a) * r, 3.9, Math.sin(a) * r);
    poles.push(top);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.95, 8), poleMat);
    pole.position.set(top.x, 1.97, top.z);
    pole.castShadow = true;
    group.add(pole);
    const anchor = new THREE.Vector3(Math.cos(a) * 1.6, 5.6, Math.sin(a) * 1.6);
    const c = catenary(anchor, top, 1.1);
    wires.push(new THREE.TubeGeometry(c, 40, 0.012, 4, false));
    for (let k = 1; k < 11; k++) bulbs.push(c.getPointAt(k / 11));
  }
  // garland between neighbouring poles
  for (let i = 0; i < strands; i++) {
    const a = poles[i], b = poles[(i + 1) % strands];
    const c = catenary(a, b, 0.8);
    wires.push(new THREE.TubeGeometry(c, 40, 0.012, 4, false));
    for (let k = 1; k < 7; k++) bulbs.push(c.getPointAt(k / 7));
  }
  group.add(new THREE.Mesh(mergeGeometries(wires, false), wireMat));

  const bulbGeo = new THREE.SphereGeometry(0.055, 10, 8);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb25e, emissiveIntensity: 2.6, roughness: 0.4 });
  const inst = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbs.length);
  const m = new THREE.Matrix4();
  bulbs.forEach((p, i) => { m.makeTranslation(p.x, p.y - 0.07, p.z); inst.setMatrixAt(i, m); });
  group.add(inst);
  // soft halos: one point cloud (a single draw call instead of one sprite per bulb)
  const haloPos = new Float32Array(bulbs.length * 3);
  bulbs.forEach((p, i) => haloPos.set([p.x, p.y - 0.07, p.z], i * 3));
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({
    map: glowSprite(), color: 0xffa860, size: 0.42, sizeAttenuation: true,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.32,
  }));
  group.add(halos);
  // three real lights for warm pools on the ground (no shadows → cheap)
  for (let k = 0; k < 3; k++) {
    const a = A0 + Math.PI / strands + (k / 3) * Math.PI * 2;
    const l = new THREE.PointLight(0xffa35c, 13, 16, 1.6);
    l.position.set(Math.cos(a) * 5.2, 3.6, Math.sin(a) * 5.2);
    group.add(l);
  }
  const center = new THREE.PointLight(0xffb070, 12, 12, 1.5);
  center.position.set(0, 2.6, 3.2);
  group.add(center);
  return group;
}

function buildFireflies(count = 160) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = range(2, 15);
    pos.set([Math.cos(a) * r, range(0.3, 3.2), Math.sin(a) * r], i * 3);
    ph[i] = rnd() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: wind.uTime, uPx: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: `attribute float aPhase; uniform float uTime; uniform float uPx; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.3 + aPhase) * 0.8;
        p.y += sin(uTime * 0.5 + aPhase * 1.3) * 0.35;
        p.z += cos(uTime * 0.25 + aPhase) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.7 + aPhase * 7.0), 3.0);
        gl_PointSize = 70.0 * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a * vA; gl_FragColor = vec4(vec3(1.0, 0.85, 0.45) * a, a); }`,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

// ---------------------------------------------------------------------------
// people: the provided FBX bodies, dressed per zone (see humans.js).
// Few of them, mostly the lighter male body.
// ---------------------------------------------------------------------------
const AX_X = new THREE.Vector3(1, 0, 0);
const AX_Y = new THREE.Vector3(0, 1, 0);

let LOW = false;
function buildHuman({ seated }) {
  // the female body is the heavier one: used for a few people, never on phones
  const kind = rnd() < 0.3 && !LOW ? 'female' : 'male';
  const height = kind === 'female' ? range(1.6, 1.72) : range(1.7, 1.86);
  const hairColor = pick([0x1a100b, 0x2a1a10, 0x4a2f1c, 0x111111, 0x6b4a2a, 0x8a8a86]);
  const h = createHuman(kind, { height, colors: casualColors(rnd), hairColor, longHair: kind === 'female' && rnd() < 0.8 });
  if (!h) return null;
  const base = h.makePose(seated ? POSES.sit : POSES.stand);
  h.applyPose(base);
  if (seated) h.settle('hips', 0.56);
  else h.settle('foot_L', 0.045 * height);
  h.group.userData = { h, base, phase: rnd() * 10, lookBias: 0 };
  return h.group;
}

export function animatePeople(people, t) {
  for (const p of people) {
    const { h, base, phase: ph, lookBias } = p.userData;
    h.applyPose(base);
    p.updateMatrixWorld(true);
    h.turn('chest', AX_X, Math.sin(t * 1.5 + ph) * 0.015);
    h.turn('head', AX_Y, Math.sin(t * 0.35 + ph) * 0.5 + lookBias);
    h.turn('head', AX_X, Math.sin(t * 0.8 + ph * 2) * 0.07);
    if (Math.sin(t * 0.25 + ph) > 0.2) {
      // talking: the right forearm rises and falls with the conversation
      h.turn('forearm_R', AX_X, -Math.max(0, Math.sin(t * 2.2 + ph)) * 0.45);
      h.turn('upperarm_R', AX_X, -Math.max(0, Math.sin(t * 2.2 + ph + 0.6)) * 0.12);
    }
  }
}
// ---------------------------------------------------------------------------
// assemble
// ---------------------------------------------------------------------------
/** low = phones / weak GPUs: fewer blades, leaves and bodies */
export function buildGarden(scene, { low = false } = {}) {
  seed = 20500;
  LOW = low;
  const world = new THREE.Group();
  scene.add(world);

  world.add(buildSky());
  world.add(buildGround());
  const city = buildCity();
  world.add(city);

  const tree = buildTree({ scale: 1.18, trunkLen: 3.1, trunkR: 0.46, clumpR: [1.4, 2.1], maxDepth: 3, leafCount: low ? 3200 : 5200, leafSize: low ? 0.4 : 0.34, palette: { a: 0x7d9a40, b: 0x1b3017, c: 0xb5a94b } });
  world.add(tree);

  // smaller trees at the edges for depth
  const edgeTrees = [];
  for (const [a, r, s] of [[0.5, 14, 0.55], [2.3, 15, 0.6], [3.6, 13.5, 0.5], [4.4, 15.5, 0.62], [5.4, 14, 0.5], [1.15, 15, 0.45], [2.05, 14.5, 0.5]]) {
    const t = buildTree({ scale: s, trunkLen: 2.6, trunkR: 0.35, clumpR: [1.2, 1.7], maxDepth: 2, leafCount: low ? 350 : 700, leafSize: 0.45, palette: { a: 0x5f7d36, b: 0x15261a, c: 0x8f9a45 } });
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    t.rotation.y = a;
    world.add(t);
    edgeTrees.push(t);
  }

  const bushes = buildBushes();
  world.add(bushes);
  world.add(buildGrass(low ? 6000 : 15000));
  world.add(buildFlowers(bushes.userData.spots));
  world.add(buildStringLights(scene));
  const fireflies = buildFireflies();
  world.add(fireflies);

  // tables, chairs and the people already gathered
  const people = [];
  const glows = [];
  const furniture = new THREE.Group();
  const tableSpots = [
    { a: 0.52, r: 6.1, n: 2 }, { a: 2.62, r: 6.1, n: 2 }, { a: 3.66, r: 6.0, n: 1 },
    { a: 4.71, r: 6.2, n: 1 }, { a: 5.76, r: 6.0, n: 0 }, { a: 1.13, r: 9.4, n: 1 }, { a: 2.01, r: 9.6, n: 0 },
  ];
  tableSpots.forEach((ts, ti) => {
    const tx = Math.cos(ts.a) * ts.r;
    const tz = Math.sin(ts.a) * ts.r;
    const table = buildTable();
    table.position.set(tx, 0, tz);
    furniture.add(table);
    if (table.userData.glow) glows.push(table.userData.glow);
    const seats = 3;
    for (let s = 0; s < seats; s++) {
      const ca = (s / seats) * Math.PI * 2 + ti;
      const cx = tx + Math.cos(ca) * 0.85;
      const cz = tz + Math.sin(ca) * 0.85;
      const chair = buildChair();
      chair.position.set(cx, 0, cz);
      chair.lookAt(tx, 0, tz);
      furniture.add(chair);
      if (s < ts.n) {
        const p = buildHuman({ seated: true });
        if (p) {
          p.position.set(cx, 0, cz).lerp(new THREE.Vector3(tx, 0, tz), 0.05);
          p.lookAt(tx, 0, tz);
          world.add(p);
          people.push(p);
        }
      }
    }
  });
  // 7 tables × (table + 3 chairs) collapse into 3 merged meshes
  world.add(mergeStatic(furniture));
  // standing groups
  for (const grp of [{ x: 4.6, z: -1.2, n: 2 }, { x: -1.6, z: -5.3, n: 2 }]) {
    for (let i = 0; i < grp.n; i++) {
      const a = (i / grp.n) * Math.PI * 2;
      const p = buildHuman({ seated: false });
      if (!p) continue;
      p.position.set(grp.x + Math.cos(a) * 0.6, 0, grp.z + Math.sin(a) * 0.6);
      p.lookAt(grp.x, 0, grp.z);
      world.add(p);
      people.push(p);
    }
  }

  return { world, tree, people, fireflies, city, glows, edgeTrees };
}
