// The ball itself: the "8" side, the window, the liquid, and the die inside.
// The die (d20.js) animates imperatively, so the ball exposes an imperative
// handle through `ref`: shake, flipToWindow, sink, rise, relabel, settle.

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { createD20 } from "./d20.js";
import { reducedMotion } from "./motion.js";

// Bubble x position and size (% of the window), start delay (ms), drift (%).
const BUBBLES = [
  [22, 5, 0, 6],
  [64, 3.5, 180, -8],
  [41, 7, 320, 4],
  [78, 4, 520, -5],
  [30, 3, 700, 9],
  [55, 5.5, 860, -3],
];

// The ball jolts side to side while its surface twists, easing between each
// step like CSS keyframes do.
const SHAKE_EASING = "cubic-bezier(0.36, 0.07, 0.19, 0.97)";
const SHAKE_STEPS = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
const JOLTS = ["0 0", "-3% -1.5%", "4% 1%", "-4% -0.5%", "3% 1%", "-2% 0", "1% 0", "0 0"];
const TWISTS = ["0deg", "-7deg", "8deg", "-6deg", "4deg", "-2deg", "1deg", "0deg"];
const keyframes = (property, values) =>
  values.map((value, i) => ({ [property]: value, offset: SHAKE_STEPS[i], easing: SHAKE_EASING }));
const SHAKE = keyframes("translate", JOLTS);
const TWIST = keyframes("rotate", TWISTS);
const SHAKE_MS = 900;

export function Ball({ ref, initialLabels, onActivate }) {
  const wrapRef = useRef(null);
  const surfaceRef = useRef(null);
  const depthRef = useRef(null);
  const dieRef = useRef(null);
  const sideRef = useRef("eight");
  const flipDoneRef = useRef(null);
  const [side, setSide] = useState("eight");
  const [stirring, setStirring] = useState(false);
  const [labels] = useState(initialLabels);

  useEffect(() => {
    const die = createD20(depthRef.current, labels, { reducedMotion });
    dieRef.current = die;
    return () => die.destroy();
  }, [labels]);

  useImperativeHandle(ref, () => ({
    sink: () => dieRef.current.sink(),
    rise: (face) => dieRef.current.rise(face),
    relabel: (next) => dieRef.current.relabel(next),

    shake() {
      setStirring(true);
      if (reducedMotion()) return;
      wrapRef.current.animate(SHAKE, SHAKE_MS);
      surfaceRef.current.animate(TWIST, SHAKE_MS);
    },

    settle() {
      setStirring(false);
    },

    // Turn the ball over from the "8" to the window (first question only).
    flipToWindow() {
      if (sideRef.current === "window") return Promise.resolve();
      sideRef.current = "window";
      setSide("window");
      if (reducedMotion()) return Promise.resolve();
      return new Promise((resolve) => {
        flipDoneRef.current = resolve;
      });
    },
  }), []);

  // Only the window's own roll-in counts; bubbles inside it animate too.
  function onWindowAnimationEnd(event) {
    if (event.target !== event.currentTarget) return;
    flipDoneRef.current?.();
    flipDoneRef.current = null;
  }

  return (
    <div className="ball-area" aria-hidden="true">
      <div className="ball-shadow" />
      <div className="ball-wrap" ref={wrapRef} onClick={onActivate}>
        <div className={stirring ? "ball stirring" : "ball"} data-side={side}>
          <div className="ball-surface" ref={surfaceRef}>
            <div className="eight"><span>8</span></div>
            <div className="window" onAnimationEnd={onWindowAnimationEnd}>
              <div className="liquid">
                {/* d20.js owns this element's contents, classes, and styles. */}
                <div className="die-depth" ref={depthRef} />
                <div className="bubbles">
                  {BUBBLES.map(([x, size, delay, drift]) => (
                    <i key={x} style={{ "--x": `${x}%`, "--s": `${size}%`, "--d": `${delay}ms`, "--drift": `${drift}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="ball-gloss" />
      </div>
    </div>
  );
}
