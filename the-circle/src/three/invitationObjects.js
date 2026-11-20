import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cache } from '../core/assets.js';

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------
export function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4a2c1c';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * c.height;
    const amp = 2 + Math.random() * 10;
    const freq = 0.002 + Math.random() * 0.01;
    const ph = Math.random() * 10;
    g.beginPath();
    for (let x = 0; x <= c.width; x += 8) g.lineTo(x, y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1) * amp * 0.3);
    const light = Math.random() < 0.5;
    g.strokeStyle = light ? `rgba(150,96,60,${0.05 + Math.random() * 0.12})` : `rgba(25,12,6,${0.08 + Math.random() * 0.2})`;
    g.lineWidth = 0.6 + Math.random() * 2.6;
    g.stroke();
  }
  // knots
  for (let k = 0; k < 3; k++) {
    const x = Math.random() * c.width; const y = Math.random() * c.height;
    for (let r = 26; r > 2; r -= 3) {
      g.beginPath(); g.ellipse(x, y, r * 2.4, r * 0.7, 0, 0, Math.PI * 2);
      g.strokeStyle = `rgba(30,14,6,${0.1})`; g.lineWidth = 1.2; g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function radialTexture(inner = 'rgba(255,230,190,1)', outer = 'rgba(255,230,190,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.35)'));
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Lid artwork: black board with the red symbol + wordmark (replaces missing carta-15.jpg). */
export function lidTexture() {
  const c = document.createElement('canvas');
  c.width = 1160; c.height = 720;
  const g = c.getContext('2d');
  g.fillStyle = '#120607';
  g.fillRect(0, 0, c.width, c.height);
  const sym = cache.textures.symbol?.image;
  if (sym) {
    // tint the symbol red
    const s = document.createElement('canvas');
    s.width = sym.width; s.height = sym.height;
    const sg = s.getContext('2d');
    sg.drawImage(sym, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = '#c1202b';
    sg.fillRect(0, 0, s.width, s.height);
    const h = 300;
    const w = (h * sym.width) / sym.height;
    g.drawImage(s, (c.width - w) / 2, 150, w, h);
  }
  g.fillStyle = '#c1202b';
  g.font = '900 54px Satoshi, Arial';
  g.textAlign = 'center';
  g.fillText('THE CIRCLE', c.width / 2, 560);
  g.font = '500 20px Satoshi, Arial';
  g.fillStyle = 'rgba(193,32,43,0.75)';
  g.fillText('W H A T   A R E   Y O U   L O O K I N G   F O R ?', c.width / 2, 610);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // the lid's UVs (from the .blend) run the other way round
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------
// The table + room
// ---------------------------------------------------------------------------
export function buildRoom() {
  const g = new THREE.Group();
  const wood = woodTexture();
  wood.repeat.set(1.2, 1);
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.62, metalness: 0, color: 0xc9a58a });
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.05, 1.05, 4, 0.012), woodMat);
  top.position.y = -0.025;
  top.receiveShadow = true;
  top.castShadow = true;
  g.add(top);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a170e, roughness: 0.7 });
  for (const [x, z] of [[-0.75, -0.42], [0.75, -0.42], [-0.75, 0.42], [0.75, 0.42]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.06), legMat);
    leg.position.set(x, -0.42, z);
    leg.castShadow = true;
    g.add(leg);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x1a0f0b, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.79;
  floor.receiveShadow = true;
  g.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshStandardMaterial({ color: 0x2a1512, roughness: 1 }));
  wall.position.set(0, 1.2, -1.6);
  wall.receiveShadow = true;
  g.add(wall);
  return g;
}

// ---------------------------------------------------------------------------
// The pin (badge from artboard 3)
// ---------------------------------------------------------------------------
export function buildPin() {
  const R = 0.0175;
  const T = 0.0042;
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9b2a8, metalness: 1, roughness: 0.28 });
  const face = new THREE.MeshPhysicalMaterial({
    map: cache.textures.pinFace || cache.textures.pin, roughness: 0.6, clearcoat: 0.45, clearcoatRoughness: 0.25, emissive: 0xffc58a, emissiveIntensity: 0,
  });
  const geo = new THREE.CylinderGeometry(R, R * 0.97, T, 64, 1);
  const mesh = new THREE.Mesh(geo, [metal, face, metal]);
  mesh.castShadow = true;
  // pin needle + clasp on the back
  const back = new THREE.Group();
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.026, 8), metal);
  needle.rotation.z = Math.PI / 2;
  needle.position.y = -T / 2 - 0.0012;
  const clasp = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.003, 16), metal);
  clasp.position.set(0.011, -T / 2 - 0.0015, 0);
  back.add(needle, clasp);
  const group = new THREE.Group();
  group.add(mesh, back);
  group.userData.glowMats = [face];
  group.userData.radius = R;
  return group;
}

