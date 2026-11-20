import gsap from 'gsap';
import { html } from '../core/director.js';
import { audio } from '../core/audio.js';
import { toBlack, fromBlack, fadeOut } from '../core/curtain.js';
import { QUESTIONS, DEFAULT_ANSWERS, isEligible } from '../config/selection.js';

// SCENE 02 — The selection form. Prefilled with the "accepted" answers; every
// field is editable / clearable so the rejection path can be demonstrated.
export function form({ director, stage }) {
  let root;
  return {
    async enter() {
      const items = QUESTIONS.map((q, i) => `
        <li class="q">
          <span class="q__num">0${i + 1}</span>
          <label for="q${i}">${q}</label>
          <div class="q__field">
            <textarea id="q${i}" name="q${i}" rows="1" spellcheck="false" placeholder="Write your answer…"></textarea>
            <div class="q__tools"><button type="button" class="q__clear" data-i="${i}">Clear</button></div>
          </div>
        </li>`).join('');

      root = html(`
        <section class="scene form-scene grain">
          <span class="mark mark--lockup form-scene__lockup" role="img" aria-label="THE CIRCLE"></span>
          <div class="form-scene__inner">
            <header class="form-intro">
              <h1>Not everything is meant to be <em>found online.</em></h1>
              <p>Four questions. There are no right answers — only honest ones. Someone will read them.</p>
              <p class="form-intro__hand">Take your time.</p>
            </header>
            <form class="form-body" novalidate autocomplete="off">
              <ol class="form-list">${items}</ol>
              <div class="form-actions">
                <button class="btn" type="submit">
                  Submit your answers
                  <svg class="arrow" viewBox="0 0 18 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1 5h15M12 1l4 4-4 4"/></svg>
                </button>
                <span class="form-actions__note">Your answers decide whether the invitation finds you.</span>
              </div>
            </form>
          </div>
        </section>`);
      stage.appendChild(root);

      const areas = [...root.querySelectorAll('textarea')];
      const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
      const syncClear = (i) => { root.querySelector(`.q__clear[data-i="${i}"]`).hidden = areas[i].value.length === 0; };
      areas.forEach((ta, i) => {
        ta.value = DEFAULT_ANSWERS[i];
        ta.addEventListener('input', () => { grow(ta); syncClear(i); });
        requestAnimationFrame(() => grow(ta));
        syncClear(i);
      });
      root.querySelectorAll('.q__clear').forEach((b) => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        areas[i].value = '';
        grow(areas[i]);
        syncClear(i);
        areas[i].focus();
      }));
      window.addEventListener('resize', this._onResize = () => areas.forEach(grow));

      const formEl = root.querySelector('form');
      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formEl.querySelector('button[type=submit]');
        btn.disabled = true;
        audio.blip('up');
        const answers = areas.map((a) => a.value);
        if (isEligible(answers)) {
          // SCENE 03 begins with a deliberate fade to black
          await toBlack();
          director.go('invitation');
        } else {
          director.go('rejection');
        }
      });

      // entrance (lift the curtain if we arrive from a black screen, e.g. ?scene=form)
      if (parseFloat(getComputedStyle(document.getElementById('curtain')).opacity) > 0.5) fromBlack(0.8);
      const intro = root.querySelectorAll('.form-intro > *');
      const qs = root.querySelectorAll('.q, .form-actions');
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' });
      gsap.fromTo(intro, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out', delay: 0.2 });
      gsap.fromTo(qs, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out', delay: 0.45 });
    },
    async exit() {
      window.removeEventListener('resize', this._onResize);
      if (root.isConnected && getComputedStyle(document.getElementById('curtain')).opacity < 0.99) {
        await fadeOut(root, 0.5);
      }
      root.remove();
    },
  };
}
