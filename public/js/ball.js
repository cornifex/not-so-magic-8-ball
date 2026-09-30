// The ball itself: the "8" side, the window, the liquid, and the die inside.
// Both pages build it from here so the markup lives in one place.

import { createD20 } from "./d20.js";

// Bubble x position and size (% of the window), start delay (ms), drift (%).
const BUBBLES = [
  [22, 5, 0, 6],
  [64, 3.5, 180, -8],
  [41, 7, 320, 4],
  [78, 4, 520, -5],
  [30, 3, 700, 9],
  [55, 5.5, 860, -3],
];

const MARKUP = `
  <div class="ball-shadow"></div>
  <div class="ball-wrap">
    <div class="ball" data-side="eight">
      <div class="ball-surface">
        <div class="eight"><span>8</span></div>
        <div class="window">
          <div class="liquid">
            <div class="die-depth"></div>
            <div class="bubbles">
              ${BUBBLES.map(([x, size, delay, drift]) =>
                `<i style="--x: ${x}%; --s: ${size}%; --d: ${delay}ms; --drift: ${drift}%"></i>`).join("")}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="ball-gloss"></div>
  </div>`;

export function createBall(container, labels, { reducedMotion }) {
  container.innerHTML = MARKUP;
  const wrap = container.querySelector(".ball-wrap");
  const ball = container.querySelector(".ball");
  const windowEl = container.querySelector(".window");
  const die = createD20(container.querySelector(".die-depth"), labels, { reducedMotion });

  return {
    element: wrap,
    sink: die.sink,
    rise: die.rise,
    relabel: die.relabel,

    shake() {
      ball.classList.add("stirring");
      if (reducedMotion()) return;
      wrap.classList.remove("shaking");
      void wrap.offsetWidth; // restart the animation
      wrap.classList.add("shaking");
    },

    settle() {
      ball.classList.remove("stirring");
    },

    // Turn the ball over from the "8" to the window (first question only).
    flipToWindow() {
      if (ball.dataset.side === "window") return Promise.resolve();
      ball.dataset.side = "window";
      if (reducedMotion()) return Promise.resolve();
      return new Promise((resolve) => {
        windowEl.addEventListener("animationend", resolve, { once: true });
      });
    },
  };
}
