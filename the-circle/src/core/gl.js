import * as THREE from 'three';

// One WebGL renderer/context for the whole experience. 3D scenes plug into it
// with gl.setView(view) where view = { update(dt, t), render(renderer), resize(w, h) }.
// Only one view renders at a time; when none is active the loop idles.

class GL {
  constructor() {
    this.host = document.getElementById('gl');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.host.appendChild(r.domElement);
    this.canvas = r.domElement;
    this.view = null;
    this.clock = new THREE.Clock();
    this.elapsed = 0;

    window.addEventListener('resize', () => this.resize());
    r.setAnimationLoop(() => this.tick());
  }

  get size() { return { w: window.innerWidth, h: window.innerHeight }; }

  resize() {
    const { w, h } = this.size;
    this.renderer.setSize(w, h);
    this.view?.resize?.(w, h);
  }

  setView(view) {
    this.view = view;
    if (view) {
      this.clock.getDelta();
      view.resize?.(this.size.w, this.size.h);
      this.host.classList.add('is-on');
    } else {
      this.host.classList.remove('is-on');
      this.renderer.clear();
    }
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (!this.view) return;
    this.elapsed += dt;
    this.view.update?.(dt, this.elapsed);
    this.view.render(this.renderer);
  }
}

export const gl = new GL();

/** Recursively free GPU resources of an object tree. Shared textures can be protected. */
export function disposeTree(root, keep = new Set()) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture && !keep.has(v)) v.dispose();
      }
      if (m.uniforms) {
        for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture && !keep.has(u.value)) u.value.dispose();
      }
      m.dispose();
    }
  });
}
