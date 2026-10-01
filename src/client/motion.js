const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");

export function reducedMotion() {
  return reducedMotionQuery.matches;
}
