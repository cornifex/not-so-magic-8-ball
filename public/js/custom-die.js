// Lays a "make your own" ball's choices out across the 20 faces of the die.
// Choices repeat around the die; two faces are reserved for the honest
// answer when Jev can't separate the choices.

import { FACE_COUNT } from "./d20.js";

export const UNDECIDED_FACES = [4, 14];
const UNDECIDED_LINES = ["TOO", "CLOSE", "TO CALL"];

// Characters per line for 1–4 line layouts. The triangle is narrow at the
// apex, so earlier lines get less room. d20.js shrinks the font if needed.
const LINE_CAPACITY = [[9], [9, 11], [8, 10, 12], [7, 9, 11, 13]];
const LONGEST_WORD = 12;

export function layoutCustomFaces(choices) {
  const wrapped = choices.map(wrapLabel);
  const labels = [];
  const facesByChoice = choices.map(() => []);
  let next = 0;
  for (let face = 0; face < FACE_COUNT; face++) {
    if (UNDECIDED_FACES.includes(face)) {
      labels.push(UNDECIDED_LINES);
      continue;
    }
    labels.push(wrapped[next]);
    facesByChoice[next].push(face);
    next = (next + 1) % choices.length;
  }
  return { labels, facesByChoice };
}

function wrapLabel(text) {
  const words = text
    .toUpperCase()
    .split(" ")
    .flatMap((word) => breakWord(word, LONGEST_WORD));
  for (const capacity of LINE_CAPACITY) {
    const lines = fillLines(words, capacity, false);
    if (lines) return lines;
  }
  return fillLines(words, LINE_CAPACITY.at(-1), true);
}

// Greedy fill; returns null if the words don't fit in these lines, unless
// `force` is set, in which case the overflow piles onto the last line.
function fillLines(words, capacity, force) {
  const lines = [];
  for (const word of words) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= capacity[last]) {
      lines[last] += ` ${word}`;
    } else if (lines.length < capacity.length) {
      lines.push(word);
    } else if (force) {
      lines[last] += ` ${word}`;
    } else {
      return null;
    }
  }
  return lines;
}

// Split an over-long word into even, hyphenated pieces, so a 24-letter word
// becomes three 8-letter lines rather than 11 + 11 + 2.
function breakWord(word, max) {
  if (word.length <= max) return [word];
  const size = Math.ceil(word.length / Math.ceil(word.length / (max - 1)));
  const parts = [];
  for (let i = 0; i < word.length; i += size) {
    parts.push(word.slice(i, i + size));
  }
  return parts.map((part, i) => (i < parts.length - 1 ? `${part}-` : part));
}
