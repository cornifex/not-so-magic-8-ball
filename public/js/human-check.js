// Cloudflare Turnstile in the browser: the bot check sent with every
// question. It runs invisibly and only shows a challenge when Cloudflare
// isn't sure, so most visitors never see it.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 60_000;

export function createHumanCheck(container) {
  let widgetId = null;
  let pending = null;
  let used = false;

  const ready = loadSiteKey()
    .then((sitekey) => loadScript().then(() => sitekey))
    .then((sitekey) => {
      widgetId = window.turnstile.render(container, {
        sitekey,
        action: "ask",
        execution: "execute",
        appearance: "interaction-only",
        theme: "dark",
        size: "flexible",
        callback: (token) => settle(null, token),
        "error-callback": () => settle(new Error("Turnstile challenge failed")),
      });
    });
  ready.catch(() => {}); // surfaced when a token is requested

  function settle(error, token) {
    if (!pending) return;
    clearTimeout(pending.timer);
    if (error) pending.reject(error);
    else pending.resolve(token);
    pending = null;
  }

  return {
    // A fresh token for one question. The challenge only becomes visible if
    // Cloudflare needs the visitor to interact.
    async token() {
      await ready;
      return new Promise((resolve, reject) => {
        pending = {
          resolve,
          reject,
          timer: setTimeout(() => settle(new Error("Turnstile timed out")), TOKEN_TIMEOUT_MS),
        };
        if (used) window.turnstile.reset(widgetId); // tokens are single-use
        used = true;
        window.turnstile.execute(widgetId);
      });
    },
  };
}

async function loadSiteKey() {
  const response = await fetch("/api/config");
  const config = response.ok ? await response.json() : null;
  if (!config?.turnstileSiteKey) throw new Error("No Turnstile site key configured");
  return config.turnstileSiteKey;
}

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.append(script);
  });
}
