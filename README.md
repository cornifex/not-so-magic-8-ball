# Not-so-magic 8 Ball

A Magic 8 Ball built in plain HTML, CSS, and JavaScript, with no framework and no build step. The answer isn't random: [Jev](https://docs.typesafe.ai), TypeSafe AI's decision model, weighs every face of the die against your question and picks the best fit.

- **Classic ball** (`/`): the 20 standard answers. Yes-or-no questions work best.
- **Make your own** (`/make/`): write 2–6 choices, the die is relabeled with them, and Jev picks one. Your choices are remembered in your browser.

## How the ball decides

The die is a CSS 3D icosahedron built from real geometry. When you ask, the ball shakes and the die sinks into the murk. A Cloudflare Worker asks Jev, and the die rises with the chosen face pressed against the window.

Before Jev is called, the Worker checks the input, applies a per-visitor rate limit of 10 questions a minute, and verifies a [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) token. Turnstile runs invisibly and only shows a challenge when Cloudflare isn't sure about a visitor. Requests that fail any of these checks never reach Jev.

Each question is one Jev call, and every decision is made in code from Jev's probabilities. Nothing is random:

1. **Screening.** Three yes/no checks run on the question (and on every custom choice): harmful, hateful, and self-harm. Anything scoring 35% or higher isn't answered. A self-harm signal shows support resources instead of an answer.
2. **Classic verdict.** A three-way yes / no / unsure question makes the decision. The 20-answer question only picks the wording within the winning group, so the 10 "yes" answers can't outvote the 5 "no" answers just by outnumbering them. Yes or no needs at least 50%, otherwise the ball says it's unsure.
3. **Custom choices.** Jev also gets a "none of these stands out" option. Without it, Jev picks the first-listed choice with confidence even when there's no basis for it. If nothing clearly wins, the die shows **TOO CLOSE TO CALL**.
4. **Order check.** Each decision is asked twice in the same call, the second time with the options reversed. If reordering changes the winner, the ball says it can't tell.

The thresholds live at the top of [`src/jev.js`](src/jev.js). The wording Jev reads for each classic answer is the `meaning` field in [`public/js/answers.js`](public/js/answers.js).

## Running it locally

You need Node.js 22 or newer and a [TypeSafe](https://docs.typesafe.ai) API key.

```bash
npm install
```

Create a `.dev.vars` file in the project root. It's git-ignored, and Wrangler loads it as secrets. The Turnstile values are Cloudflare's published [test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), which always pass and work on localhost:

```
TYPESAFE_API_KEY=your-key-here
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Start the dev server at http://localhost:8787:

```bash
npm run dev
```

## Tuning with real questions

[`scripts/try-questions.js`](scripts/try-questions.js) runs a fixed set of questions through Jev and prints every score the ball decides from. The set covers facts, judgment calls, chance, prompt injection, harmful and self-harm questions, and custom choices. Each case makes one Jev call.

```bash
npm run try          # every case
npm run try banjo    # only questions containing "banjo"
```

Run it after changing a threshold, a screening question, or an answer's `meaning`.

## API

`POST /api/ask` with a JSON body. Every request also carries `token`, a Turnstile token (omitted below).

| Ball | Request | Answer |
| --- | --- | --- |
| Classic | `{ "question": "Is the earth flat?" }` | `{ "status": "answer", "answer": "my_sources_say_no" }` |
| Make your own | `{ "question": "…", "choices": ["Walk", "Drive"] }` | `{ "status": "answer", "choice": 1 }` or `{ "status": "undecided" }` |

Other statuses: `refused` (screened out), `support` (self-harm signal), `invalid` (bad input, with a `message`), `unverified` (Turnstile failed), `rate_limited`, and `error`.

`GET /api/config` returns the public Turnstile site key the page needs. Questions are limited to 80 characters and choices to 24. The same rules in [`public/js/validation.js`](public/js/validation.js) run in the browser and in the Worker.

## Project layout

| Path | What it is |
| --- | --- |
| `public/` | The static site, served as-is |
| `public/js/d20.js` | The 3D die: geometry, face shading, text fitting, and rise/sink animation |
| `public/js/ball.js` | The ball around the die: the "8" side, the window, and the shake |
| `public/js/app.js` | Page behavior for both balls: asking, results, and messages |
| `public/js/answers.js` | The 20 classic answers, shared by the page and the Worker |
| `public/js/custom-die.js`, `choices-editor.js` | Laying custom choices onto the die, and the choices form |
| `public/js/human-check.js` | Turnstile in the browser: a fresh token for each question |
| `src/worker.js` | Cloudflare Worker: validates, rate-limits, and verifies `/api/ask`, and serves `public/` |
| `src/turnstile.js` | Verifies Turnstile tokens with Cloudflare |
| `src/jev.js` | Builds the Jev request and turns its probabilities into a decision |
| `scripts/try-questions.js` | The tuning script above |

## Deploying

The site runs on Cloudflare Workers at the custom domain in `wrangler.jsonc`, with static assets served from `public/`. The `www` address permanently redirects to the bare domain. Pushes to `main` deploy through [GitHub Actions](.github/workflows/deploy.yml); pull requests only check that the Worker builds. The workflow needs two repository secrets:

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

The Turnstile site key is public and lives in `wrangler.jsonc`. If `TYPESAFE_API_KEY` or either Turnstile key is missing, the Worker refuses every question rather than skipping a check. To deploy by hand instead of through GitHub:

```bash
npm run deploy
```

### AI Gateway

Calls to TypeSafe go through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) as a custom provider (slug `typesafe`, base URL `https://api.typesafe.ai`). The gateway settings used:

- **Authenticated Gateway** on, so only the Worker can use it
- **Cache Responses** on; the Worker caches each question's answer for a week, so a repeated question gets the same answer at no charge
- **Rate Limit Requests** at 100 per 60 seconds, sliding window: a cap across all visitors, on top of the Worker's per-visitor limit
- **Collect Logs** on; the Worker tells the gateway to keep metadata only, never the question

## Privacy

Questions and choices are sent to TypeSafe to be evaluated. The Worker doesn't store them, and its error logs never include them. When requests go through Cloudflare AI Gateway, the gateway logs only metadata (token counts, status, timing), never the questions themselves. Custom choices are saved only in your own browser's local storage.
