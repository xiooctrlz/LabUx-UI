import gsap from 'gsap';

// The black curtain sits above every scene. All cinematic fades go through it,
// so timing stays consistent across the whole experience.
const el = () => document.getElementById('curtain');

export const TIMING = {
  fade: 1.7, // seconds — "approximately 1.5–2s"
  quick: 0.7,
};

export const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

/**
 * Await a GSAP tween, but never longer than its duration (+ margin).
 * requestAnimationFrame pauses when the window is hidden; this guarantees the
 * experience keeps moving (the tween is jumped to its end state).
 */
export function settle(tween, extra = 0.35) {
  return Promise.race([
    tween.then ? tween.then(() => {}) : Promise.resolve(),
    wait((tween.totalDuration?.() ?? 0) + (tween.delay?.() ?? 0) + extra).then(() => {
      // only finish it if nothing else has taken over the same element since
      const targets = tween.targets?.() ?? [];
      const stillOwned = targets.length && gsap.getTweensOf(targets).includes(tween);
      if (stillOwned && tween.progress() < 1) tween.progress(1);
    }),
  ]);
}

export function toBlack(duration = TIMING.fade, ease = 'power2.inOut') {
  const c = el();
  c.classList.add('is-blocking');
  return settle(gsap.to(c, { opacity: 1, duration, ease, overwrite: true }));
}

export async function fromBlack(duration = TIMING.fade, ease = 'power2.inOut') {
  const c = el();
  await settle(gsap.to(c, { opacity: 0, duration, ease, overwrite: true }));
  if (parseFloat(c.style.opacity || '0') < 0.05) c.classList.remove('is-blocking');
}

export function setBlack(on) {
  const c = el();
  gsap.killTweensOf(c);
  c.style.opacity = on ? '1' : '0';
  c.classList.toggle('is-blocking', on);
}

/** Fade an element out and resolve reliably. */
export function fadeOut(target, duration = 0.6) {
  return settle(gsap.to(target, { opacity: 0, duration, ease: 'power2.in' }));
}
