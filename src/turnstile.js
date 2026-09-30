// Server side of Cloudflare Turnstile: confirms the token the browser sends
// with each question came from a real visitor. Tokens are single-use and
// expire after five minutes.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;
const TIMEOUT_MS = 5000;

export async function verifyHuman(env, token, ip) {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) {
    return false;
  }
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error(`Turnstile verification failed: ${error.name}`);
    return false;
  }
}
