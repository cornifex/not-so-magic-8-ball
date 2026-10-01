// One ball and its question form. `mode` is "classic" (the 20 standard
// answers) or "custom" (the visitor's own choices).

import { useEffect, useRef, useState } from "react";
import { ANSWERS } from "../shared/answers.js";
import { MAX_QUESTION_LENGTH, validateChoices, validateQuestion } from "../shared/validation.js";
import { postQuestion } from "./api.js";
import { Ball } from "./Ball.jsx";
import { ChoicesEditor, useSavedChoices } from "./ChoicesEditor.jsx";
import { layoutCustomFaces, UNDECIDED_FACES } from "./custom-die.js";
import { useHumanCheck } from "./human-check.js";

// The shake always lasts at least this long, so Jev's response time
// (70–500ms) hides inside the suspense instead of being felt as lag.
const MIN_SUSPENSE_MS = 1300;
const NEAR_LIMIT = MAX_QUESTION_LENGTH - 10;
const EXAMPLE_CHOICES = ["Chili", "Ramen"];
const CLASSIC_LABELS = ANSWERS.map((answer) => answer.lines);
const ASK_AGAIN_LATER = ANSWERS.findIndex((answer) => answer.id === "ask_again_later");

const COPY = {
  classic: { placeholder: "Should I learn the banjo?", hint: "Yes-or-no questions work best." },
  custom: { placeholder: "What should I cook tonight?", hint: "Add context: Jev can only weigh what you tell it." },
};

const SUPPORT_TEXT =
  "It sounds like you might be going through something really hard. In the US, you can call or text 988 to reach the Suicide & Crisis Lifeline, any time of day. Elsewhere, findahelpline.com lists free, confidential support near you.";

