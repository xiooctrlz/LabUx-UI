import gsap from 'gsap';
import { html } from '../core/director.js';
import { audio } from '../core/audio.js';
import { fromBlack, fadeOut } from '../core/curtain.js';

// SCENE 01 — Landing: logo + one button, perfectly centred.
export function landing({ director, stage }) {
  let root;
  let tl;
  return {
    async enter() {
      root = html(`
        <section class="scene landing grain">
          <span class="mark mark--symbol landing__trace" aria-hidden="true"></span>
          <div class="landing__center">
            <h1 class="mark mark--lockup landing__lockup" role="img" aria-label="THE CIRCLE"></h1>
            <button class="btn landing__cta" type="button">
              Discover what's waiting for you
              <svg class="arrow" viewBox="0 0 18 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1 5h15M12 1l4 4-4 4"/></svg>
            </button>
          </div>
          <p class="landing__foot">São Paulo · 2050</p>
        </section>`);
      stage.appendChild(root);
      const lockup = root.querySelector('.landing__lockup');
      const btn = root.querySelector('.landing__cta');
      const foot = root.querySelector('.landing__foot');
      gsap.set([lockup, btn, foot], { opacity: 0 });
      fromBlack(1.1);
      tl = gsap.timeline({ delay: 0.25 })
        .fromTo(lockup, { opacity: 0, y: 14, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'expo.out' })
        .fromTo(btn, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, '-=0.8')
        .to(foot, { opacity: 1, duration: 1.2 }, '-=0.5');

      btn.addEventListener('click', () => {
        audio.startMusic(); // user gesture → music is allowed to start here
        audio.blip('soft');
        btn.disabled = true;
        director.go('form');
      }, { once: true });
    },
    async exit() {
      tl?.kill();
      await fadeOut(root, 0.6);
      root.remove();
    },
  };
}
