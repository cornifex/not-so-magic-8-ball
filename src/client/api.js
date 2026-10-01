const REQUEST_TIMEOUT_MS = 10_000;

// POST a question (with its Turnstile token) to the Worker. Always resolves
// to a result with a `status`; network failures come back as "error".
export async function postQuestion(body) {
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => null);
    if (data?.status) return data;
    return { status: response.status === 429 ? "rate_limited" : "error" };
  } catch {
    return { status: "error" };
  }
}
