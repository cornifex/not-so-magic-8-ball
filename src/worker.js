import { validateChoices, validateQuestion } from "../public/js/validation.js";
import {
  askJev,
  buildClassicRequest,
  buildCustomRequest,
  interpretClassic,
  interpretCustom,
  JevError,
} from "./jev.js";

const MAX_BODY_BYTES = 2048;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ask") {
      return handleAsk(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

// Body: { question } for the classic ball, or { question, choices } for a
// "make your own" ball.
async function handleAsk(request, env) {
  if (request.method !== "POST") {
    return json({ status: "error", message: "Use POST." }, 405, { Allow: "POST" });
  }
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) {
    return json({ status: "invalid", message: "Request too large." }, 413);
  }

  // Content-Length can be absent (chunked uploads), so check the real body too.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ status: "invalid", message: "Request too large." }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ status: "invalid", message: "Send a JSON body." }, 400);
  }

  const questionCheck = validateQuestion(body?.question);
  if (!questionCheck.ok) {
    return json({ status: "invalid", message: questionCheck.error }, 400);
  }
  const { question } = questionCheck;

  let choices = null;
  if (body.choices !== undefined) {
    const choiceCheck = validateChoices(body.choices);
    if (!choiceCheck.ok) {
      return json({ status: "invalid", message: choiceCheck.error }, 400);
    }
    choices = choiceCheck.choices;
  }

  if (!env.TYPESAFE_API_KEY) {
    console.error("TYPESAFE_API_KEY is not set");
    return json({ status: "error" }, 500);
  }

  // One Jev call screens the question (and any custom choices) and decides
  // the answer. Only the decision is sent back to the browser.
  try {
    if (choices) {
      const answers = await askJev(env, buildCustomRequest(question, choices));
      return json(interpretCustom(answers, choices).result);
    }
    const answers = await askJev(env, buildClassicRequest(question));
    return json(interpretClassic(answers).result);
  } catch (error) {
    if (error instanceof JevError && error.status === 429) {
      return json({ status: "rate_limited" }, 429);
    }
    // Log the failure, never the question: visitors' questions stay private.
    console.error(error instanceof JevError ? error.message : `Unexpected error: ${error.name}`);
    return json({ status: "error" }, 502);
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}
