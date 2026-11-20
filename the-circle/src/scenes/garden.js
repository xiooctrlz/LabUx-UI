import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { html } from '../core/director.js';
import { gl, disposeTree } from '../core/gl.js';
import { audio } from '../core/audio.js';
import { cache } from '../core/assets.js';
import { fromBlack, toBlack, setBlack, wait } from '../core/curtain.js';
import { buildGarden, animatePeople, wind } from '../three/gardenWorld.js';
import { buildKeeper } from '../three/keeper.js';
import { device } from '../core/device.js';

// SCENE 07 — The encounter: entering the hidden garden and meeting a Keeper.
export function garden({ director, stage }) {
  let view;
  let ui;
  let alive = true;
  return {
    async enter() {
      setBlack(true);
      ui = html(`
        <section class="scene scene--passthrough inv-ui">
          <div class="vignette vignette--soft"></div>
          <div class="welcome" aria-live="polite"></div>
        </section>`);
      stage.appendChild(ui);
      // give the black frame a moment to paint before the heavy build
      await wait(0.05);
      view = new GardenView(ui);
      gl.setView(view);
      view.warmup();

      // a short pause, the door opens, the darkness lifts
      await wait(0.5);
      if (!alive) return;
      audio.duck(0.4);
      const door = audio.playSfx('door');
      await wait(0.9);
      if (!alive) return;
      view.playCamera();
      await fromBlack(2.6, 'power2.inOut');
      await door;
      audio.unduck(2000);

      await view.cameraDone;
      if (!alive) return;
      await view.keeperEnters();
      if (!alive) return;
      await wait(3.8);
      if (!alive) return;
      await toBlack(2.2);
      director.go('final');
    },
    async exit() {
      alive = false;
      gl.setView(null);
      view?.dispose();
      ui?.remove();
    },
  };
}

class GardenView {
  constructor(ui) {
    this.ui = ui;
    this.welcomeEl = ui.querySelector('.welcome');
    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.FogExp2(0x2a1c2a, 0.021);
    scene.background = new THREE.Color(0x120c18);

    const camera = (this.camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 400));
    this.camPos = new THREE.Vector3(0, 1.62, 18.5);
    this.look = new THREE.Vector3(0, 2.7, 0);
    camera.position.copy(this.camPos);
    camera.lookAt(this.look);

    // moonlight (cool) + sky fill; warm light comes from the bulbs and candles
    const moon = new THREE.DirectionalLight(0x9fb2ff, 0.9);
    moon.position.set(-14, 22, -10);
    moon.castShadow = true;
    this.low = device.lowPower;
    moon.shadow.mapSize.set(this.low ? 1024 : 2048, this.low ? 1024 : 2048);
    // shadows are refreshed every other frame (people and wind move slowly)
    moon.shadow.autoUpdate = false;
    this.moon = moon;
    const sc = moon.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 70;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.03;
    scene.add(moon);
    scene.add(new THREE.HemisphereLight(0x5a5a8c, 0x2a1a12, 0.75));
    const warmKey = new THREE.SpotLight(0xffb27a, 18, 30, 0.7, 0.9, 1.4);
    warmKey.position.set(3, 7, 9);
    warmKey.target.position.set(0, 1.5, 0);
    scene.add(warmKey, warmKey.target);

    this.world = buildGarden(scene, { low: this.low });

    // the Keeper waits off-screen on the left
    this.keeper = buildKeeper();
    this.keeper.root.position.set(-6.2, 0, 5.3);
    this.keeper.root.rotation.y = Math.PI / 2;
    scene.add(this.keeper.root);
    // a warm key and a cool rim travel with the Keeper so the suit and head read clearly
    const kKey = new THREE.PointLight(0xffc896, 11, 7, 1.6);
    kKey.position.set(1.3, 2.3, 1.8);
    const kRim = new THREE.PointLight(0xb7a8ff, 7, 6, 1.6);
    kRim.position.set(-0.6, 2.4, -1.4);
    this.keeper.root.add(kKey, kRim);

