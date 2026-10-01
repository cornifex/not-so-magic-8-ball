// Randomness: the classic ball's answer, a make-your-own pick when Jev is
// unavailable, and which of several matching faces rises.

export function randomIndex(length) {
  return Math.floor(Math.random() * length);
}

export function pickOne(list) {
  return list?.[randomIndex(list.length)];
}
