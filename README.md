# Not-so-magic 8 Ball

A Magic 8 Ball built as a React single-page app, served by a Cloudflare Worker. On the decisive ball the answer isn't random: [Jev](https://docs.typesafe.ai), TypeSafe AI's decision model, weighs every face of the die against your question and picks the best fit.

- **Classic** (`/classic`): the real toy. Think of a question, shake, and get one of the 20 standard answers at random. Nothing is typed, sent, or logged.
- **Decisive** (`/`, the main page): type a question and Jev picks the answer. Yes-or-no questions work best.
- **Make your own** (`/make`): write 2–6 choices, the die is relabeled with them, and Jev picks one. Your choices are remembered in your browser.

If Jev is unavailable, the Jev balls keep working on chance; see [When Jev is unavailable](#when-jev-is-unavailable).

## How the ball decides

The die is a CSS 3D icosahedron built from real geometry, animated outside React for smooth motion. When you ask, the ball shakes and the die sinks into the murk. A Cloudflare Worker asks Jev, and the die rises with the chosen face pressed against the window.

Before Jev is called, the Worker checks the input, applies a per-visitor rate limit of 10 questions a minute, and verifies a [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) token. Turnstile runs invisibly and only shows a challenge when Cloudflare isn't sure about a visitor. Requests that fail any of these checks never reach Jev.

Each question is one Jev call, and every decision is made in code from Jev's probabilities. Nothing is random:

1. **Screening.** Three yes/no checks run on the question (and on every custom choice). *Harmful* covers violence, cruelty to animals, crimes, and self-destructive acts like driving drunk or taking dangerous drugs. It blocks at 50%, so adventurous choices like stunts, extreme sports, or mountaineering still get answered. *Hateful* blocks at 35%. A *self-harm* signal at 35% shows support resources instead of an answer.
2. **Decisive ball.** Two yes/no probabilities decide: whether the question can be answered yes or no at all, and how likely the answer is yes. At 80% or more either way, the ball uses strong wording ("It is certain", "My reply is no"). From 55% it uses softer wording ("Most likely", "Don't count on it"). Closer to 50/50 than that, or for a question that isn't yes-or-no, it gives a non-committal answer like "Cannot predict now". A 20-answer question then picks the exact wording within that tier.
3. **Make your own.** The choices are asked twice, the second time in reverse order. The ball picks the top choice unless reordering changes the winner or the top two are within 10 points of each other, in which case the die shows **TOO CLOSE TO CALL**.

The thresholds live at the top of [`src/worker/jev.js`](src/worker/jev.js). The wording Jev reads for each answer is the `meaning` field in [`src/shared/answers.js`](src/shared/answers.js).

## When Jev is unavailable

TypeSafe has no balance endpoint, so running out of credit only shows up when a real question fails. The Worker treats these as Jev being unavailable: out of credit (402), a bad key (401/403), busy (429, including the AI Gateway's global cap), or down (5xx, overloaded, or timed out).

- When a page that uses Jev loads, it calls `GET /api/status`. The Worker answers from what it remembers about recent failures. Otherwise it runs a free check (listing TypeSafe's models, which costs no credit) at most once a minute. This state is kept in Cloudflare's cache, per data center.
- A failure during a question is remembered, so the next visitors fall back straight away. Out of credit is remembered for an hour, a bad key for 10 minutes, down for 2 minutes, and busy for 1 minute.
- **Decisive** becomes the classic ball, with a message in place of the tagline, like "This ball is out of Jev juice, so it's running on pure chance."
- **Make your own** keeps its form and picks one of the choices at random. Without Jev, choices aren't screened.
- The per-visitor limit of 10 questions a minute still shows "Ask again later" rather than falling back.

## Running it locally

You need Node.js 22 or newer and a [TypeSafe](https://docs.typesafe.ai) API key.

```bash
npm install
```

Create a `.dev.vars` file in the project root. It's git-ignored, and the Worker loads it as secrets. The Turnstile values are Cloudflare's published [test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), which always pass and work on localhost:

```
TYPESAFE_API_KEY=your-key-here
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Start the dev server at http://localhost:5173. Vite serves the React app with hot reload, and [Cloudflare's Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) runs the Worker alongside it, so `/api/*` works too:

```bash
npm run dev
```

To try the production build locally, build it and serve it at http://localhost:4173:

```bash
npm run build
```

```bash
npm run preview
```

## Tuning with real questions

[`scripts/try-questions.js`](scripts/try-questions.js) runs a fixed set of questions through Jev and prints every score the ball decides from. The set covers facts, judgment calls, chance, prompt injection, harmful and self-harm questions, and custom choices. Each case makes one Jev call.

```bash
npm run try          # every case
npm run try banjo    # only questions containing "banjo"
```

Run it after changing a threshold, a screening question, or an answer's `meaning`. It ends with a pass count and how often each ball landed an answer.

## API

`POST /api/ask` with a JSON body. Every request also carries `token`, a Turnstile token (omitted below).

| Ball | Request | Answer |
| --- | --- | --- |
| Decisive | `{ "question": "Is the earth flat?" }` | `{ "status": "answer", "answer": "my_sources_say_no" }` |
| Make your own | `{ "question": "…", "choices": ["Walk", "Drive"] }` | `{ "status": "answer", "choice": 1 }` or `{ "status": "undecided" }` |

Other statuses: `refused` (screened out), `support` (self-harm signal), `invalid` (bad input, with a `message`), `unverified` (Turnstile failed), `rate_limited` (the per-visitor limit), `unavailable` (Jev can't answer, with a `reason`: `out_of_credit`, `unauthorized`, `busy`, or `down`), and `error`.

`GET /api/config` returns the public Turnstile site key the page needs. `GET /api/status` returns `{ "available": true }`, or `{ "available": false, "reason": "…" }` when Jev can't answer. Questions are limited to 80 characters and choices to 24. The same rules in [`src/shared/validation.js`](src/shared/validation.js) run in the browser and in the Worker.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html`, `vite.config.js` | The app's HTML shell and build setup |
| `src/client/App.jsx`, `router.jsx` | The page shell, the three routes, and the fallback messages |
| `src/client/ClassicBall.jsx` | The classic ball: think, shake, random answer |
| `src/client/JevBall.jsx` | The decisive and make-your-own balls and their form: asking, results, and messages |
| `src/client/jev-status.js` | Checks once per visit whether Jev can answer |
| `src/client/Ball.jsx` | The ball around the die: the "8" side, the window, and the shake |
| `src/client/d20.js` | The 3D die: geometry, face shading, text fitting, and rise/sink animation |
| `src/client/ChoicesEditor.jsx`, `custom-die.js` | The choices form, and laying custom choices onto the die |
| `src/client/human-check.js` | Turnstile in the browser: a fresh token for each question |
| `src/client/TipJar.jsx` | The footer's tip link and the Ko-fi tip panel it opens |
| `src/shared/` | The 20 standard answers and the input rules, used by both the app and the Worker |
| `src/worker/index.js` | Cloudflare Worker: validates, rate-limits, and verifies `/api/ask`, redirects `www`, and serves the app |
| `src/worker/turnstile.js` | Verifies Turnstile tokens with Cloudflare |
| `src/worker/jev.js` | Builds the Jev request and turns its probabilities into a decision |
| `src/worker/jev-status.js` | Whether Jev can answer: remembered failures and a free availability check |
| `scripts/try-questions.js` | The tuning script above |

## Deploying

The site runs on Cloudflare Workers at the custom domain in `wrangler.jsonc`. The `www` address permanently redirects to the bare domain. Pushes to `main` build and deploy through [GitHub Actions](.github/workflows/deploy.yml); pull requests only check that the app builds. The workflow needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: a token from the **Edit Cloudflare Workers** template, scoped to your account and the site's zone
- `CLOUDFLARE_ACCOUNT_ID`

The Worker's own secrets are set once and kept across deploys:

| Secret | What it is |
| --- | --- |
| `TYPESAFE_API_KEY` | Your TypeSafe API key |
| `TURNSTILE_SECRET_KEY` | The Turnstile widget's secret key |
| `TYPESAFE_BASE_URL` | Optional: routes Jev calls through AI Gateway, as `https://gateway.ai.cloudflare.com/v1/<account-id>/<gateway>/custom-typesafe` |
| `AI_GATEWAY_TOKEN` | With the gateway: its authentication token |

```bash
npx wrangler secret put TYPESAFE_API_KEY
```

The Turnstile site key is public and lives in `wrangler.jsonc`. If `TYPESAFE_API_KEY` or either Turnstile key is missing, the Worker refuses every question rather than skipping a check. To build and deploy by hand instead of through GitHub:

```bash
npm run deploy
```

### AI Gateway

Calls to TypeSafe go through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) as a custom provider (slug `typesafe`, base URL `https://api.typesafe.ai`). The gateway settings used:

- **Authenticated Gateway** on, so only the Worker can use it
- **Cache Responses** on; the Worker caches each question's answer for a week, so a repeated question gets the same answer at no charge
- **Rate Limit Requests** at 100 per 60 seconds, sliding window: a cap across all visitors, on top of the Worker's per-visitor limit
- **Collect Logs** on: each log holds the question, any custom choices, and Jev's scores, with nothing that identifies the visitor. Cloudflare deletes older logs automatically.

## Privacy

The classic ball sends and logs nothing; it answers in your browser. On the Jev balls, questions and any custom choices are sent to TypeSafe to be evaluated, and logged anonymously in Cloudflare AI Gateway along with Jev's scores, to help improve the ball. The logs hold only what was asked and how Jev scored it: no IP addresses, accounts, or other identifiers, because the request to the gateway comes from the Worker, not the visitor's browser. Cloudflare deletes older logs automatically. The page says this in its footer and asks visitors to leave out names and personal details. The Worker's own logs never include questions. Custom choices are also saved in your own browser's local storage, so they're still there next time. The Ko-fi tip panel loads from Ko-fi only after you open it.
