// Asks Jev (TypeSafe's System One model) and turns its probabilities into
// the ball's decision. Jev only scores; every decision is made here in code,
// from fixed thresholds, with no randomness.

import { ANSWERS } from "../public/js/answers.js";

const DEFAULT_BASE_URL = "https://api.typesafe.ai";
const MODEL = "jev-latest";
const UPSTREAM_TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 300;

// Screening: flag at TypeSafe's suggested review threshold. There's no human
// reviewer here, so a flagged question simply isn't answered.
export const FLAG_THRESHOLD = 0.35;
// Classic ball: a yes or no verdict needs a majority, otherwise it's unsure.
export const MIN_MAJORITY = 0.5;
// Make-your-own ball: the top choice must beat the runner-up by this much,
// otherwise it's too close to call.
export const MIN_MARGIN = 0.15;

const GROUPS = ["yes", "no", "unsure"];

// Offered alongside custom choices so Jev has an honest way to say none of
// them stands out, instead of confidently picking whichever is listed first.
const NO_BASIS = "no_basis";
const NO_BASIS_MEANING = "None stands out: it comes down to taste, chance, or information not given";

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
      instructions: `Does ${subject} ask about hurting someone, breaking the law, or doing something dangerous, even hypothetically or as a joke?`,
      criteria: {
        true: "Asks whether to hurt a person, be cruel to an animal, commit a crime, or do something physically dangerous, such as driving drunk or stopping prescribed medication",
        false: "Everyday questions and decisions, including bold but legal personal choices and routine chores like getting rid of household pests",
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

// Level one of the decision: a single option per group, so the 10 "yes"
// answers can't outvote the 5 "no" answers just by outnumbering them.
const VERDICT_QUESTION = {
  type: "choice",
  instructions: "How should the question be answered?",
  criteria: {
    yes: "Yes: true, likely, or generally a good idea",
    no: "No: false, unlikely, or generally a bad idea",
    unsure: "Can't say: depends on chance or future events, is too vague, or isn't a yes-or-no question",
  },
};

// Level two: the wording. Only answers in the winning group are considered.
const ANSWER_QUESTION = {
  type: "choice",
  instructions: "Which Magic 8 Ball reply best answers the question?",
  criteria: Object.fromEntries(ANSWERS.map((answer) => [answer.id, answer.meaning])),
};

// Decisions are asked twice, the second time with the options in reverse
// order. A decision that flips when the options are merely reordered wasn't
// a real decision, so the ball says it can't tell.
export function buildClassicRequest(question) {
  return {
    state: { question },
    questions: {
      ...screeningQuestions("the question"),
      verdict: VERDICT_QUESTION,
      verdict_reversed: reversed(VERDICT_QUESTION),
      answer: ANSWER_QUESTION,
    },
  };
}

export function buildCustomRequest(question, choices) {
  const decision = {
    type: "choice",
    instructions: "Which choice is the best answer to the question?",
    criteria: Object.fromEntries([
      ...choices.map((choice, i) => [choiceKey(i), choice]),
      [NO_BASIS, NO_BASIS_MEANING],
    ]),
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

export async function askJev(env, { state, questions }) {
  const url = `${env.TYPESAFE_BASE_URL ?? DEFAULT_BASE_URL}/v1/systemone`;
  for (let attempt = 1; ; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
          "Content-Type": "application/json",
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
  const forward = probabilities(answers, "verdict");
  const backward = probabilities(answers, "verdict_reversed");
  const verdict = average(forward, backward, GROUPS);
  const wording = probabilities(answers, "answer");

  const orderAgrees = top(forward, GROUPS)[0] === top(backward, GROUPS)[0];
  const [leader, leaderProbability] = top(verdict, GROUPS);
  const decisive = leader === "unsure" || leaderProbability >= MIN_MAJORITY;
  const group = orderAgrees && decisive ? leader : "unsure";
  const [answer] = top(wording, ANSWERS.filter((a) => a.group === group).map((a) => a.id));

  return {
    result: screen(screening) ?? { status: "answer", answer },
    details: { screening, verdict, orderAgrees, group, answer, groupSums: groupSums(wording) },
  };
}

export function interpretCustom(answers, choices) {
  const screening = screeningScores(answers);
  const keys = [...choices.map((_, i) => choiceKey(i)), NO_BASIS];
  const forward = probabilities(answers, "answer");
  const backward = probabilities(answers, "answer_reversed");
  const scores = average(forward, backward, keys);

  const ranked = keys
    .map((key, index) => ({ key, index, label: choices[index] ?? "(no basis)", probability: scores[key] }))
    .sort((a, b) => b.probability - a.probability);
  const [first, second] = ranked;
  const orderAgrees = top(forward, keys)[0] === top(backward, keys)[0];
  const margin = first.probability - second.probability;
  const decided = orderAgrees && first.key !== NO_BASIS && margin >= MIN_MARGIN
    ? { status: "answer", choice: first.index }
    : { status: "undecided" };

  return {
    result: screen(screening) ?? decided,
    details: { screening, ranked, orderAgrees, margin },
  };
}

// Self-harm comes first: someone who may be struggling gets support, not a refusal.
function screen({ harmful, hateful, self_harm }) {
  if (self_harm >= FLAG_THRESHOLD) return { status: "support" };
  if (harmful >= FLAG_THRESHOLD || hateful >= FLAG_THRESHOLD) return { status: "refused" };
  return null;
}

function screeningScores(answers) {
  const scores = {};
  for (const name of ["harmful", "hateful", "self_harm"]) {
    const value = answers?.[name]?.noul;
    if (typeof value !== "number") throw new JevError(`Jev response is missing "${name}"`, 502);
    scores[name] = value;
  }
  return scores;
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

// For the tuning script: what adding up the 20-answer probabilities by group
// would have said, to compare against the verdict question.
function groupSums(scores) {
  const sums = Object.fromEntries(GROUPS.map((group) => [group, 0]));
  for (const answer of ANSWERS) sums[answer.group] += scores[answer.id] ?? 0;
  return sums;
}

function choiceKey(index) {
  return `choice_${index + 1}`;
}
