import * as THREE from 'three';
import gsap from 'gsap';
import { html } from '../core/director.js';
import { gl, disposeTree } from '../core/gl.js';
import { audio } from '../core/audio.js';
import { cache } from '../core/assets.js';
import { fromBlack, toBlack, setBlack, wait } from '../core/curtain.js';
import {
  buildRoom, buildPin, buildFlashlight, buildLetter, buildHalo, buildBeam, buildPlaceholderBox,
  lidTexture, radialTexture, buildVelvetPad, LETTER_W, LETTER_H,
} from '../three/invitationObjects.js';

// SCENES 03 + 04 — the invitation arrives / discovering the contents.
export function invitation({ director, stage }) {
  let view;
  let ui;
  let alive = true;
  return {
    async enter() {
      ui = html(`
        <section class="scene scene--passthrough inv-ui">
          <div class="vignette"></div>
          <div class="hint-hand" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5c0 3.6-2.4 6.5-6 6.5h-1c-2 0-3.3-.8-4.4-2.2L4 15.2a1.5 1.5 0 0 1 2.3-1.9L9 16"/></svg>
            <span>Click to open</span>
          </div>
          <p class="caption" role="status"></p>
        </section>`);
      stage.appendChild(ui);
      setBlack(true);
      view = new InvitationView(ui, async () => {
        await toBlack(1.4);
        director.go('decision');
      });
      gl.setView(view);
      gl.renderer.compile(view.scene, view.camera);

      // In darkness: someone knocks. Then the room fades in.
      await wait(0.5);
      audio.duck(0.35);
      await audio.playSfx('knock');
      audio.unduck();
      if (!alive) return;
      fromBlack(1.8);
      await wait(0.6);
      if (alive) view.start();
    },
    async exit() {
      alive = false;
      gl.setView(null);
      view?.dispose();
      ui?.remove();
    },
  };
}

const V3 = THREE.Vector3;
const CAM = {
  intro: { pos: new V3(0, 0.4, 0.66), look: new V3(0, 0.012, 0) },
  open: { pos: new V3(0, 0.5, 0.24), look: new V3(0, 0.0, -0.004) },
  outro: { pos: new V3(-0.13, 0.5, 0.6), look: new V3(-0.13, 0.0, 0.0) },
};
const DIM_FOCUS = 0.62;

class InvitationView {
  constructor(ui, onDone) {
    this.ui = ui;
    this.onDone = onDone;
    this.hint = ui.querySelector('.hint-hand');
    this.captionEl = ui.querySelector('.caption');
    this.state = 'idle';
    this.mouse = new THREE.Vector2(0, 0);
    this.mousePx = { x: 0, y: 0 };
    this.parallax = new THREE.Vector2();
    this.parallaxAmt = 1;
    this.ray = new THREE.Raycaster();
    this.ray.layers.enableAll(); // focused objects live on layer 1
    this.time = 0;
    this.dim = { v: 0 };
    this.uvOn = { v: 0 };
    this.revealed = false;
    this.frame = 0;

    const scene = (this.scene = new THREE.Scene());
    // no scene.background: a Color background would force a clear on the second
    // (focus layer) pass — the clear colour is set manually in render().
    scene.fog = new THREE.Fog(0x0a0505, 1.4, 3.6);

    const camera = (this.camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 20));
    this.camPos = CAM.intro.pos.clone().add(new V3(0, 0.05, 0.12));
    this.camLook = CAM.intro.look.clone();
    camera.position.copy(this.camPos);
    camera.lookAt(this.camLook);
    scene.add(camera);
    // soft fill that travels with the camera and only lights the focused objects (layer 1)
    const focusFill = new THREE.PointLight(0xffe0c2, 0.16, 1.2, 2);
    focusFill.position.set(0.08, 0.06, 0.05);
    focusFill.layers.set(1);
    camera.add(focusFill);

