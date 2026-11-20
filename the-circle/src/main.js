import './style.css';
import { director } from './core/director.js';
import { audio } from './core/audio.js';
import { preloadAll } from './core/assets.js';
import { setBlack } from './core/curtain.js';
import { gl } from './core/gl.js';

import { landing } from './scenes/landing.js';
import { form } from './scenes/form.js';
import { rejection } from './scenes/rejection.js';
import { invitation } from './scenes/invitation.js';
import { decision } from './scenes/decision.js';
import { peephole } from './scenes/peephole.js';
import { garden } from './scenes/garden.js';
import { final } from './scenes/final.js';

director.stage = document.getElementById('stage');
director.register('landing', landing);
director.register('form', form);
director.register('rejection', rejection);
director.register('invitation', invitation); // scenes 03 + 04
director.register('decision', decision);
director.register('peephole', peephole);
director.register('garden', garden); // scene 07
director.register('final', final);

// ---- sound control (upper-right) ----
const toggle = document.getElementById('sound-toggle');
toggle.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.toggleMute();
});
audio.onChange((muted) => {
  toggle.classList.toggle('is-muted', muted);
  toggle.setAttribute('aria-pressed', String(muted));
  toggle.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
});

// ---- boot ----
async function boot() {
  const bar = document.querySelector('.loader__bar span');
  await preloadAll((p) => { bar.style.width = `${Math.round(p * 100)}%`; });
  setBlack(true);
  document.getElementById('loader').classList.add('is-done');

  // Try to start the music right away; if the browser blocks autoplay it
  // starts on the first click (the landing button counts).
  audio.startMusic();

  // Presentation shortcut: ?scene=garden (or invitation, peephole, decision…)
  const jump = new URLSearchParams(location.search).get('scene');
  director.go(jump && director.registry.has(jump) ? jump : 'landing');
}

if (import.meta.env.DEV) {
  window.__circle = { director, gl, audio };
}

boot();
