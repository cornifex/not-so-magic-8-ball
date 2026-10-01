const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");

export function reducedMotion() {
  return reducedMotionQuery.matches;
}

// The shake always lasts at least this long, so a quick answer (Jev takes
// 70–500ms, the classic ball none) still gets its moment of suspense.
export const MIN_SUSPENSE_MS = 1300;

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