    // ---- lights ----
    const spot = (this.spot = new THREE.SpotLight(0xffd7ab, 5.2, 0, 0.44, 0.8, 2));
    spot.position.set(0.18, 1.15, 0.32);
    spot.target.position.set(-0.04, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0002;
    spot.shadow.normalBias = 0.0015;
    spot.shadow.camera.near = 0.3;
    spot.shadow.camera.far = 3;
    scene.add(spot, spot.target);
    const hemi = new THREE.HemisphereLight(0x8c6e66, 0x120807, 0.45);
    const rim = new THREE.DirectionalLight(0x7d86ff, 0.35);
    rim.position.set(-1, 0.8, -1.2);
    const fill = new THREE.PointLight(0xffa76a, 0.35, 0, 2);
    fill.position.set(-0.4, 0.4, 0.7);
    // soft light that reaches into the box past its walls (no shadows)
    const inner = new THREE.PointLight(0xffc9a0, 0.35, 0.6, 2);
    inner.position.set(-0.02, 0.22, 0.12);
    scene.add(hemi, rim, fill, inner);
    // `inner` stays on layer 0 only, so it never washes out the letter when it is held up close
    this.lights = [spot, hemi, rim, fill];
    this.baseSpot = spot.intensity;

    // ---- room + table ----
    scene.add(buildRoom());

    // ---- the box (provided model) ----
    const boxRoot = (this.boxRoot = new THREE.Group());
    scene.add(boxRoot);
    const model = cache.models.box ? cache.models.box.scene.clone(true) : buildPlaceholderBox();
    boxRoot.add(model);
    this.base = model.getObjectByName('box_base');
    this.lid = model.getObjectByName('box_lid');
    // The model's own letter/pin/flashlight are simple stand-ins without textures:
    // they are replaced by the detailed interactive versions below.
    for (const n of ['letter', 'pin', 'uv_flashlight']) { const o = model.getObjectByName(n); if (o) o.visible = false; }
    // matte paperboard finish; the lid keeps its own artwork (carta-15.jpg from the .blend)
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const name = (o.material?.name || '').toLowerCase();
      if (name.startsWith('negro')) o.material = new THREE.MeshStandardMaterial({ color: 0x141012, roughness: 0.93, metalness: 0 });
      else if (name.startsWith('rojo')) o.userData.innerStrip = true;
      else if (name.startsWith('material')) {
        const map = o.material.map || lidTexture();
        o.material = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
      }
    });

    // find the inner floor of the box so the contents rest on it
    model.updateMatrixWorld(true);
    this.lid.visible = false;
    this.ray.set(new V3(0.0, 0.4, 0.0), new V3(0, -1, 0));
    // ignore the thin inner strip (hidden below), it is not the floor
    const hit = this.ray.intersectObject(this.base, true).find((h) => !h.object.userData.innerStrip);
    this.lid.visible = true;
    const floorY = hit && hit.point.y < 0.035 ? hit.point.y : 0.006;

    // layout of the contents (box coordinates)
    const LAY = {
      letter: { x: -0.043, z: 0.0 }, // centre of the folded card
      pin: { x: 0.094, z: -0.055 },
      flash: { x: 0.094, z: 0.03, len: 0.098 },
    };
    const PAD = { thickness: 0.018, depth: 0.012 };
    const padBase = floorY + 0.002;
    const bed = padBase + PAD.thickness - PAD.depth;

    // gathered velvet cushion that sinks around the letter, the pin and the flashlight
    const pad = buildVelvetPad({
      w: 0.272, d: 0.166, thickness: PAD.thickness, depth: PAD.depth,
      shapes: [
        { type: 'rect', x: LAY.letter.x, z: LAY.letter.z, w: LETTER_W + 0.004, d: LETTER_H / 2 + 0.004 },
        { type: 'circle', x: LAY.pin.x, z: LAY.pin.z, r: 0.0195 },
        { type: 'capsule', x: LAY.flash.x, z0: LAY.flash.z - LAY.flash.len / 2 + 0.012, z1: LAY.flash.z + LAY.flash.len / 2 - 0.012, r: 0.0145 },
      ],
    });
    pad.position.y = padBase;
    boxRoot.add(pad);

    // padded velvet on the inside of the lid
    {
      const saved = this.lid.rotation.x;
      this.lid.rotation.x = 0;
      this.lid.updateMatrixWorld(true);
      const lb = new THREE.Box3().setFromObject(this.lid);
      const size = lb.getSize(new V3());
      const lidPad = buildVelvetPad({ w: size.x - 0.014, d: size.z - 0.014, thickness: 0.006, depth: 0, wrinkle: 0.0016, segX: 120, segZ: 76 });
      // placed in world space, then attached: the lid node carries a non-uniform scale from Blender
      lidPad.rotation.x = Math.PI; // velvet faces down into the box
      lidPad.position.set((lb.min.x + lb.max.x) / 2, lb.max.y - 0.0025, (lb.min.z + lb.max.z) / 2);
      boxRoot.add(lidPad);
      boxRoot.updateMatrixWorld(true);
      this.lid.attach(lidPad);
      this.lid.rotation.x = saved;
    }
    // a thin inner strip of the model shows as a dark line across the front once the velvet is in
    model.traverse((o) => { if (o.userData.innerStrip) o.visible = false; });

    // ---- contents ----
    this.uniforms = {
      uMask: { value: cache.textures.letterUV },
      uReveal: { value: null },
      uSymbol: { value: cache.textures.symbol },
      uLight: { value: new THREE.Vector2(-5, -5) },
      uLightOn: { value: 0 },
      uRadius: { value: 0.11 },
      uAspect: { value: LETTER_W / LETTER_H },
    };
    this.makeRevealCanvas();

    this.pin = buildPin();
    this.flash = buildFlashlight();
    this.letter = buildLetter(this.uniforms);

    // the letter's origin is its fold line, so its folded footprint sits LETTER_H/4 in front of it
    this.slots = {
      pin: { pos: new V3(LAY.pin.x, bed + 0.004, LAY.pin.z), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.4, 0)) },
      flash: { pos: new V3(LAY.flash.x, bed + 0.0128, LAY.flash.z), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)) },
      letter: { pos: new V3(LAY.letter.x, bed + 0.0004, LAY.letter.z - LETTER_H / 4), quat: new THREE.Quaternion() },
      letterTable: { pos: new V3(-0.33, 0.0008, 0.0), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.14, 0)) },
    };
    this.layout = LAY;
    for (const k of ['pin', 'flash', 'letter']) {
      const o = this[k];
      o.position.copy(this.slots[k].pos);
      o.quaternion.copy(this.slots[k].quat);
      o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      boxRoot.add(o);
    }

    this.halos = {
      pin: buildHalo(1), flash: buildHalo(1), letter: buildHalo(1),
    };
    this.halos.pin.scale.set(0.075, 0.075, 1);
    this.halos.flash.scale.set(0.06, 0.15, 1);
    this.halos.letter.scale.set(0.24, 0.16, 1);
    for (const [k, h] of Object.entries(this.halos)) {
      h.position.set(LAY[k].x, bed + 0.0006, LAY[k].z);
      boxRoot.add(h);
    }

    // UV beam + violet spot that travel with the flashlight
    this.beam = buildBeam();
    scene.add(this.beam);
    this.uvSpot = new THREE.SpotLight(0x8a55ff, 0, 0, 0.32, 1, 2);
    this.uvSpot.layers.enableAll();
    scene.add(this.uvSpot, this.uvSpot.target);
    this.lights.push(this.uvSpot);
    this.flashFollow = { pos: new V3(), target: new V3(), init: false };

    // floating dust in the light
    this.dust = this.makeDust();
    scene.add(this.dust);

    // everything lights both layers (layer 1 = focused objects drawn above the dim)
    for (const l of this.lights) {
      l.layers.enableAll();
      if (l.shadow) l.shadow.camera.layers.enableAll();
    }

    // full-screen dim overlay (between the scene and the focused object)
    this.dimScene = new THREE.Scene();
    this.dimCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.dimMat = new THREE.MeshBasicMaterial({ color: 0x050203, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
    this.dimScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.dimMat));

    // ---- input ----
    this.canvas = gl.canvas;
    this.onMove = (e) => this.handleMove(e);
    this.onDown = (e) => this.handleDown(e);
    this.onUp = (e) => this.handleUp(e);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
  }

  // ------------------------------------------------------------------ helpers
  makeRevealCanvas() {
    const c = (this.revealCanvas = document.createElement('canvas'));
    c.width = 256;
    c.height = Math.round(256 * (LETTER_H / LETTER_W));
    this.revealCtx = c.getContext('2d', { willReadFrequently: true });
    this.revealTex = new THREE.CanvasTexture(c);
    this.uniforms.uReveal.value = this.revealTex;
    // low-res copy of the UV-ink mask, to measure how much of the password has been lit
    const m = document.createElement('canvas');
    m.width = c.width; m.height = c.height;
    const mg = m.getContext('2d', { willReadFrequently: true });
    const img = cache.textures.letterUV?.image;
    if (img) mg.drawImage(img, 0, 0, m.width, m.height);
    const md = mg.getImageData(0, 0, m.width, m.height).data;
    this.maskAlpha = new Float32Array(m.width * m.height);
    let total = 0;
    for (let i = 0; i < this.maskAlpha.length; i++) { this.maskAlpha[i] = md[i * 4 + 3] / 255; total += this.maskAlpha[i]; }
    this.maskTotal = total || 1;
  }

  makeDust() {
    const n = 260;
    const pos = new Float32Array(n * 3);
    this.dustSeed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(Math.random()) * 0.42;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r + 0.05;
      pos[i * 3 + 1] = Math.random() * 0.9 + 0.02;
      pos[i * 3 + 2] = Math.sin(a) * r;
      this.dustSeed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      size: 0.003, map: radialTexture('rgba(255,225,190,1)', 'rgba(255,225,190,0)'), transparent: true, opacity: 0.32,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9b0,
    });
    return new THREE.Points(g, m);
  }

  setCaption(text) {
    const el = this.captionEl;
    if (!text) { el.classList.remove('is-on'); return; }
    if (el.innerHTML === text && el.classList.contains('is-on')) return;
    el.classList.remove('is-on');
    clearTimeout(this._capT);
    this._capT = setTimeout(() => { el.innerHTML = text; el.classList.add('is-on'); }, el.innerHTML ? 350 : 0);
  }

  setLayer(obj, n) { obj.traverse((o) => o.layers.set(n)); }

  camPoint(x, y, z) { return new V3(x, y, z).applyMatrix4(this.camera.matrixWorld); }

  faceCamera(extraX = Math.PI / 2) {
    return this.camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), extraX));
  }

  /** Fly an object along a lifted curve to a new pose. */
  flyTo(obj, toPos, toQuat, { duration = 0.9, lift = 0.05, ease = 'power3.inOut' } = {}) {
    const p0 = obj.position.clone();
    const q0 = obj.quaternion.clone();
    const ctrl = p0.clone().lerp(toPos, 0.5);
    ctrl.y = Math.max(p0.y, toPos.y) + lift;
    const tmp = new V3();
    const s = { k: 0 };
    return new Promise((res) => {
      gsap.to(s, {
        k: 1, duration, ease,
        onUpdate: () => {
          const k = s.k;
          tmp.copy(p0).multiplyScalar((1 - k) * (1 - k)).addScaledVector(ctrl, 2 * (1 - k) * k).addScaledVector(toPos, k * k);
          obj.position.copy(tmp);
          obj.quaternion.slerpQuaternions(q0, toQuat, k);
        },
        onComplete: res,
      });
    });
  }

  tweenDim(v, duration = 0.7) { return gsap.to(this.dim, { v, duration, ease: 'power2.inOut', overwrite: true }); }

  pick(objects) {
    this.ray.setFromCamera(this.mouse, this.camera);
    return this.ray.intersectObjects(objects, true)[0] || null;
  }

  // ------------------------------------------------------------------ flow
  start() {
    gsap.to(this.camPos, { ...CAM.intro.pos, duration: 2.4, ease: 'power2.out', overwrite: true });
    this.state = 'intro';
    this._hintT = setTimeout(() => { if (this.state === 'intro') this.hint.classList.add('is-on'); }, 600);
  }

  async openBox() {
    this.state = 'busy';
    this.hint.classList.remove('is-on');
    audio.blip('lid');
    gsap.to(this, { parallaxAmt: 0, duration: 0.8 });
    gsap.to(this.camPos, { ...CAM.open.pos, duration: 1.9, ease: 'power2.inOut', overwrite: true });
    // phones: aim a little beyond the box so it sits in the lower half, leaving the top for the letter
    const openLook = this.camera.aspect < 1 ? { x: 0, y: 0, z: -0.17 } : CAM.open.look;
    gsap.to(this.camLook, { ...openLook, duration: 1.9, ease: 'power2.inOut', overwrite: true });
    const lid = this.lid;
    const y0 = lid.position.y;
    await gsap.timeline({ delay: 0.5 })
      .to(lid.position, { y: y0 + 0.006, duration: 0.3, ease: 'power2.out' })
      .to(lid.rotation, { x: -1.95, duration: 1.4, ease: 'power3.inOut' }, '-=0.1')
      .to(lid.rotation, { x: -1.9, duration: 0.35, ease: 'sine.out' })
      .to(lid.position, { y: y0, duration: 0.3 }, '-=0.3');
    await wait(0.2);
    this.state = 'pin-ready';
    this.setCaption('Something is waiting for you · <b>click the pin</b>');
  }

  async focusPin() {
    this.state = 'busy';
    audio.blip('up');
    this.setCaption('');
    this.setLayer(this.pin, 1);
    this.tweenDim(DIM_FOCUS, 0.9);
    // keep the whole pin on screen on narrow (portrait) screens too
    const pinDist = Math.max(0.11, 0.036 / (0.7 * 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect));
    const to = this.camPoint(0, 0, -pinDist);
    await this.flyTo(this.pin, to, this.faceCamera(Math.PI / 2), { duration: 1.0, lift: 0.08 });
    this.pinBase = this.pin.position.clone();
    this.spin = new THREE.Vector2(0, 0);
    this.state = 'pin-focus';
    this.setCaption('Drag to turn it · Click outside to put it back');
  }

  async returnPin() {
    this.state = 'busy';
    this.setCaption('');
    audio.blip('soft');
    this.tweenDim(0, 0.9);
    await this.flyTo(this.pin, this.slots.pin.pos, this.slots.pin.quat, { duration: 0.95, lift: 0.07 });
    this.setLayer(this.pin, 0);
    this.state = 'letter-ready';
    this.setCaption('Now, <b>the letter</b>');
  }

  /** mode: 'closed' (folded card centred), 'center' (open sheet centred), 'left' (open, reading position) */
  letterPose(mode) {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const aspect = this.camera.aspect;
    const portrait = aspect < 1;
    // reading position: left half on wide screens, upper half on phones (the box stays visible below)
    const reading = mode === 'left';
    const fitH = reading && portrait ? 0.42 : 0.9;
    const fitW = reading && !portrait ? 0.42 : 0.9;
    const dist = Math.max(LETTER_H / (fitH * 2 * tan), LETTER_W / (fitW * 2 * tan * aspect));
    const visH = 2 * tan * dist;
    const visW = visH * aspect;
    let x = 0;
    let y = -visH * 0.005;
    if (reading && !portrait) x = Math.min(0, -visW / 2 + LETTER_W / 2 + visW * 0.07);
    if (reading && portrait) y = visH / 2 - LETTER_H / 2 - visH * 0.075;
    // the folded card hangs below the fold line, so lift it to sit centred
    if (mode === 'closed') y += LETTER_H / 4;
    return { pos: this.camPoint(x, y, mode === 'closed' ? -dist * 0.8 : -dist), quat: this.faceCamera(Math.PI / 2) };
  }

  async focusLetter() {
    this.state = 'busy';
    this.setCaption('');
    audio.blip('paper');
    this.setLayer(this.letter, 1);
    this.tweenDim(DIM_FOCUS, 0.9);
    const c = this.letterPose('closed');
    await this.flyTo(this.letter, c.pos, c.quat, { duration: 1.0, lift: 0.06 });
    await wait(0.25);
    // it opens once, along the middle fold, settling into the centre as it opens
    const open = this.letterPose('center');
    const f = { k: 1 };
    audio.blip('paper');
    await Promise.all([
      gsap.to(f, { k: 0, duration: 1.0, ease: 'power2.inOut', onUpdate: () => this.letter.userData.setFold(f.k) }),
      gsap.to(this.letter.position, { x: open.pos.x, y: open.pos.y, z: open.pos.z, duration: 1.0, ease: 'power2.inOut' }),
    ]);
    await wait(0.35);
    const l = this.letterPose('left');
    await this.flyTo(this.letter, l.pos, l.quat, { duration: 0.9, lift: 0, ease: 'power2.inOut' });
    // the flashlight is next: bring the box above the dim so it reads clearly
    this.setLayer(this.boxRoot, 1);
    this.tweenDim(0.5, 0.8);
    this.state = 'flash-ready';
    this.setCaption('Some truths need the right light · <b>take the flashlight</b>');
  }

  async activateFlash() {
    this.state = 'busy';
    this.setCaption('');
    audio.blip('uv');
    this.tweenDim(0.74, 0.9);
    gsap.to(this.spot, { intensity: this.baseSpot * 0.3, duration: 0.9 });
    this.canvas.style.cursor = 'none';
    // lift towards the hand, then hand over to mouse-follow
    const start = this.followTarget();
    await this.flyTo(this.flash, start.pos, start.quat, { duration: 0.75, lift: 0.05 });
    this.flashFollow.pos.copy(this.flash.position);
    this.flashFollow.target.copy(start.target);
    gsap.to(this.flash.userData.lensMat, { emissiveIntensity: 3.2, duration: 0.3 });
    gsap.to(this.uvOn, { v: 1, duration: 0.35 });
    this.state = 'flash-active';
    this.setCaption('Move the light across the letter');
  }

  followTarget() {
    this.ray.setFromCamera(this.mouse, this.camera);
    const hit = this.ray.intersectObjects(this.letter.userData.panels, false)[0];
    const target = hit ? hit.point.clone() : this.ray.ray.at(0.5, new V3());
    const right = new V3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new V3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const pos = this.ray.ray.at(0.2, new V3()).addScaledVector(right, 0.04).addScaledVector(up, -0.035);
    const dummy = new THREE.Object3D();
    dummy.position.copy(pos);
    dummy.lookAt(target);
    return { pos, quat: dummy.quaternion.clone(), target, hit };
  }

  async finishInspection() {
    this.state = 'busy';
    this.setCaption('');
    audio.blip('soft');
    this.canvas.style.cursor = '';
    gsap.to(this.flash.userData.lensMat, { emissiveIntensity: 0, duration: 0.4 });
    gsap.to(this.uvOn, { v: 0, duration: 0.4 });
    gsap.to(this.uniforms.uLightOn, { value: 0, duration: 0.4 });
    gsap.to(this.spot, { intensity: this.baseSpot, duration: 1.2 });
    this.tweenDim(0, 1.2);
    // everything goes back on the table
    gsap.to(this.camPos, { ...CAM.outro.pos, duration: 1.6, ease: 'power2.inOut', overwrite: true });
    gsap.to(this.camLook, { ...CAM.outro.look, duration: 1.6, ease: 'power2.inOut', overwrite: true });
    await Promise.all([
      this.flyTo(this.flash, this.slots.flash.pos, this.slots.flash.quat, { duration: 1.0, lift: 0.06 }),
      this.flyTo(this.letter, this.slots.letterTable.pos, this.slots.letterTable.quat, { duration: 1.3, lift: 0.08 }),
    ]);
    this.setLayer(this.boxRoot, 0);
    this.setLayer(this.letter, 0);
    audio.blip('paper');
    // the fade to black starts as soon as everything rests on the table
    await wait(0.15);
    this.state = 'done';
    this.onDone();
  }

  // ------------------------------------------------------------------ input
  handleMove(e) {
    this.mousePx = { x: e.clientX, y: e.clientY };
    this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.state === 'pin-focus') { this.spin.set(dx * 0.012, dy * 0.012); this.applySpin(); }
    }
  }

  handleDown(e) {
    this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
    if (this.state === 'pin-focus') this.canvas.style.cursor = 'grabbing';
  }

  handleUp() {
    if (!this.drag) return;
    const moved = this.drag.moved;
    this.drag = null;
    if (this.state === 'pin-focus') this.canvas.style.cursor = 'grab';
    if (moved > 6) return; // it was a drag, not a click
    this.handleClick();
  }

  handleClick() {
    switch (this.state) {
      case 'intro':
        if (this.pick([this.boxRoot])) this.openBox();
        break;
      case 'pin-ready':
        if (this.pick([this.pin])) this.focusPin();
        break;
      case 'pin-focus':
        if (!this.pick([this.pin])) this.returnPin();
        break;
      case 'letter-ready':
        if (this.pick([this.letter])) this.focusLetter();
        break;
      case 'flash-ready':
        if (this.pick([this.flash])) this.activateFlash();
        break;
      case 'flash-active': {
        const onLetter = this.pick(this.letter.userData.panels);
        if (onLetter) return;
        if (this.revealed) this.finishInspection();
        else this.setCaption('Look closer · <b>light up the bottom of the letter</b>');
        break;
      }
      default:
    }
  }

  applySpin() {
    const up = new V3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const right = new V3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const q1 = new THREE.Quaternion().setFromAxisAngle(up, this.spin.x);
    const q2 = new THREE.Quaternion().setFromAxisAngle(right, this.spin.y);
    this.pin.quaternion.premultiply(q1).premultiply(q2);
  }

  // ------------------------------------------------------------------ frame
  update(dt, t) {
    this.time += dt;
    this.frame++;
    const T = this.time;

    // camera (+ a touch of parallax while idle)
    this.parallax.lerp(this.mouse, 0.04);
    const px = this.parallax.x * 0.025 * this.parallaxAmt;
    const py = this.parallax.y * 0.015 * this.parallaxAmt;
    // on narrow screens the camera pulls back along its view line so the box still fits
    const k = this.pull || 1;
    this.camera.position.set(this.camPos.x + px, this.camPos.y + py, this.camPos.z).sub(this.camLook).multiplyScalar(k).add(this.camLook);
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld();

    // hint hand follows the box on screen
    if (this.state === 'intro' || this.hint.classList.contains('is-on')) {
      const p = new V3(0, 0.085, 0).project(this.camera);
      this.hint.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
      this.hint.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    }

    // highlight pulse on whichever object is "next"
    const ready = { 'pin-ready': 'pin', 'letter-ready': 'letter', 'flash-ready': 'flash' }[this.state];
    const pulse = 0.5 + 0.5 * Math.sin(T * 2.6);
    for (const k of ['pin', 'letter', 'flash']) {
      const on = k === ready;
      const h = this.halos[k];
      h.material.opacity += ((on ? 0.28 + 0.32 * pulse : 0) - h.material.opacity) * 0.08;
      const gain = this[k].userData.glowGain || 1;
      for (const m of this[k].userData.glowMats) {
        m.emissiveIntensity += ((on ? (0.05 + 0.09 * pulse) * gain : 0) - m.emissiveIntensity) * 0.1;
      }
    }

    // hover cursor
    if (this.state !== 'flash-active' && !this.drag && this.frame % 3 === 0) {
      const target = { intro: this.boxRoot, 'pin-ready': this.pin, 'letter-ready': this.letter, 'flash-ready': this.flash }[this.state];
      if (this.state === 'pin-focus') this.canvas.style.cursor = this.pick([this.pin]) ? 'grab' : 'zoom-out';
      else this.canvas.style.cursor = target && this.pick([target]) ? 'pointer' : '';
    }

    // pin: inertia + gentle float while focused
    if (this.state === 'pin-focus') {
      if (!this.drag) {
        this.spin.multiplyScalar(0.93);
        if (this.spin.lengthSq() > 1e-7) this.applySpin();
      }
      this.pin.position.copy(this.pinBase).addScaledVector(new V3(0, 1, 0).applyQuaternion(this.camera.quaternion), Math.sin(T * 1.6) * 0.0012);
    }

    // flashlight following the mouse + UV light
    if (this.state === 'flash-active') {
      const f = this.followTarget();
      this.flashFollow.pos.lerp(f.pos, 0.22);
      this.flashFollow.target.lerp(f.target, 0.25);
      this.flash.position.copy(this.flashFollow.pos);
      this.flash.quaternion.slerp(f.quat, 0.25);
      const lit = !!f.hit;
      this.uniforms.uLightOn.value += ((lit ? 1 : 0) - this.uniforms.uLightOn.value) * 0.2;
      if (lit) {
        this.uniforms.uLight.value.lerp(f.hit.uv, 0.35);
        this.paintReveal(this.uniforms.uLight.value);
      }
      if (this.frame % 12 === 0) this.measureReveal();
    }
    this.fadeReveal();

    // beam + violet spot
    const uv = this.uvOn.v;
    this.beam.visible = uv > 0.01;
    if (this.beam.visible) {
      const tip = this.flash.localToWorld(this.flash.userData.tip.clone());
      const tgt = this.flashFollow.target;
      this.beam.position.copy(tip);
      this.beam.lookAt(tgt);
      const len = tip.distanceTo(tgt);
      this.beam.scale.set(0.55, 0.55, len);
      this.beam.material.uniforms.uOpacity.value = uv * (0.75 + 0.1 * Math.sin(T * 20));
      this.uvSpot.position.copy(tip);
      this.uvSpot.target.position.copy(tgt);
    }
    this.uvSpot.intensity = uv * 0.9;

    // dust drift
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = this.dustSeed[i];
      let y = pos.getY(i) + dt * 0.006 * (0.5 + (s % 1));
      if (y > 0.95) y = 0.02;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(T * 0.3 + s) * 0.00004);
    }
    pos.needsUpdate = true;

    this.dimMat.opacity = this.dim.v;

    // keep the letter's exposure constant wherever it is held (the lamp falls off with distance)
    const dl = this.spot.position.distanceTo(this.letter.getWorldPosition(this._lp || (this._lp = new V3())));
    const expo = THREE.MathUtils.clamp((dl / 0.86) ** 2, 0.3, 1) * 0.456; // 0.456 = linear 0xb4
    for (const m of this.letter.userData.glowMats) m.color.setScalar(expo);
  }

  paintReveal(uv) {
    const c = this.revealCanvas;
    const g = this.revealCtx;
    const x = uv.x * c.width;
    const y = (1 - uv.y) * c.height;
    const r = this.uniforms.uRadius.value * c.height * 0.85;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    this.revealDirty = true;
  }

  fadeReveal() {
    if (this.frame % 4 !== 0) return;
    const g = this.revealCtx;
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.018)';
    g.fillRect(0, 0, this.revealCanvas.width, this.revealCanvas.height);
    g.globalCompositeOperation = 'source-over';
    this.revealTex.needsUpdate = true;
  }

  measureReveal() {
    if (this.revealed) return;
    const c = this.revealCanvas;
    const d = this.revealCtx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < this.maskAlpha.length; i++) {
      const m = this.maskAlpha[i];
      if (m > 0) lit += m * Math.min(1, (d[i * 4 + 3] / 255) * 1.6);
    }
    // the light circle itself counts too
    if (lit / this.maskTotal > 0.42) {
      this.revealed = true;
      audio.blip('up');
      this.setCaption('Remember it · <b>click outside the letter</b> to put everything back');
    }
  }

  render(renderer) {
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.setClearColor(0x0a0505, 1);
    renderer.clear();
    this.camera.layers.set(0);
    renderer.render(this.scene, this.camera);
    if (this.dimMat.opacity > 0.001) renderer.render(this.dimScene, this.dimCam);
    renderer.clearDepth();
    this.camera.layers.set(1);
    renderer.render(this.scene, this.camera);
    this.camera.layers.set(0);
  }

  resize(w, h) {
    const a = w / h;
    this.camera.aspect = a;
    // narrow screens: open the lens up to 62° and step back for the rest, so the box keeps its width
    const need = (Math.tan(THREE.MathUtils.degToRad(17.5)) * 1.25) / a;
    if (a < 1.25) {
      const fov = Math.min(62, THREE.MathUtils.radToDeg(2 * Math.atan(need)));
      this.camera.fov = fov;
      this.pull = need / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    } else {
      this.camera.fov = 35;
      this.pull = 1;
    }
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    this.canvas.style.cursor = '';
    clearTimeout(this._capT);
    clearTimeout(this._hintT);
    gsap.killTweensOf([this.camPos, this.camLook, this.dim, this.uvOn, this.spot, this]);
    const r = gl.renderer;
    r.autoClear = true;
    r.shadowMap.autoUpdate = true;
    r.setClearColor(0x000000, 1);
    const keep = new Set(Object.values(cache.textures));
    disposeTree(this.scene, keep);
    disposeTree(this.dimScene);
    this.revealTex.dispose();
  }
}