export function EightBall({ mode }) {
  const custom = mode === "custom";
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useSavedChoices();
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(null);
  const [notice, setNotice] = useState("");
  const [support, setSupport] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // The die starts labelled with the saved choices, or examples if there are none.
  const [initialLayout] = useState(() => {
    if (!custom) return null;
    const saved = validateChoices(choices);
    return layoutCustomFaces(saved.ok ? saved.choices : EXAMPLE_CHOICES);
  });
  const layout = useRef(initialLayout);

  const ball = useRef(null);
  const form = useRef(null);
  const input = useRef(null);
  const choicesEditor = useRef(null);
  const [humanCheckRef, getToken] = useHumanCheck();

  // Results that arrive after leaving the page are dropped.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function showNotice(message) {
    setNotice(message);
    if (message) setAnnouncement(message);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const check = validateQuestion(question);
    if (!check.ok) {
      showNotice(check.error);
      input.current.focus();
      return;
    }

    const request = { question: check.question };
    let nextLayout = null;
    if (custom) {
      const choiceCheck = validateChoices(choices);
      if (!choiceCheck.ok) {
        showNotice(choiceCheck.error);
        choicesEditor.current.focus();
        return;
      }
      request.choices = choiceCheck.choices;
      nextLayout = layoutCustomFaces(choiceCheck.choices);
    }

    setBusy(true);
    showNotice("");
    setSupport(false);
    setAsked(check.question);
    setAnnouncement("The ball is thinking…");
    if (matchMedia("(pointer: coarse)").matches) {
      document.activeElement?.blur(); // drop the on-screen keyboard so the ball is visible
    }

    ball.current.shake();
    const [result] = await Promise.all([
      ask(request),
      ball.current.flipToWindow(),
      // Relabel once the die is down in the murk, where the swap isn't visible.
      ball.current.sink().then(() => {
        if (!nextLayout) return;
        layout.current = nextLayout;
        ball.current?.relabel(nextLayout.labels);
      }),
      wait(MIN_SUSPENSE_MS),
    ]);
    if (!mounted.current) return;
    ball.current.settle();

    await showResult(result, request);
    setQuestion("");
    setBusy(false);
  }

  async function ask(request) {
    let token;
    try {
      token = await getToken();
    } catch {
      return { status: "unverified" };
    }
    return postQuestion({ ...request, token });
  }

  async function showResult(result, request) {
    if (result.status === "answer") {
      const face = custom
        ? pickOne(layout.current.facesByChoice[result.choice])
        : ANSWERS.findIndex((answer) => answer.id === result.answer);
      const text = custom ? request.choices[result.choice] : ANSWERS[face]?.text;
      if (face === undefined || face < 0 || !text) {
        return showResult({ status: "error" }, request);
      }
      return reveal(face, text);
    }

    if (result.status === "undecided" && custom) {
      return reveal(pickOne(UNDECIDED_FACES), "Too close to call.");
    }

    if (result.status === "rate_limited") {
      if (!custom) await reveal(ASK_AGAIN_LATER, ANSWERS[ASK_AGAIN_LATER].text);
      showNotice("You're asking faster than the spirits can answer. Give it a minute.");
      return;
    }

    if (result.status === "unverified") {
      showNotice("The ball couldn't confirm you're a person. Try again, and if you use a content blocker, allow challenges.cloudflare.com.");
      return;
    }

    if (result.status === "refused") {
      showNotice("The ball won't answer that one. Try asking something else.");
      return;
    }

    if (result.status === "support") {
      setSupport(true);
      setAnnouncement(SUPPORT_TEXT);
      return;
    }

    if (result.status === "invalid") {
      showNotice(result.message || "The ball couldn't read that question.");
      return;
    }

    showNotice("The ball is cloudy right now. Try again in a moment.");
  }

  async function reveal(face, text) {
    await ball.current.rise(face);
    if (mounted.current) setAnnouncement(`The ball says: ${text}`);
  }

  // Tapping the ball asks the question, or points you at the input.
  function onBallClick() {
    if (question.trim()) form.current.requestSubmit();
    else input.current.focus();
  }

  const counterClass = question.length >= MAX_QUESTION_LENGTH
    ? "counter full"
    : question.length >= NEAR_LIMIT ? "counter near" : "counter";
  const submit = (
    <button type="submit" className="ask-submit" aria-disabled={busy}>Ask</button>
  );

  return (
    <>
      <Ball
        ref={ball}
        initialLabels={custom ? initialLayout.labels : CLASSIC_LABELS}
        onActivate={onBallClick}
      />

      {asked && <p className="asked">“{asked}”</p>}
      {notice && <p className="notice">{notice}</p>}
      {support && <SupportMessage />}

      <form
        ref={form}
        className={custom ? "ask ask-custom" : "ask"}
        onSubmit={onSubmit}
        autoComplete="off"
        aria-busy={busy}
      >
        <label htmlFor="question" className="visually-hidden">Your question</label>
        <input
          ref={input}
          id="question"
          name="question"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          readOnly={busy}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder={COPY[mode].placeholder}
          enterKeyHint="send"
          spellCheck
        />
        {!custom && submit}
        <div className="ask-meta">
          <span>{COPY[mode].hint}</span>
          <span className={counterClass}>{question.length}/{MAX_QUESTION_LENGTH}</span>
        </div>
        {custom && <ChoicesEditor ref={choicesEditor} choices={choices} onChange={setChoices} />}
        {/* Turnstile renders here, and only shows when it needs the visitor. */}
        <div className="human-check" ref={humanCheckRef} />
        {custom && submit}
      </form>

      <p className="visually-hidden" aria-live="polite">{announcement}</p>
    </>
  );
}

function SupportMessage() {
  return (
    <section className="support">
      <h2>You don't have to face this alone</h2>
      <p>
        It sounds like you might be going through something really hard. In the US, you
        can <a href="tel:988">call</a> or <a href="sms:988">text</a> 988 to reach the
        Suicide &amp; Crisis Lifeline, any time of day.
        Elsewhere, <a href="https://findahelpline.com" rel="noopener">findahelpline.com</a> lists
        free, confidential support near you.
      </p>
    </section>
  );
}

function pickOne(list) {
  return list?.[Math.floor(Math.random() * list.length)];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
