// ---------------------------------------------------------------------------
// Audio system
//  · background music: one looping <audio> element that never restarts between
//    scenes. Muting fades it out/in instead of stopping it.
//  · sound effects: playSfx() returns a promise that resolves when the clip ends,
//    so cinematic sequences can wait for the knock / door sounds.
//  · autoplay: we try to start the music as soon as possible; if the browser
//    blocks it we start it on the very first click / key press instead.
// ---------------------------------------------------------------------------

const SFX = {
  knock: '/audio/door-knoc.mp3',
  door: '/audio/open-door.mp3',
  welcome: '/audio/welcome.mp3',
};

const MUSIC_SRC = '/audio/musica-fondo.mp3';
const MUSIC_VOLUME = 0.42;

class AudioSystem {
  constructor() {
    this.music = new Audio(MUSIC_SRC);
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = 0;
    this.muted = false;
    this.wantsMusic = false;
    this.sfx = {};
    for (const [k, src] of Object.entries(SFX)) {
      const a = new Audio(src);
      a.preload = 'auto';
      this.sfx[k] = a;
    }
    this.ctx = null; // WebAudio context for tiny synthesized UI sounds
    this.listeners = new Set();
    this._fadeRaf = 0;

    const unlock = () => {
      this._ensureCtx();
      if (this.wantsMusic) this._play();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  /** Preload sound-effect clips (music streams). Resolves even if a clip fails. */
  preload(onEach) {
    // Browsers often refuse to fully buffer <audio> before a user gesture, so the
    // clips are fetched into memory and played from blob URLs (instant playback).
    return Promise.all(
      Object.entries(SFX).map(([k, src]) =>
        fetch(src)
          .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
          .then((b) => {
            const a = this.sfx[k];
            a.src = URL.createObjectURL(b);
            a.load();
          })
          .catch((e) => console.warn('[audio] could not preload', src, e))
          .finally(() => onEach?.()),
      ),
    );
  }

  /** Ask for the background music. Safe to call many times. */
  startMusic() {
    this.wantsMusic = true;
    this._play();
  }

  _play() {
    if (this.muted) return;
    if (!this.music.paused) { this._fadeTo(MUSIC_VOLUME); return; }
    const p = this.music.play();
    if (p && p.catch) {
      p.then(() => this._fadeTo(MUSIC_VOLUME, 2200)).catch(() => {
        /* blocked by autoplay policy — the next user gesture will retry */
      });
    }
  }

  _fadeTo(target, ms = 600) {
    cancelAnimationFrame(this._fadeRaf);
    const from = this.music.volume;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      this.music.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) this._fadeRaf = requestAnimationFrame(step);
      else if (target === 0 && this.muted) this.music.pause();
    };
    this._fadeRaf = requestAnimationFrame(step);
  }

  setMuted(m) {
    this.muted = m;
    if (m) this._fadeTo(0, 450);
    else if (this.wantsMusic) this._play();
    this.listeners.forEach((fn) => fn(m));
  }

  toggleMute() { this.setMuted(!this.muted); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Duck the music under a sound effect. */
  duck(amount = 0.45, ms = 400) {
    if (!this.muted && !this.music.paused) this._fadeTo(MUSIC_VOLUME * amount, ms);
  }
  unduck(ms = 1200) {
    if (!this.muted && this.wantsMusic) this._fadeTo(MUSIC_VOLUME, ms);
  }

  /**
   * Plays a sound effect and resolves when it has finished.
   * A safety timeout guarantees the experience never gets stuck if audio fails.
   */
  playSfx(name, { volume = 1, maxWait = 8000 } = {}) {
    const a = this.sfx[name];
    if (!a) return Promise.resolve();
    return new Promise((resolve) => {
      let finished = false;
      const done = () => { if (finished) return; finished = true; a.removeEventListener('ended', done); clearTimeout(timer); resolve(); };
      const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 + 250 : maxWait;
      const timer = setTimeout(done, Math.min(dur, maxWait));
      a.addEventListener('ended', done);
      try {
        a.pause();
        a.currentTime = 0;
        a.volume = volume;
        const p = a.play();
        if (p && p.catch) p.catch(() => setTimeout(done, 1200)); // blocked → just wait a beat
      } catch { setTimeout(done, 1200); }
    });
  }

  _ensureCtx() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    return this.ctx;
  }

  /** Small synthesized interaction sounds (paper, click, lift) — no extra files needed. */
  blip(type = 'soft') {
    const ctx = this._ensureCtx();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.connect(ctx.destination);
    if (type === 'paper' || type === 'lid') {
      const len = type === 'lid' ? 0.55 : 0.35;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = type === 'lid' ? 900 : 2600;
      f.Q.value = 0.7;
      src.connect(f).connect(out);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(type === 'lid' ? 0.22 : 0.12, t + 0.04);
      out.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.start(t);
    } else {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = type === 'uv' ? 180 : type === 'up' ? 520 : 660;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(type === 'up' ? f0 * 1.5 : f0 * 0.75, t + 0.18);
      o.connect(out);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(type === 'uv' ? 0.06 : 0.05, t + 0.015);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.start(t);
      o.stop(t + 0.3);
    }
  }
}

export const audio = new AudioSystem();