// ---------------------------------------------------------------------------
// The UV flashlight — points along +Z
// ---------------------------------------------------------------------------
export function buildFlashlight() {
  const L = 0.098;
  const pts = [
    [0, 0], [0.0098, 0], [0.0104, 0.003], [0.0104, 0.064], [0.0112, 0.068], [0.0134, 0.08], [0.0136, 0.096], [0.0128, L], [0, L],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(pts, 48);
  bodyGeo.translate(0, -L / 2, 0);
  bodyGeo.rotateX(Math.PI / 2); // axis → +Z, head at +Z
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x141012, metalness: 0.7, roughness: 0.34 }));
  body.castShadow = true;
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xc1202b, roughness: 0.4, metalness: 0.2, emissive: 0xff4050, emissiveIntensity: 0 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0106, 0.0014, 10, 48), ringMat);
  ring.position.z = 0.062 - L / 2 + 0.002;
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2a1a44, emissive: 0x8a4dff, emissiveIntensity: 0, roughness: 0.1, metalness: 0 });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0118, 40), lensMat);
  lens.position.z = L / 2 + 0.0004;
  const btn = new THREE.Mesh(new RoundedBoxGeometry(0.005, 0.0016, 0.008, 2, 0.0007), new THREE.MeshStandardMaterial({ color: 0x2a2224, roughness: 0.8 }));
  btn.position.set(0, 0.0106, -0.004);
  // knurled grip bands
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x0c0a0b, roughness: 0.8, metalness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0006, 6, 40), gripMat);
    band.position.z = -0.03 + i * 0.006;
    body.add(band);
  }
  const group = new THREE.Group();
  group.add(body, ring, lens, btn);
  group.userData.lensMat = lensMat;
  group.userData.glowMats = [ringMat];
  group.userData.glowGain = 14;
  group.userData.tip = new THREE.Vector3(0, 0, L / 2 + 0.001);
  return group;
}

// ---------------------------------------------------------------------------
// The letter: a US-letter sheet folded once in half (artboard 2 inside,
// artboard 1 as the cover). Its shader reveals the UV-only ink.
// Group origin = the fold line = the centre of the open sheet.
// ---------------------------------------------------------------------------
export const LETTER_W = 0.152;
export const LETTER_H = LETTER_W / (612 / 792);

export function buildLetter(sharedUniforms) {
  const W = LETTER_W;
  const h = LETTER_H / 2;
  const group = new THREE.Group();

  const makeHalf = (v0, v1, isTop) => {
    const geo = new THREE.PlaneGeometry(W, h, 1, 1);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
    geo.rotateX(-Math.PI / 2); // lie flat, printed side up, sheet top toward −Z
    const m = new THREE.Mesh(geo, letterMaterial(sharedUniforms, isTop));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // lower half stays put (z: 0 → +h); upper half hinges on the fold (z: −h → 0)
  const bottom = makeHalf(0, 0.5, false);
  bottom.position.z = h / 2;
  const hinge = new THREE.Group();
  const top = makeHalf(0.5, 1, true);
  top.position.z = -h / 2;
  hinge.add(top);
  group.add(bottom, hinge);

  group.userData = {
    panels: [bottom, top],
    hinge,
    glowMats: [bottom.material, top.material],
    /** closed footprint centre, relative to the group origin */
    closedCenter: new THREE.Vector3(0, 0, h / 2),
    setFold(k) {
      // k = 1 closed (upper half folded over the lower half), 0 open
      hinge.rotation.x = Math.PI * 0.996 * k;
      hinge.position.y = 0.0009 * k;
    },
  };
  group.userData.setFold(1);
  return group;
}

function letterMaterial(shared, isTop) {
  const mat = new THREE.MeshStandardMaterial({
    map: cache.textures.letter,
    color: 0xb4b4b4,
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: 0xffc58a,
    emissiveIntensity: 0,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, {
      uIsTop: { value: isTop ? 1 : 0 },
      uCover: { value: cache.textures.letterCover },
    });
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uMask;
        uniform sampler2D uReveal;
        uniform sampler2D uCover;
        uniform vec2 uLight;
        uniform float uLightOn;
        uniform float uRadius;
        uniform float uAspect;
        uniform float uIsTop;
        vec3 uvGlow = vec3(0.0);`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (!gl_FrontFacing) {
          // outside of the folded card: the cover (artboard 1) on the upper half, plain black below
          diffuseColor.rgb = vec3(0.012, 0.004, 0.005);
          if (uIsTop > 0.5) {
            vec2 c = vec2(vMapUv.x, 1.0 - (vMapUv.y - 0.5) * 2.0);
            diffuseColor.rgb = texture2D(uCover, c).rgb;
          }
        } else {
          vec2 dd = (vMapUv - uLight) * vec2(uAspect, 1.0);
          float d = length(dd);
          float beam = (1.0 - smoothstep(uRadius * 0.35, uRadius, d)) * uLightOn;
          float rev = max(texture2D(uReveal, vMapUv).a, beam);
          float ink = texture2D(uMask, vMapUv).a * rev;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.45, 0.3, 0.85), beam * 0.55);
          uvGlow = vec3(0.78, 0.92, 1.0) * ink * 2.2 + vec3(0.30, 0.10, 0.70) * beam * 0.22;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uvGlow;`);
  };
  mat.customProgramCacheKey = () => `letter-bifold-${isTop ? 1 : 0}`;
  return mat;
}

