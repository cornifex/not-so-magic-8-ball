// Whether Jev can answer right now, so pages can fall back to the classic
// (random) ball instead of every visitor hitting a failed question.
//
// TypeSafe has no balance endpoint, so running out of credit only shows up
// when a real question fails. Failures are remembered here for a while;
// otherwise a free check (listing models) runs at most once a minute.
// Remembered in Cloudflare's cache, which is per data center.

import { TYPESAFE_API_URL } from "./jev.js";

const STATUS_PATH = "/__jev-status";
const PROBE_TIMEOUT_MS = 3000;

// How long each state is remembered, in seconds. Running out of credit
// won't fix itself, so it's remembered longest.
const REMEMBER = {
  available: 60,
  busy: 60,
  down: 120,
  unauthorized: 600,
  out_of_credit: 3600,
};

// Which upstream failures mean Jev is unavailable, and why. TypeSafe
// documents 401, 429, and 529; 402 is how it reports an empty balance.
export function unavailableReason(status) {
  if (status === 402) return "out_of_credit";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "busy";
  if (status >= 500) return "down";
  return null;
}

// { available: true } or { available: false, reason }
export async function jevStatus(request, env) {
  const cached = await caches.default.match(statusKey(request));
  if (cached) return cached.json();
  const status = await probe(env);
  await remember(request, status);
  return status;
}

export function rememberUnavailable(request, reason) {
  return remember(request, { available: false, reason });
}

// Listing models costs no credit, and confirms the key works and TypeSafe
// is up. It goes to TypeSafe directly, so it doesn't use up the AI Gateway's
// rate limit or fill its logs.
async function probe(env) {
  try {
    const response = await fetch(`${TYPESAFE_API_URL}/v1/models`, {
      headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.ok) return { available: true };
    return { available: false, reason: unavailableReason(response.status) ?? "down" };
  } catch {
    return { available: false, reason: "down" };
  }
}

function remember(request, status) {
  const seconds = REMEMBER[status.available ? "available" : status.reason] ?? REMEMBER.down;
  return caches.default.put(
    statusKey(request),
    new Response(JSON.stringify(status), {
      headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${seconds}` },
    }),
  );
}

function statusKey(request) {
  return new Request(new URL(STATUS_PATH, request.url));
}
