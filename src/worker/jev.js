// Asks Jev (TypeSafe's System One model) and turns its probabilities into
// the ball's decision. Jev only scores; every decision is made here in code,
// from fixed thresholds, with no randomness.

import { ANSWERS } from "../shared/answers.js";

const DEFAULT_BASE_URL = "https://api.typesafe.ai";
const MODEL = "jev-latest";
const UPSTREAM_TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 300;
// Through Cloudflare AI Gateway, a repeated question is answered from the
// cache: same question, same answer, no charge.
const GATEWAY_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

// Screening. Harmful content needs a clear signal, so risky hobbies like
// stunts and extreme sports get answered; hateful content and self-harm flag
// earlier, because missing those costs more than a false alarm.
export const HARMFUL_THRESHOLD = 0.5;
export const HATEFUL_THRESHOLD = 0.35;
export const SELF_HARM_THRESHOLD = 0.35;
// Classic ball: how sure Jev is of the leading side, yes or no. Below
// MIN_LEAN the ball says it's unsure; from STRONG_LEAN up it uses strong
// wording ("It is certain"), in between soft wording ("Most likely").
export const MIN_LEAN = 0.55;
export const STRONG_LEAN = 0.8;
// Classic ball: below this, the question isn't a yes-or-no question at all.
const MIN_YES_NO = 0.5;
// Make-your-own ball: the top choice must beat the runner-up by this much,
// otherwise it's too close to call.
export const MIN_MARGIN = 0.1;

export class JevError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "JevError";
    this.status = status;
  }
}

// Every request carries the same three screening questions, so harmful
// questions (and harmful custom choices) cost nothing extra to catch.
function screeningQuestions(subject) {
  return {
    harmful: {
      type: "noul",
      instructions: `Does ${subject} ask about hurting other people, being cruel to animals, committing a crime, or doing something self-destructive, even hypothetically or as a joke?`,
      criteria: {
        true: "Violence, cruelty to animals, crimes, or self-destructive acts like driving drunk, taking dangerous drugs, swallowing something toxic, or stopping prescribed medication",
        false: "Everyday questions and bold personal choices, including adventurous activities people take on by choice, however risky, like extreme sports, stunts, and mountaineering, and chores like getting rid of household pests",
      },
    },
    hateful: {
      type: "noul",
      instructions: `Does ${subject} contain slurs, harassment, sexual content, or claims that a group of people is inferior?`,
      criteria: {
        true: "Slurs, harassment of a person, sexual content, or demeaning a group of people",
        false: "Ordinary language, including mild slang",
      },
    },
    self_harm: {
      type: "noul",
      instructions: `Does ${subject} suggest the person asking may be thinking about hurting or killing themselves?`,
      criteria: {
        true: "Hints at suicide, self-injury, or not wanting to be alive",
        false: "No sign the asker might hurt themselves",
      },
    },
  };
}

// The classic ball decides from two yes-or-no probabilities: whether the
// question can be answered yes or no at all, and how likely the answer is yes.
const YES_NO_QUESTION = {
  type: "noul",
  instructions: "Can the question be answered with yes or no?",
  criteria: {
    true: "A yes-or-no question, including predictions, opinions, and personal decisions",
    false: "Asks for something else: picking between options, a name, a number, a time, or an open-ended answer",
  },
};

const LEAN_QUESTION = {
  type: "noul",
  instructions: "Is the answer to the question more likely yes than no?",
  criteria: {
    true: "Yes is more likely: probably true, or probably a good idea for most people",
    false: "No is more likely: probably false, or probably a bad idea for most people",
  },
};

// The wording. Only answers with the chosen group and strength are considered.
const ANSWER_QUESTION = {
  type: "choice",
  instructions: "Which Magic 8 Ball reply best answers the question?",
  criteria: Object.fromEntries(ANSWERS.map((answer) => [answer.id, answer.meaning])),
};

export function buildClassicRequest(question) {
  return {
    state: { question },
    questions: {
      ...screeningQuestions("the question"),
      yes_no: YES_NO_QUESTION,
      lean: LEAN_QUESTION,
      answer: ANSWER_QUESTION,
    },
  };
}

// Custom choices are asked twice, the second time in reverse order. If merely
// reordering them changes the winner, it wasn't a real preference.
export function buildCustomRequest(question, choices) {
  const decision = {
    type: "choice",
    instructions: "Which choice is the best answer to the question?",
    criteria: Object.fromEntries(choices.map((choice, i) => [choiceKey(i), choice])),
  };
  return {
    state: { question, choices },
    questions: {
      ...screeningQuestions("the question or any of the choices"),
      answer: decision,
      answer_reversed: reversed(decision),
    },
  };
}