// ---------------------------------------------------------------------------
// Velvet cushion: gathered, wrinkled velvet that sinks around each object.
// shapes: [{ type: 'rect', x, z, w, d } | { type: 'circle', x, z, r } | { type: 'capsule', x, z0, z1, r }]
// ---------------------------------------------------------------------------
function vhash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = vhash(xi, yi), b = vhash(xi + 1, yi), c = vhash(xi, yi + 1), d = vhash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// rounded fold profile (a sharp |x| crease draws hard dark lines in the velvet)
const ridge = (n) => { const k = n * 2 - 1; return 1 - k * k; };

function shapeDistance(s, x, z) {
  if (s.type === 'circle') return Math.hypot(x - s.x, z - s.z) - s.r;
  if (s.type === 'capsule') {
    const cz = Math.max(s.z0, Math.min(s.z1, z));
    return Math.hypot(x - s.x, z - cz) - s.r;
  }
  const dx = Math.abs(x - s.x) - s.w / 2;
  const dz = Math.abs(z - s.z) - s.d / 2;
  const out = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  return out + Math.min(Math.max(dx, dz), 0);
}

export function buildVelvetPad({ w, d, thickness = 0.016, depth = 0.01, shapes = [], wrinkle = 0.0062, segX = 240, segZ = 150, color = 0x620914, down = false } = {}) {
  const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // puffy cushion that rolls down into the walls
    const edge = Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z));
    const roll = Math.sqrt(THREE.MathUtils.smoothstep(edge, 0, 0.014));
    let y = thickness * roll;
    // the objects press into the velvet
    let press = 0;
    let rim = 0;
    for (const s of shapes) {
      const sd = shapeDistance(s, x, z);
      press = Math.max(press, 1 - THREE.MathUtils.smoothstep(sd, -0.003, 0.011));
      rim += Math.exp(-(((sd - 0.007) / 0.005) ** 2)) * 0.0018;
    }
    // gathered folds: stretched noise ridges, calmer where the velvet is pressed
    const n1 = ridge(vnoise(x * 26 + vnoise(z * 16, x * 7) * 1.8, z * 9));
    const n2 = ridge(vnoise(x * 8 + 4.1, z * 34 + vnoise(x * 12, z * 5) * 2.2));
    const n3 = vnoise(x * 90 + n1 * 2.0, z * 60);
    const folds = (n1 * 0.55 + n2 * 0.3 + n3 * 0.15) * wrinkle * roll;
    y += folds * (1 - press * 0.85) + rim * roll - press * depth;
    pos.setY(i, down ? -y : y);
  }
  geo.computeVertexNormals();
  if (down) {
    // face the velvet downwards (inside of the lid)
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    geo.computeVertexNormals();
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.96, metalness: 0,
    sheen: 1, sheenColor: new THREE.Color(0xff7a80), sheenRoughness: 0.32,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

/** Soft additive pool of light placed under the object that is ready to be picked up. */
export function buildHalo(size) {
  const mat = new THREE.MeshBasicMaterial({
    map: radialTexture('rgba(255,214,160,1)', 'rgba(255,214,160,0)'),
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

/** A gently pulsing additive cone used as the visible UV beam. */
export function buildBeam() {
  const geo = new THREE.CylinderGeometry(0.012, 0.05, 1, 32, 1, true);
  geo.translate(0, -0.5, 0);
  geo.rotateX(-Math.PI / 2); // extends along +Z from origin
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){ vT = uv.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOpacity; varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){ float rim = pow(abs(dot(vN, vV)), 1.6); float a = uOpacity * rim * smoothstep(0.0, 0.25, vT) * 0.32;
        gl_FragColor = vec4(vec3(0.55, 0.3, 1.0) * a, a); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

/** Fallback if the .glb cannot be loaded: a box with a hinged lid. */
export function buildPlaceholderBox() {
  const root = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x120607, roughness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9b111b, roughness: 0.85 });
  const base = new THREE.Group();
  base.name = 'box_base';
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.004, 0.18), red);
  floor.position.y = 0.002;
  base.add(floor);
  for (const [w, d, x, z] of [[0.29, 0.004, 0, 0.088], [0.29, 0.004, 0, -0.088], [0.004, 0.18, 0.143, 0], [0.004, 0.18, -0.143, 0]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), black);
    wall.position.set(x, 0.025, z);
    base.add(wall);
  }
  const lid = new THREE.Group();
  lid.name = 'box_lid';
  lid.position.set(0, 0.05, -0.088);
  const lidTop = new THREE.Mesh(new THREE.BoxGeometry(0.296, 0.004, 0.186), [black, black, new THREE.MeshStandardMaterial({ map: lidTexture() }), black, black, black]);
  lidTop.position.set(0, 0.002, 0.088);
  lid.add(lidTop);
  root.add(base, lid);
  return root;
}
