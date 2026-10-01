// Cloudflare Turnstile in the browser: the bot check sent with every
// question. It runs invisibly and only shows a challenge when Cloudflare
// isn't sure, so most visitors never see it.

import { useCallback, useEffect, useRef } from "react";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 60_000;

// Returns a ref for the element the widget renders into, and a function that
// gets a fresh token for one question.
export function useHumanCheck() {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    const widget = createWidget(containerRef.current);
    widgetRef.current = widget;
    return () => widget.remove();
  }, []);

  const getToken = useCallback(() => widgetRef.current.token(), []);
  return [containerRef, getToken];
}

function createWidget(container) {
  let widgetId = null;
  let removed = false;
  let pending = null;
  let used = false;

  const ready = loadTurnstile().then((sitekey) => {
    if (removed) return;
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
    // The challenge only becomes visible if Cloudflare needs the visitor
    // to interact.
    async token() {
      await ready;
      if (widgetId === null) throw new Error("Turnstile widget was removed");
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

    remove() {
      removed = true;
      settle(new Error("Turnstile widget was removed"));
      if (widgetId !== null) window.turnstile.remove(widgetId);
    },
  };
}

// The site key and script are shared by every widget; a failed load is
// retried by the next widget instead of being cached.
let turnstileReady = null;

function loadTurnstile() {
  turnstileReady ??= Promise.all([loadSiteKey(), loadScript()])
    .then(([sitekey]) => sitekey)
    .catch((error) => {
      turnstileReady = null;
      throw error;
    });
  return turnstileReady;
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
    script.onerror = () => {
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    document.head.append(script);
  });
}