    // post-processing: gentle bloom for bulbs, candles and fireflies
    const r = gl.renderer;
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 0.82);
    this.bloom.enabled = !this.low;
    this.composer.addPass(this.bloom);
    // render the garden at a modest pixel ratio: it is the heaviest scene
    this.prevRatio = r.getPixelRatio();
    r.setPixelRatio(Math.min(devicePixelRatio, this.low ? 1 : 1.25));
    r.setSize(innerWidth, innerHeight);
    this.composer.addPass(new OutputPass());

    this.t = 0;
    this.handheld = 1;
    this.cameraDone = new Promise((res) => { this._camRes = res; });
  }

  warmup() {
    gl.renderer.compile(this.scene, this.camera);
  }

  /** dolly in → look left → look right → back to the tree */
  playCamera() {
    const P = this.camPos;
    const L = this.look;
    this.camTl = gsap.timeline({ onComplete: () => this._camRes() })
      .to(P, { z: 11.2, y: 1.66, duration: 5.2, ease: 'power1.inOut' }, 0)
      .to(L, { y: 2.9, duration: 5.2, ease: 'power1.inOut' }, 0)
      .to(L, { x: -10, y: 2.0, z: 6.5, duration: 2.6, ease: 'sine.inOut' }, 4.3)
      .to(P, { x: -0.25, duration: 2.6, ease: 'sine.inOut' }, 4.3)
      .to(L, { x: 10, y: 2.0, z: 6, duration: 3.4, ease: 'sine.inOut' }, 7.2)
      .to(P, { x: 0.25, duration: 3.4, ease: 'sine.inOut' }, 7.2)
      .to(L, { x: 0, y: 2.95, z: 0, duration: 2.4, ease: 'sine.inOut' }, 10.8)
      .to(P, { x: 0, duration: 2.4, ease: 'sine.inOut' }, 10.8);
  }

  async keeperEnters() {
    const k = this.keeper;
    const root = k.root;
    // walk in from the left, stop clearly visible, turn to the visitor
    gsap.to(k, { walking: 1, duration: 0.4 });
    // phones: the Keeper stops nearer and more central so he reads on a narrow screen
    const end = this.camera.aspect < 1 ? { x: -0.75, z: 8.8 } : { x: -2.0, z: 5.5 };
    if (this.camera.aspect < 1) root.position.set(-4.2, 0, 8.6);
    await gsap.to(root.position, { ...end, duration: 2.8, ease: 'power1.out' });
    gsap.to(k, { walking: 0, duration: 0.45, ease: 'power2.out' });
    const face = Math.atan2(this.camPos.x - root.position.x, this.camPos.z - root.position.z);
    await gsap.to(root.rotation, { y: face, duration: 0.8, ease: 'power2.inOut' });
    gsap.to(k, { wave: 1, duration: 0.9, ease: 'back.out(1.6)' });
    await wait(0.25);
    this.showWelcome();
    audio.playSfx('welcome', { volume: 1 });
  }

  showWelcome() {
    const el = this.welcomeEl;
    el.innerHTML = 'WELCOME.'.split('').map((ch) => `<span>${ch}</span>`).join('');
    this.placeWelcome();
    gsap.to(el.children, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.06, ease: 'expo.out' });
  }

  placeWelcome() {
    // anchor the word just to the right of the Keeper's head
    const p = new THREE.Vector3();
    this.keeper.head.getWorldPosition(p);
    p.project(this.camera);
    const x = (p.x * 0.5 + 0.5) * innerWidth;
    const y = (-p.y * 0.5 + 0.5) * innerHeight;
    // phones: the word sits centred above the scene; wide screens: beside the Keeper's head
    const stacked = this.camera.aspect < 1;
    this.welcomeEl.classList.toggle('welcome--stacked', stacked);
    if (stacked) { this.welcomeEl.style.left = ''; this.welcomeEl.style.top = ''; return; }
    this.welcomeEl.style.left = `${x + innerWidth * 0.06}px`;
    this.welcomeEl.style.top = `${y}px`;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    wind.uTime.value = t;

    // subtle handheld breathing on top of the authored camera path
    const hx = Math.sin(t * 0.7) * 0.025 + Math.sin(t * 1.3) * 0.01;
    const hy = Math.sin(t * 0.9 + 1) * 0.018;
    this.camera.position.set(this.camPos.x + hx, this.camPos.y + hy, this.camPos.z);
    // phones: step back a little along the view line (a wider lens does the rest, see resize)
    if (this.pull > 1) this.camera.position.sub(this.look).multiplyScalar(this.pull).add(this.look);
    this.camera.lookAt(this.look.x + hx * 0.5, this.look.y + hy * 0.5, this.look.z);

    animatePeople(this.world.people, t);
    this.keeper.update(dt, this.camera.position);
    for (const g of this.world.glows) g.material.opacity = 0.7 + Math.sin(t * 9 + g.id) * 0.08 + Math.sin(t * 13.3 + g.id) * 0.05;
    for (const b of this.world.city.userData.beacons) b.material.opacity = 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.5 + b.userData.phase));
    if (this.welcomeEl.children.length) this.placeWelcome();
  }

  render() {
    this.frame = (this.frame || 0) + 1;
    if (this.frame % 2 === 1) this.moon.shadow.needsUpdate = true;
    this.composer.render();
  }

  resize(w, h) {
    const a = w / h;
    this.camera.aspect = a;
    // keep a similar horizontal field on narrow screens without an extreme lens
    const tan24 = Math.tan(THREE.MathUtils.degToRad(24));
    this.camera.fov = a < 1.25 ? Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan((tan24 * 1.25) / a))) : 48;
    this.pull = a < 1.25 ? Math.min(1.3, 1 + (1.25 - a) * 0.4) : 1;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  }

  dispose() {
    this.camTl?.kill();
    gsap.killTweensOf([this.camPos, this.look, this.keeper, this.keeper.root.position, this.keeper.root.rotation]);
    const keep = new Set(Object.values(cache.textures));
    disposeTree(this.scene, keep);
    this.composer.dispose();
    gl.renderer.setPixelRatio(this.prevRatio);
    gl.renderer.setSize(innerWidth, innerHeight);
    this.bloom.dispose();
  }
}
