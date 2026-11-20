import * as THREE from 'three';
import { cache } from '../core/assets.js';
import { createHuman, POSES, SUIT_COLORS, SUIT_ROUGH, ZONES } from './humans.js';

// THE KEEPER — the provided male body in a dark suit, white shirt and tie.
// Its head is the original THE CIRCLE symbol, layered into a thick cut-out with a soft
// glow behind it, always turned towards the visitor (like the flat identity figure).

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

export function buildKeeper() {
  const HEIGHT = 1.86;
  const H = createHuman('male', { height: HEIGHT, colors: SUIT_COLORS, rough: SUIT_ROUGH, hide: [ZONES.head, ZONES.neck] });
  const root = H.group;

  // --- tie + pocket square, fixed to the chest bone (placed in the rest pose) ---
  H.resetPose();
  root.updateMatrixWorld(true);
  const pos = H.mesh.geometry.attributes.position;
  const zone = H.mesh.geometry.attributes._zone;
  let front = -1;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.7 && y < 0.76 && Math.abs(pos.getX(i)) < 0.025 && (!zone || zone.getX(i) > 0.5)) front = Math.max(front, pos.getZ(i));
  }
  if (front < 0) front = 0.07;
  front += 0.005; // jacket thickness (see INFLATE in humans.js)
  const toWorld = (x, y, z) => H.model.localToWorld(new THREE.Vector3(x, y, z));
  // crisp white shirt "V" between the lapels
  const shirtShape = new THREE.Shape();
  shirtShape.moveTo(-0.065, 0); shirtShape.lineTo(0.065, 0); shirtShape.lineTo(0, -0.25); shirtShape.closePath();
  const shirt = new THREE.Mesh(new THREE.ShapeGeometry(shirtShape), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.7, side: THREE.DoubleSide }));
  shirt.position.copy(toWorld(0, 0.81, front + 0.002));
  shirt.rotation.x = -0.16;
  root.add(shirt);
  H.bones.chest.attach(shirt);
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x0b0809, roughness: 0.45 });
  const tieShape = new THREE.Shape();
  tieShape.moveTo(-0.012, 0); tieShape.lineTo(0.012, 0); tieShape.lineTo(0.022, -0.2); tieShape.lineTo(0, -0.235); tieShape.lineTo(-0.022, -0.2); tieShape.closePath();
  const tie = new THREE.Mesh(new THREE.ExtrudeGeometry(tieShape, { depth: 0.008, bevelEnabled: false }), tieMat);
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.014), tieMat);
  knot.position.set(0, 0.008, 0.004);
  tie.add(knot);
  tie.position.copy(toWorld(0, 0.8, front + 0.004));
  tie.rotation.x = -0.16;
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.02, 0.006), new THREE.MeshStandardMaterial({ color: 0xc1202b, roughness: 0.55 }));
  pocket.position.copy(toWorld(0.07, 0.715, front - 0.006));
  pocket.rotation.set(-0.1, 0.18, 0.08);
  root.add(tie, pocket);
  H.bones.chest.attach(tie);
  H.bones.chest.attach(pocket);
  [tie, knot, pocket].forEach((m) => { m.castShadow = true; });

  // --- poses ---
  const stand = H.makePose(POSES.stand);
  const welcome = H.makePose([
    ...POSES.stand,
    ['upperarm_R', 'forearm_R', [-0.8, -0.42, 0.45]],
    ['forearm_R', 'hand_R', [-0.5, 0.12, 1]],
  ]);
  H.applyPose(stand);
  H.settle('foot_L', 0.045 * HEIGHT);
  const baseY = H.model.position.y;

  // --- the logo head ---
  const head = new THREE.Group();
  root.add(head);
  const headTex = cache.textures.keeperHead || cache.textures.symbol;
  const aspect = headTex?.image ? headTex.image.width / headTex.image.height : 1;
  const hs = 0.44;
  const headGeo = new THREE.PlaneGeometry(hs * aspect, hs);
  const layers = 9;
  for (let i = 0; i < layers; i++) {
    const m = new THREE.MeshStandardMaterial({
      map: headTex, alphaTest: 0.45, side: THREE.DoubleSide,
      color: i === 0 || i === layers - 1 ? 0x1a0d0e : 0x0d0606, roughness: 0.55, metalness: 0.1,
    });
    const p = new THREE.Mesh(headGeo, m);
    p.position.z = (i - (layers - 1) / 2) * 0.006;
    p.castShadow = true;
    head.add(p);
  }
  const gc = document.createElement('canvas');
  gc.width = gc.height = 256;
  const gg = gc.getContext('2d');
  const grd = gg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,214,160,0.95)');
  grd.addColorStop(0.35, 'rgba(255,170,110,0.55)');
  grd.addColorStop(1, 'rgba(255,150,90,0)');
  gg.fillStyle = grd;
  gg.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(gc);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(hs * 2.1, hs * 2.1),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, toneMapped: false }),
  );
  glow.position.z = -0.05;
  head.add(glow);

  const rig = { root, head, H, walk: 0, walking: 0, wave: 0, t: 0 };
  const tmp = new THREE.Vector3();

  /** per-frame pose; `camPos` keeps the head turned to the visitor */
  rig.update = (dt, camPos) => {
    rig.t += dt;
    const t = rig.t;
    const w = rig.walking;
    rig.walk += dt * 7.0 * w;
    const s = Math.sin(rig.walk);
    const c = Math.cos(rig.walk);

    if (rig.wave > 0.001) H.blendPoses(stand, welcome, rig.wave);
    else H.applyPose(stand);
    root.updateMatrixWorld(true);
    // legs
    H.turn('thigh_L', X, -s * 0.42 * w);
    H.turn('thigh_R', X, s * 0.42 * w);
    root.updateMatrixWorld(true);
    H.turn('shin_L', X, Math.max(0, c) * 0.65 * w);
    H.turn('shin_R', X, Math.max(0, -c) * 0.65 * w);
    // arms swing against the legs; breathing when still
    H.turn('upperarm_L', X, s * 0.3 * w);
    H.turn('upperarm_R', X, -s * 0.3 * w * (1 - rig.wave));
    H.turn('chest', X, Math.sin(t * 1.4) * 0.012 * (1 - w));
    H.turn('spine', Y, s * 0.05 * w);
    H.model.position.y = baseY + Math.abs(c) * 0.03 * w - 0.015 * w;
    root.updateMatrixWorld(true);

    // head floats just above the shoulders and faces the camera
    H.boneWorld('head', tmp);
    root.worldToLocal(tmp);
    head.position.set(tmp.x, tmp.y + 0.13 + Math.sin(t * 1.4 + 1) * 0.006, tmp.z + 0.01);
    if (camPos) {
      const hp = head.getWorldPosition(new THREE.Vector3());
      head.rotation.y = Math.atan2(camPos.x - hp.x, camPos.z - hp.z) - root.rotation.y;
    }
    head.rotation.z = Math.sin(t * 0.7) * 0.05 + rig.wave * 0.1;
  };
  return rig;
}
