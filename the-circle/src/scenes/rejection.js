import gsap from 'gsap';
import { html } from '../core/director.js';
import { fromBlack, setBlack, fadeOut } from '../core/curtain.js';

// REJECTION — shared by the form (not selected) and the peephole (wrong password).
// The X in the top-left corner resets the whole experience.
export function rejection({ director, stage }) {
  let root;
  let tl;
  return {
    async enter() {
      root = html(`
        <section class="scene reject grain">
          <button class="corner-btn" type="button" aria-label="Close and return to the beginning">
            <svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
          <div class="reject__figure" aria-hidden="true">
            <img class="reject__body" src="/images/fainted-body.png" alt="" />
            <img class="reject__head" src="/images/fainted-head.png" alt="" />
            <div class="reject__stars"><span></span><span></span><span></span></div>
          </div>
          <h2>Your path ends here.<br/>For now.</h2>
          <span class="mark mark--lockup reject__lockup" role="img" aria-label="THE CIRCLE"></span>
        </section>`);
      stage.appendChild(root);
      const curtainUp = getComputedStyle(document.getElementById('curtain')).opacity > 0.5;
      if (curtainUp) fromBlack(1.2);
      else setBlack(false);

      tl = gsap.timeline()
        .fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.out' })
        .fromTo(root.querySelector('.reject__figure'), { y: -60, rotate: -8, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, duration: 1.1, ease: 'bounce.out' }, 0.2)
        .fromTo(root.querySelector('h2'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' }, 0.75)
        .fromTo(root.querySelector('.reject__lockup'), { opacity: 0 }, { opacity: 1, duration: 0.9 }, 1.1)
        .fromTo(root.querySelector('.corner-btn'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.2);

      root.querySelector('.corner-btn').addEventListener('click', () => director.go('landing', { reset: true }), { once: true });
    },
    async exit() {
      tl?.kill();
      await fadeOut(root, 0.6);
      root.remove();
    },
  };
}
