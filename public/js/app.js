import { ANSWERS } from "./answers.js";
import { createBall } from "./ball.js";
import { createChoicesEditor } from "./choices-editor.js";
import { layoutCustomFaces, UNDECIDED_FACES } from "./custom-die.js";
import { MAX_QUESTION_LENGTH, validateChoices, validateQuestion } from "./validation.js";

// The shake always lasts at least this long, so Jev's response time
// (70–500ms) hides inside the suspense instead of being felt as lag.
const MIN_SUSPENSE_MS = 1300;
const REQUEST_TIMEOUT_MS = 10_000;
const NEAR_LIMIT = MAX_QUESTION_LENGTH - 10;
const EXAMPLE_CHOICES = ["Chili", "Ramen"];
const ASK_AGAIN_LATER = ANSWERS.findIndex((answer) => answer.id === "ask_again_later");

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
const reducedMotion = () => motionQuery.matches;

// "classic" (the 20 standard answers) or "custom" (the visitor's own choices).
const custom = document.body.dataset.ball === "custom";

const form = document.querySelector("#ask-form");
const input = form.elements.question;
const button = form.querySelector(".ask-submit");
const counter = document.querySelector("#counter");
const asked = document.querySelector("#asked");
const notice = document.querySelector("#notice");
const support = document.querySelector("#support");
const announcer = document.querySelector("#announcer");

const editor = custom ? createChoicesEditor(document.querySelector("#choices")) : null;
let layout = custom ? initialLayout() : null;
const ball = createBall(
  document.querySelector(".ball-area"),
  custom ? layout.labels : ANSWERS.map((answer) => answer.lines),
  { reducedMotion },
);

let busy = false;

input.maxLength = MAX_QUESTION_LENGTH;
updateCounter();
input.addEventListener("input", updateCounter);
form.addEventListener("submit", onSubmit);

// Tapping the ball asks the question, or points you at the input.
ball.element.addEventListener("click", () => {
  if (input.value.trim()) form.requestSubmit();
  else input.focus();
});

async function onSubmit(event) {
  event.preventDefault();
  if (busy) return;

  const check = validateQuestion(input.value);
  if (!check.ok) {
    showNotice(check.error);
    input.focus();
    return;
  }

  const request = { question: check.question };
  let nextLayout = null;
  if (editor) {
    const choiceCheck = validateChoices(editor.values());
    if (!choiceCheck.ok) {
      showNotice(choiceCheck.error);
      editor.focus();
      return;
    }
    request.choices = choiceCheck.choices;
    nextLayout = layoutCustomFaces(choiceCheck.choices);
  }

  setBusy(true);
  showNotice("");
  support.hidden = true;
  asked.textContent = `“${check.question}”`;
  asked.hidden = false;
  announcer.textContent = "The ball is thinking…";
  if (matchMedia("(pointer: coarse)").matches) {
    document.activeElement?.blur(); // drop the on-screen keyboard so the ball is visible
  }

  ball.shake();
  const [result] = await Promise.all([
    ask(request),
    ball.flipToWindow(),
    // Relabel once the die is down in the murk, where the swap isn't visible.
    ball.sink().then(() => {
      if (!nextLayout) return;
      layout = nextLayout;
      ball.relabel(layout.labels);
    }),
    wait(MIN_SUSPENSE_MS),
  ]);
  ball.settle();

  await showResult(result, request);
  input.value = "";
  updateCounter();
  setBusy(false);
}

async function showResult(result, request) {
  if (result.status === "answer") {
    const face = custom
      ? pickOne(layout.facesByChoice[result.choice])
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

  if (result.status === "refused") {
    showNotice("The ball won't answer that one. Try asking something else.");
    return;
  }

  if (result.status === "support") {
    support.hidden = false;
    announcer.textContent = support.textContent.replace(/\s+/g, " ").trim();
    return;
  }

  if (result.status === "invalid") {
    showNotice(result.message || "The ball couldn't read that question.");
    return;
  }

  showNotice("The ball is cloudy right now. Try again in a moment.");
}

async function reveal(face, text) {
  await ball.rise(face);
  announcer.textContent = `The ball says: ${text}`;
}

async function ask(request) {
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => null);
    if (data?.status) return data;
    return { status: response.status === 429 ? "rate_limited" : "error" };
  } catch {
    return { status: "error" };
  }
}

// The die starts labelled with the saved choices, or examples if there are none.
function initialLayout() {
  const saved = validateChoices(editor.values());
  return layoutCustomFaces(saved.ok ? saved.choices : EXAMPLE_CHOICES);
}

function setBusy(value) {
  busy = value;
  input.readOnly = value;
  button.setAttribute("aria-disabled", String(value));
  form.setAttribute("aria-busy", String(value));
}

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = !message;
  if (message) announcer.textContent = message;
}

function updateCounter() {
  const length = input.value.length;
  counter.textContent = `${length}/${MAX_QUESTION_LENGTH}`;
  counter.classList.toggle("near", length >= NEAR_LIMIT && length < MAX_QUESTION_LENGTH);
  counter.classList.toggle("full", length >= MAX_QUESTION_LENGTH);
}

function pickOne(list) {
  return list?.[Math.floor(Math.random() * list.length)];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
