// ---------------------------------------------------------------------------
// Scene director
// Each scene module exports a factory returning { enter(data), exit() }.
//   enter(data) — builds DOM/3D, starts animations. May be async.
//   exit()      — must remove everything it created (DOM, listeners, GPU memory).
// The director guarantees exit() of the previous scene runs before the next enter().
// ---------------------------------------------------------------------------

class Director {
  constructor() {
    this.registry = new Map();
    this.current = null;
    this.currentName = null;
    this.busy = Promise.resolve();
    this.stage = null;
  }

  register(name, factory) { this.registry.set(name, factory); }

  /** Navigate to a scene. Calls are serialized so overlapping transitions never collide. */
  go(name, data = {}) {
    this.busy = this.busy.then(async () => {
      const factory = this.registry.get(name);
      if (!factory) throw new Error(`Unknown scene: ${name}`);
      const prev = this.current;
      this.current = null;
      if (prev) {
        try { await prev.exit(); } catch (e) { console.error(e); }
      }
      const scene = factory({ director: this, stage: this.stage });
      this.current = scene;
      this.currentName = name;
      document.body.dataset.scene = name;
      // enter() may run a long cinematic; it must never block the next navigation
      Promise.resolve()
        .then(() => scene.enter(data))
        .catch((e) => console.error(`[scene ${name}]`, e));
    });
    return this.busy;
  }
}

export const director = new Director();

/** Helper to build DOM from an HTML string. */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}
