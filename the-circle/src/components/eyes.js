import gsap from 'gsap';

// Peephole eyes, redrawn as SVG from the "elementos de la experiencia" artboard
// so the pupils can follow the cursor, blink and get annoyed.
const W = 290;
const H = 80;
const LID_Y = 14; // flat upper edge of each eye
const RX = 43; // half width of an eye
const RY = 54; // depth of the eye bowl
const EYES = [
  { id: 'L', cx: 80 },
  { id: 'R', cx: 206 },
];

export function createEyes() {
  const ns = 'http://www.w3.org/2000/svg';
  const uid = Math.random().toString(36).slice(2, 7);
  const bowl = (cx) => `M ${cx - RX} ${LID_Y} A ${RX} ${RY} 0 0 0 ${cx + RX} ${LID_Y} Z`;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = `
    <defs>
      ${EYES.map((e) => `<clipPath id="clip${e.id}${uid}"><path d="${bowl(e.cx)}"/></clipPath>`).join('')}
    </defs>
    ${EYES.map((e) => `
      <g class="eye" data-eye="${e.id}">
        <path d="${bowl(e.cx)}" fill="#fff"/>
        <g clip-path="url(#clip${e.id}${uid})">
          <g class="pupil"><circle cx="${e.cx}" cy="${LID_Y + 15}" r="17.5" fill="#120607"/><circle cx="${e.cx + 6}" cy="${LID_Y + 9}" r="3.6" fill="#fff"/></g>
          <g class="lid">
            <rect x="${e.cx - RX - 6}" y="-80" width="${RX * 2 + 12}" height="${80 + LID_Y}" fill="#f7f4ec"/>
            <line x1="${e.cx - RX - 6}" y1="${LID_Y}" x2="${e.cx + RX + 6}" y2="${LID_Y}" stroke="#120607" stroke-width="9"/>
          </g>
        </g>
        <path d="${bowl(e.cx)}" fill="none" stroke="#120607" stroke-width="9" stroke-linejoin="round"/>
      </g>`).join('')}
  `;

  const eyes = EYES.map((e) => {
    const g = svg.querySelector(`[data-eye="${e.id}"]`);
    return { ...e, pupil: g.querySelector('.pupil'), lid: g.querySelector('.lid'), cur: { x: 0, y: 0 }, tgt: { x: 0, y: 0 } };
  });

  let mood = 'idle';
  let raf = 0;
  let blinkTimer = 0;
  let mouse = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
  const onMove = (ev) => { mouse = { x: ev.clientX, y: ev.clientY }; };
  window.addEventListener('pointermove', onMove);

  for (const e of eyes) {
    gsap.set(e.lid, { svgOrigin: `${e.cx} ${LID_Y}`, y: 0, rotation: 0 });
  }

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const s = r.width / W;
    for (const e of eyes) {
      if (mood === 'idle') {
        const ex = r.left + e.cx * s;
        const ey = r.top + (LID_Y + 18) * s;
        const dx = mouse.x - ex;
        const dy = mouse.y - ey;
        const k = 1 / Math.max(1, Math.hypot(dx, dy) / 420);
        e.tgt.x = Math.max(-1, Math.min(1, (dx / 420) * (k < 1 ? 1 : 1))) * 21;
        e.tgt.y = Math.max(-0.4, Math.min(1, dy / 320)) * 15;
      }
      e.cur.x += (e.tgt.x - e.cur.x) * 0.12;
      e.cur.y += (e.tgt.y - e.cur.y) * 0.12;
      e.pupil.setAttribute('transform', `translate(${e.cur.x.toFixed(2)} ${e.cur.y.toFixed(2)})`);
    }
  };
  raf = requestAnimationFrame(loop);

  const blink = () => {
    if (mood !== 'idle') return;
    const lids = eyes.map((e) => e.lid);
    gsap.timeline()
      .to(lids, { y: RY + 4, duration: 0.09, ease: 'power2.in' })
      .to(lids, { y: 0, duration: 0.16, ease: 'power2.out' });
  };
  const scheduleBlink = () => {
    blinkTimer = setTimeout(() => {
      blink();
      if (Math.random() < 0.25) setTimeout(blink, 300);
      scheduleBlink();
    }, 1800 + Math.random() * 2800);
  };
  scheduleBlink();

  return {
    el: svg,
    blink,
    /** Lowered, slanted lids and pupils pushed to the side: clearly unimpressed. */
    annoyed() {
      mood = 'annoyed';
      eyes.forEach((e, i) => { e.tgt.x = i === 0 ? 8 : -8; e.tgt.y = 10; });
      return gsap.timeline()
        .to(eyes[0].lid, { y: 20, rotation: 13, duration: 0.35, ease: 'back.out(2)' }, 0)
        .to(eyes[1].lid, { y: 20, rotation: -13, duration: 0.35, ease: 'back.out(2)' }, 0);
    },
    /** Pleased: a slow, satisfied blink. */
    pleased() {
      mood = 'pleased';
      eyes.forEach((e) => { e.tgt.x = 0; e.tgt.y = 4; });
      return gsap.timeline()
        .to(eyes.map((e) => e.lid), { y: 26, duration: 0.4, ease: 'power2.inOut' })
        .to(eyes.map((e) => e.lid), { y: 6, duration: 0.5, ease: 'power2.inOut' }, '+=0.25');
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(blinkTimer);
      window.removeEventListener('pointermove', onMove);
      gsap.killTweensOf(eyes.map((e) => e.lid));
    },
  };
}
