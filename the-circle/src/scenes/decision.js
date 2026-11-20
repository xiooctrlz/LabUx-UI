import gsap from 'gsap';
import { html } from '../core/director.js';
import { audio } from '../core/audio.js';
import { setBlack, wait, settle, fadeOut } from '../core/curtain.js';

// SCENE 05 — "Are you ready to find us?"  YES is emphasised by default.
export function decision({ director, stage }) {
  let root;
  let tl;
  return {
    async enter() {
      root = html(`
        <section class="scene decision">
          <h2>Are you ready<br/>to find us?</h2>
          <div class="decision__choices">
            <button class="choice choice--no" type="button">
              <svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13"/></svg>NO
            </button>
            <button class="choice choice--yes" type="button">
              <svg viewBox="0 0 16 16"><path d="M2.5 8.5l3.5 3.5 7.5-8"/></svg>YES
            </button>
          </div>
        </section>`);
      stage.appendChild(root);
      setBlack(false); // the scene itself is black; lift the curtain instantly
      const h2 = root.querySelector('h2');
      const choices = root.querySelector('.decision__choices');
      const yes = root.querySelector('.choice--yes');
      const no = root.querySelector('.choice--no');
      choices.style.pointerEvents = 'none';
      tl = gsap.timeline({ delay: 0.3 })
        .fromTo(h2, { opacity: 0, y: 20, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'expo.out' })
        .fromTo(choices.children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'expo.out', onComplete: () => { choices.style.pointerEvents = ''; yes.focus({ preventScroll: true }); } }, '-=0.6');

      const out = () => settle(gsap.to([h2, choices], { opacity: 0, y: -10, duration: 0.6, ease: 'power2.in' }));

      yes.addEventListener('click', async () => {
        choices.style.pointerEvents = 'none';
        audio.blip('soft');
        await out();
        // the screen stays black while someone knocks
        audio.duck(0.35);
        await wait(0.5);
        await audio.playSfx('knock');
        audio.unduck();
        director.go('peephole');
      });

      no.addEventListener('click', async () => {
        choices.style.pointerEvents = 'none';
        await out();
        const later = html(`<p class="decision__later">Then we'll wait. The circle isn't going anywhere.</p>`);
        root.appendChild(later);
        await settle(gsap.fromTo(later, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out' }));
        await wait(2.2);
        await fadeOut(later, 0.8);
        director.go('final', { declined: true });
      });
    },
    async exit() {
      tl?.kill();
      root.remove();
    },
  };
}
