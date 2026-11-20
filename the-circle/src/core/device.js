// Device hints used to adapt framing and rendering cost.
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export const device = {
  /** touch screen (phone / tablet) */
  touch: coarse,
  /** phones, small tablets and low-core machines get the lighter garden */
  get lowPower() {
    return coarse || Math.min(innerWidth, innerHeight) < 600 || (navigator.hardwareConcurrency || 8) <= 4;
  },
  get portrait() { return innerHeight > innerWidth; },
  get aspect() { return innerWidth / innerHeight; },
};
