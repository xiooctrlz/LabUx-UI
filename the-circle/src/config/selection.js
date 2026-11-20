// ---------------------------------------------------------------------------
// SELECTION CRITERIA  (edit this file to change who gets in)
// ---------------------------------------------------------------------------
// For the academic demo the preloaded answers describe the "accepted" visitor.
// Any modified, deleted or empty answer leads to the rejection screen.
// To change the rule, edit `isEligible()` — it receives the answers array and
// must return true (accepted) or false (rejected).
// ---------------------------------------------------------------------------

export const QUESTIONS = [
  'How often do you make time to meet someone without a specific reason?',
  'When was the last time you discovered something new in your surroundings?',
  'Would you enjoy spending time with people you have never met before?',
  'What do you think we are slowly forgetting in a world that never stops moving?',
];

export const DEFAULT_ANSWERS = [
  'Often. Some of my favourite afternoons started with a coffee, a friend and no plan at all.',
  'Last week. A tiny garden hidden behind a bakery I had walked past for years without ever looking.',
  'Yes. Strangers are just conversations that have not happened yet.',
  'How to be present: to listen, to wait, and to look at each other without a screen in between.',
];

/** The password hidden in the letter (revealed by the UV flashlight). */
export const SECRET_PASSWORD = '123';

const normalize = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Decides whether the visitor is invited.
 * Demo rule: every answer must still match its preloaded default.
 * @param {string[]} answers
 * @returns {boolean}
 */
export function isEligible(answers) {
  return DEFAULT_ANSWERS.every((def, i) => {
    const a = normalize(answers[i]);
    return a.length > 0 && a === normalize(def);
  });
}

export function checkPassword(value) {
  return String(value ?? '').trim() === SECRET_PASSWORD;
}
