import gsap from 'gsap';
import { html } from '../core/director.js';
import { audio } from '../core/audio.js';
import { setBlack, wait, settle, fadeOut } from '../core/curtain.js';
import { createEyes } from '../components/eyes.js';
import { checkPassword } from '../config/selection.js';

// SCENE 06 — the door peephole. Opens left → right, the eyes follow the cursor.
export function peephole({ director, stage }) {
  let root;
  let eyes;
  let tl;
  return {
    async enter() {
      root = html(`
        <section class="scene peep">
          <div class="peep__slot" aria-hidden="true">
            <div class="peep__window"></div>
          </div>
          <form class="peep__form" autocomplete="off" novalidate>
            <label class="peep__label" for="pw">Password?</label>
            <div class="peep__row">
              <input id="pw" class="peep__input" type="text" inputmode="numeric" maxlength="12" spellcheck="false" autocomplete="off" />
              <button class="peep__submit" type="submit" aria-label="Submit password">
                <svg viewBox="0 0 18 18"><path d="M2 9h13M10 4l5 5-5 5"/></svg>
              </button>
            </div>
            <p class="peep__hint">Some truths only reveal themselves under the right light.</p>
          </form>
        </section>`);
      stage.appendChild(root);
      setBlack(false);

      eyes = createEyes();
      const win = root.querySelector('.peep__window');
      win.appendChild(eyes.el);
      const formEl = root.querySelector('.peep__form');
      const input = root.querySelector('#pw');
      const slot = root.querySelector('.peep__slot');
      formEl.style.pointerEvents = 'none';

      tl = gsap.timeline({ delay: 0.35 })
        .fromTo(slot, { opacity: 0 }, { opacity: 1, duration: 0.5 })
        .call(() => audio.blip('lid'))
        .fromTo(win, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut' })
        .fromTo(formEl.children, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out' }, '-=0.3')
        .call(() => { formEl.style.pointerEvents = ''; input.focus({ preventScroll: true }); });

      const closeSlot = () => settle(gsap.to(win, { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.7, ease: 'power3.inOut' }));

      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!input.value.trim()) { formEl.classList.remove('is-shake'); void formEl.offsetWidth; formEl.classList.add('is-shake'); input.focus(); return; }
        formEl.style.pointerEvents = 'none';
        input.blur();
        if (checkPassword(input.value)) {
          await settle(eyes.pleased());
          await closeSlot();
          await fadeOut([formEl, slot], 0.6);
          setBlack(true);
          director.go('garden');
        } else {
          formEl.classList.add('is-shake');
          await settle(eyes.annoyed());
          await wait(0.9);
          await closeSlot();
          await fadeOut([formEl, slot], 0.5);
          director.go('rejection');
        }
      });
    },
    async exit() {
      tl?.kill();
      eyes?.destroy();
      root.remove();
    },
  };
}
