import gsap from 'gsap';
import { html } from '../core/director.js';
import { setBlack, fadeOut } from '../core/curtain.js';

// SCENE 08 — the deliberate ending. Restart icon resets everything.
export function final({ director, stage }) {
  let root;
  let tl;
  return {
    async enter() {
      root = html(`
        <section class="scene final">
          <button class="corner-btn corner-btn--restart" type="button" aria-label="Return to the beginning">
            <svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 3.5v4.6h4.6"/></svg>
            <span class="tip">Return to the beginning</span>
          </button>
          <span class="mark mark--lockup final__lockup" role="img" aria-label="THE CIRCLE"></span>
          <p class="final__tag">Different paths. One connection.</p>
          <p class="final__meta">São Paulo · 2050</p>
        </section>`);
      stage.appendChild(root);
      setBlack(false);
      const btn = root.querySelector('.corner-btn');
      tl = gsap.timeline({ delay: 0.4 })
        .fromTo(root.querySelector('.final__lockup'), { opacity: 0, scale: 0.96, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 2, ease: 'expo.out' })
        .fromTo(root.querySelector('.final__tag'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.4, ease: 'expo.out' }, '-=1.1')
        .fromTo([root.querySelector('.final__meta'), btn], { opacity: 0 }, { opacity: 1, duration: 1.2 }, '-=0.6');
      btn.addEventListener('click', () => director.go('landing', { reset: true }), { once: true });
    },
    async exit() {
      tl?.kill();
      await fadeOut(root, 0.7);
      root.remove();
    },
  };
}
