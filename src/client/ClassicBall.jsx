// The classic ball, like the real toy: think of a question, shake, and get
// one of the 20 answers at random. There's no text box, so a random answer
// never lands on a typed question, and nothing is sent anywhere.

import { useRef, useState } from "react";
import { ANSWERS } from "../shared/answers.js";
import { Ball } from "./Ball.jsx";
import { randomIndex } from "./chance.js";
import { MIN_SUSPENSE_MS, wait } from "./motion.js";
import { useMounted } from "./useMounted.js";

const LABELS = ANSWERS.map((answer) => answer.lines);

export function ClassicBall() {
  const ball = useRef(null);
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  async function shake() {
    if (busy) return;
    setBusy(true);
    setAnnouncement("The ball is thinking…");

    ball.current.shake();
    await Promise.all([ball.current.flipToWindow(), ball.current.sink(), wait(MIN_SUSPENSE_MS)]);
    if (!mounted.current) return;
    ball.current.settle();

    const face = randomIndex(ANSWERS.length);
    await ball.current.rise(face);
    if (!mounted.current) return;
    setAnnouncement(`The ball says: ${ANSWERS[face].text}`);
    setBusy(false);
  }

  return (
    <>
      <Ball ref={ball} initialLabels={LABELS} onActivate={shake} />
      <div className="ask ask-classic">
        <p className="ask-prompt">Think of a yes-or-no question, then give the ball a shake.</p>
        <button type="button" className="ask-submit" onClick={shake} aria-disabled={busy}>
          Shake
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
    </>
  );
}