// TYPESAFE_BASE_URL points requests at Cloudflare AI Gateway instead of
// TypeSafe directly; AI_GATEWAY_TOKEN authenticates with the gateway. The
// gateway logs each request's metadata (tokens, status, timing) but never
// the payload, so visitors' questions aren't stored.
export async function askJev(env, { state, questions }) {
  const url = `${env.TYPESAFE_BASE_URL ?? DEFAULT_BASE_URL}/v1/systemone`;
  const gatewayHeaders = env.AI_GATEWAY_TOKEN
    ? {
        "cf-aig-authorization": `Bearer ${env.AI_GATEWAY_TOKEN}`,
        "cf-aig-cache-ttl": String(GATEWAY_CACHE_TTL_SECONDS),
        "cf-aig-collect-log-payload": "false",
      }
    : {};
  for (let attempt = 1; ; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
          "Content-Type": "application/json",
          ...gatewayHeaders,
        },
        body: JSON.stringify({ model: MODEL, state, questions }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      throw new JevError(`Jev request failed: ${error.name}`, 504);
    }
    if (response.ok) {
      const body = await response.json();
      return body.answers;
    }
    // One quick retry when TypeSafe is overloaded (529) or erroring; the
    // ball's suspense animation leaves room for it.
    if (attempt === 1 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }
    throw new JevError(`Jev responded ${response.status}`, response.status);
  }
}

export function interpretClassic(answers) {
  const screening = screeningScores(answers);
  const yesNo = noul(answers, "yes_no");
  const lean = noul(answers, "lean");
  const wording = probabilities(answers, "answer");

  const sureness = Math.max(lean, 1 - lean);
  const decided = yesNo >= MIN_YES_NO && sureness >= MIN_LEAN;
  const group = decided ? (lean > 0.5 ? "yes" : "no") : "unsure";
  const strength = decided ? (sureness >= STRONG_LEAN ? "strong" : "soft") : undefined;
  const candidates = ANSWERS.filter((a) => a.group === group && a.strength === strength);
  const [answer] = top(wording, candidates.map((a) => a.id));

  return {
    result: screen(screening) ?? { status: "answer", answer },
    details: { screening, yesNo, lean, group, strength, answer },
  };
}

export function interpretCustom(answers, choices) {
  const screening = screeningScores(answers);
  const keys = choices.map((_, i) => choiceKey(i));
  const forward = probabilities(answers, "answer");
  const backward = probabilities(answers, "answer_reversed");
  const scores = average(forward, backward, keys);

  const ranked = keys
    .map((key, index) => ({ index, label: choices[index], probability: scores[key] }))
    .sort((a, b) => b.probability - a.probability);
  const [first, second] = ranked;
  const orderAgrees = top(forward, keys)[0] === top(backward, keys)[0];
  const margin = first.probability - second.probability;
  const decided = orderAgrees && margin >= MIN_MARGIN
    ? { status: "answer", choice: first.index }
    : { status: "undecided" };

  return {
    result: screen(screening) ?? decided,
    details: { screening, ranked, orderAgrees, margin },
  };
}

// Self-harm comes first: someone who may be struggling gets support, not a refusal.
function screen({ harmful, hateful, self_harm }) {
  if (self_harm >= SELF_HARM_THRESHOLD) return { status: "support" };
  if (harmful >= HARMFUL_THRESHOLD || hateful >= HATEFUL_THRESHOLD) return { status: "refused" };
  return null;
}

function screeningScores(answers) {
  return Object.fromEntries(["harmful", "hateful", "self_harm"].map((name) => [name, noul(answers, name)]));
}

function noul(answers, name) {
  const value = answers?.[name]?.noul;
  if (typeof value !== "number") throw new JevError(`Jev response is missing "${name}"`, 502);
  return value;
}

function probabilities(answers, name) {
  const value = answers?.[name]?.probabilities;
  if (!value || typeof value !== "object") throw new JevError(`Jev response is missing "${name}"`, 502);
  return value;
}

function reversed(question) {
  return { ...question, criteria: Object.fromEntries(Object.entries(question.criteria).reverse()) };
}

function average(a, b, keys) {
  return Object.fromEntries(keys.map((key) => [key, ((a[key] ?? 0) + (b[key] ?? 0)) / 2]));
}

// The highest-probability option among `keys`, as [key, probability].
function top(scores, keys) {
  return keys
    .map((key) => [key, scores[key] ?? 0])
    .reduce((best, entry) => (entry[1] > best[1] ? entry : best));
}

function choiceKey(index) {
  return `choice_${index + 1}`;
}
