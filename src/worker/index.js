import { validateChoices, validateQuestion } from "../shared/validation.js";
import {
  askJev,
  buildClassicRequest,
  buildCustomRequest,
  interpretClassic,
  interpretCustom,
  JevError,
} from "./jev.js";
import { verifyHuman } from "./turnstile.js";

// Room for a question, six choices, and a Turnstile token (up to 2048 chars).
const MAX_BODY_BYTES = 4096;
const REQUIRED_CONFIG = ["TYPESAFE_API_KEY", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // www.<domain> permanently redirects to the bare domain, so the site has
    // one address.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice("www.".length);
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/ask") {
      return handleAsk(request, env);
    }
    if (url.pathname === "/api/config") {
      return handleConfig(env);
    }
    return env.ASSETS.fetch(request);
  },
};

// Public settings the page needs before it can ask anything.
function handleConfig(env) {
  if (!env.TURNSTILE_SITE_KEY) {
    console.error("TURNSTILE_SITE_KEY is not set");
    return json({ status: "error" }, 500);
  }
  return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY }, 200, {
    "Cache-Control": "public, max-age=300",
  });
}

// Body: { question, token } for the classic ball, or { question, choices,
// token } for a "make your own" ball. `token` is the Turnstile token.
//
// Checks run cheapest first: input, per-visitor rate limit, Turnstile, and
// only then the paid Jev call.
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

  // Fail closed: without every key, nothing gets past the bot check to Jev.
  const missing = REQUIRED_CONFIG.filter((name) => !env[name]);
  if (missing.length) {
    console.error(`Missing configuration: ${missing.join(", ")}`);
    return json({ status: "error" }, 500);
  }

  const ip = request.headers.get("CF-Connecting-IP");
  const { success: withinLimit } = await env.ASK_LIMITER.limit({ key: ip ?? "unknown" });
  if (!withinLimit) {
    return json({ status: "rate_limited" }, 429);
  }

  if (!(await verifyHuman(env, body.token, ip))) {
    return json({ status: "unverified" }, 403);
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
