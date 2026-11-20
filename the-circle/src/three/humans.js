import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { cache } from '../core/assets.js';

// ---------------------------------------------------------------------------
// People built from the provided FBX bodies (rigged + zone-tagged in Blender,
// see public/models/body-*.glb). Clothing is painted per zone in the shader:
//   0 head · 1 torso · 2 upper arm · 3 forearm · 4 hand · 5 pelvis/legs · 6 feet · 7 shirt V · 8 neck
// Character space: +Y up, +Z forward, +X = the character's left.
// ---------------------------------------------------------------------------

const Z = { head: 0, top: 1, upper: 2, fore: 3, hand: 4, legs: 5, feet: 6, vee: 7, neck: 8 };
// clothes sit slightly proud of the body so it reads as fabric, not skin
const INFLATE = [0, 0.005, 0.004, 0.0035, 0, 0.005, 0.004, 0.005, 0];

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

function zoneMaterial(colors, rough, hidden) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  const uColors = { value: colors.map((c) => new THREE.Color(c)) };
  const uRough = { value: rough };
  const uHide = { value: hidden };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uZoneColor = uColors;
    sh.uniforms.uZoneRough = uRough;
    sh.uniforms.uHide = uHide;
    sh.uniforms.uInflate = { value: INFLATE };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float _zone;
        flat varying float vZone;
        uniform float uInflate[9];`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vZone = _zone;
        transformed += normalize(objectNormal) * uInflate[int(_zone + 0.5)];`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        flat varying float vZone;
        uniform vec3 uZoneColor[9];
        uniform float uZoneRough[9];
        uniform float uHide[9];`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        int zi = int(vZone + 0.5);
        if (uHide[zi] > 0.5) discard;
        diffuseColor.rgb = uZoneColor[zi];`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = uZoneRough[zi];`);
  };
  mat.customProgramCacheKey = () => 'zone-body';
  mat.userData.colors = uColors;
  return mat;
}

/**
 * @param {'male'|'female'} kind
 * @param {{ height?: number, colors: number[9], rough?: number[9], hide?: number[] }} opts
 */
export function createHuman(kind, { height = 1.75, colors, rough, hide = [], hairColor = null, longHair = false } = {}) {
  const src = cache.models[kind === 'female' ? 'bodyFemale' : 'bodyMale'] || cache.models.bodyMale;
  const group = new THREE.Group();
  if (!src) return null;
  const model = cloneSkinned(src.scene);
  model.scale.setScalar(height);
  group.add(model);

  const bones = {};
  let mesh = null;
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isSkinnedMesh) mesh = o;
  });
  const hidden = new Array(9).fill(0);
  hide.forEach((z) => { hidden[z] = 1; });
  mesh.material = zoneMaterial(colors, rough || [0.75, 0.85, 0.85, 0.85, 0.7, 0.8, 0.45, 0.7, 0.75], hidden);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // skinned bounds are unreliable once posed

  const rest = {};
  for (const [n, b] of Object.entries(bones)) rest[n] = b.quaternion.clone();

  // hair (skipped when the head is hidden, e.g. the Keeper)
  if (hairColor != null && !hide.includes(Z.head)) {
    group.updateMatrixWorld(true);
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
    const r = 0.066 * height;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
    cap.scale.set(0.95, 1, 1.08);
    cap.position.copy(model.localToWorld(new THREE.Vector3(0, 0.937, -0.008)));
    cap.rotation.x = -0.42;
    cap.castShadow = true;
    group.add(cap);
    bones.head.attach(cap);
    if (longHair) {
      const back = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 18, 12), hairMat);
      back.scale.set(1.05, 1.7, 0.55);
      back.position.copy(model.localToWorld(new THREE.Vector3(0, 0.885, -0.04)));
      back.castShadow = true;
      group.add(back);
      bones.head.attach(back);
    }
  }

  const h = {
    kind, group, model, bones, mesh, height, rest,
    /** world-space direction from a bone to its child, expressed in character space */
    aim(name, childName, dir) {
      const b = bones[name];
      const c = bones[childName];
      if (!b || !c) return;
      group.updateMatrixWorld(true);
      const bp = b.getWorldPosition(new THREE.Vector3());
      const cp = c.getWorldPosition(new THREE.Vector3());
      const cur = cp.sub(bp).normalize();
      const want = _v.copy(dir).normalize().applyQuaternion(group.getWorldQuaternion(_q2));
      const delta = new THREE.Quaternion().setFromUnitVectors(cur, want);
      const bw = b.getWorldQuaternion(new THREE.Quaternion());
      const pw = b.parent.getWorldQuaternion(new THREE.Quaternion());
      b.quaternion.copy(pw.invert().multiply(delta.multiply(bw)));
      b.updateMatrixWorld(true);
    },
    resetPose() { for (const [n, q] of Object.entries(rest)) bones[n].quaternion.copy(q); },
    /** apply a list of [bone, child, dir] aims from the rest pose and return the resulting pose */
    makePose(spec) {
      this.resetPose();
      for (const [b, c, d] of spec) this.aim(b, c, new THREE.Vector3(...d));
      const pose = {};
      for (const [n, b] of Object.entries(bones)) pose[n] = b.quaternion.clone();
      return pose;
    },
    applyPose(pose) { for (const [n, q] of Object.entries(pose)) bones[n].quaternion.copy(q); },
    blendPoses(a, b, k) { for (const n of Object.keys(a)) bones[n].quaternion.slerpQuaternions(a[n], b[n], k); },
    /** extra rotation around a character-space axis, on top of the current local rotation */
    turn(name, axis, angle) {
      const b = bones[name];
      if (!b) return;
      const pw = b.parent.getWorldQuaternion(_q).invert();
      const gw = group.getWorldQuaternion(_q2);
      _v.copy(axis).applyQuaternion(gw).applyQuaternion(pw).normalize();
      b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(_v, angle));
    },
    boneWorld(name, target = new THREE.Vector3()) { return bones[name].getWorldPosition(target); },
    /** move the model vertically so a bone ends up at a given height above the group origin */
    settle(boneName, y) {
      group.updateMatrixWorld(true);
      const p = bones[boneName].getWorldPosition(new THREE.Vector3());
      const local = group.worldToLocal(p);
      model.position.y += y - local.y;
      group.updateMatrixWorld(true);
    },
  };
  return h;
}

// ---------------------------------------------------------------------------
// poses (character space)
// ---------------------------------------------------------------------------
const mirror = (spec) => spec.flatMap(([b, c, d]) => (b.endsWith('_L')
  ? [[b, c, d], [b.replace('_L', '_R'), c.replace('_L', '_R'), [-d[0], d[1], d[2]]]]
  : [[b, c, d]]));

export const POSES = {
  stand: mirror([
    ['thigh_L', 'shin_L', [0.03, -1, 0.01]],
    ['shin_L', 'foot_L', [0, -1, -0.03]],
    ['upperarm_L', 'forearm_L', [0.2, -1, 0.04]],
    ['forearm_L', 'hand_L', [0.1, -1, 0.2]],
  ]),
  sit: mirror([
    ['spine', 'chest', [0, 1, 0.06]],
    ['thigh_L', 'shin_L', [0.1, -0.06, 1]],
    ['shin_L', 'foot_L', [0.02, -1, 0.1]],
    ['upperarm_L', 'forearm_L', [0.16, -0.92, 0.38]],
    ['forearm_L', 'hand_L', [-0.15, -0.2, 1]],
  ]),
};

// ---------------------------------------------------------------------------
// palettes
// ---------------------------------------------------------------------------
const SKIN = [0x8d5a3b, 0xc68e6a, 0x5b3a29, 0xe0b48f, 0xa86f4c, 0x3f2a1f];
const TOPS = [0xb8823a, 0x6b7a4a, 0xa4483a, 0x3d4f6b, 0xe7dfcd, 0x7b4f6b, 0x2f5a57, 0xc9a66b, 0x8a3a2e];
const BOTTOMS = [0x2a2a33, 0x3b2f28, 0x4a4a52, 0x1d2a3a, 0x6b5a45, 0x2b3b2b];

export function casualColors(rnd) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const skin = pick(SKIN);
  const top = pick(TOPS);
  const shortSleeves = rnd() < 0.45;
  const legs = pick(BOTTOMS);
  return [skin, top, top, shortSleeves ? skin : top, skin, legs, 0x1a1412, top, skin];
}

export const SUIT_COLORS = [0x000000, 0x16131a, 0x16131a, 0x16131a, 0x0d0a0a, 0x141117, 0x070505, 0x16131a, 0x16131a];
export const SUIT_ROUGH = [0.8, 0.72, 0.72, 0.72, 0.5, 0.72, 0.3, 0.7, 0.72];
export { Z as ZONES };
