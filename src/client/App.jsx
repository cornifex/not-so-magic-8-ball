import { ClassicBall } from "./ClassicBall.jsx";
import { useJevStatus } from "./jev-status.js";
import { JevBall } from "./JevBall.jsx";
import { Link, useRoute } from "./router.jsx";
import { TipJar } from "./TipJar.jsx";

const PAGES = {
  "/classic": {
    mode: "classic",
    title: "Classic · Not-so-magic 8 Ball",
    tagline: "The original: think of a question, give it a shake, and let chance decide.",
  },
  "/": {
    mode: "decisive",
    title: "Not-so-magic 8 Ball",
    tagline: "Ask a question. No magic involved: Jev weighs all 20 answers on the die and picks the best fit.",
  },
  "/make": {
    mode: "custom",
    title: "Make your own · Not-so-magic 8 Ball",
    tagline: "Write your own choices on the die. Jev weighs them against your question and picks the best fit.",
  },
};

const NAV = [
  ["/classic", "Classic"],
  ["/", "Decisive"],
  ["/make", "Make your own"],
];

// Why a ball is running without Jev, in the ball's own voice.
const FALLBACK_REASONS = {
  out_of_credit: "This ball is out of Jev juice",
  busy: "Jev is swamped with questions right now",
  down: "Jev is napping right now",
  unauthorized: "Jev is napping right now",
};
const FALLBACK_OUTCOMES = {
  decisive: "so it's running on pure chance. Think of a question and give it a shake.",
  custom: "so the ball will pick one of your choices at random.",
};

export function App() {
  const [path, navigate] = useRoute();
  const route = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const page = PAGES[route];
  const usesJev = page !== undefined && page.mode !== "classic";
  const [jev, markUnavailable] = useJevStatus(usesJev);
  const fallback = usesJev && !jev.available;

  let tagline = page ? page.tagline : "That page isn't on the die.";
  if (fallback) {
    tagline = `${FALLBACK_REASONS[jev.reason] ?? FALLBACK_REASONS.down}, ${FALLBACK_OUTCOMES[page.mode]}`;
  }

  return (
    <main className="page">
      <nav className="modes" aria-label="Choose a ball">
        {NAV.map(([to, label]) => (
          <Link key={to} to={to} navigate={navigate} aria-current={route === to ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <header className="masthead">
        <h1><span className="not-so">Not-so-</span>magic 8 Ball</h1>
        <p className={fallback ? "fallback-note" : undefined}>{tagline}</p>
      </header>

      {page ? <title>{page.title}</title> : <title>Not found · Not-so-magic 8 Ball</title>}

      {/* A fresh ball per page, as if each were its own page. */}
      {page?.mode === "classic" && <ClassicBall key="classic" />}
      {page?.mode === "decisive" && (fallback
        ? <ClassicBall key="decisive-fallback" />
        : <JevBall key="decisive" mode="decisive" jevAvailable onUnavailable={markUnavailable} />)}
      {page?.mode === "custom" && (
        <JevBall key="custom" mode="custom" jevAvailable={!fallback} onUnavailable={markUnavailable} />
      )}
      {!page && (
        <p className="asked">
          Head back to the <Link to="/" navigate={navigate}>8 ball</Link>.
        </p>
      )}

      <footer className="credit">
        <TipJar />
        {usesJev && !fallback && (
          <>
            <p>Answers chosen by Jev from TypeSafe AI.</p>
            <p>
              What you ask is logged anonymously to help improve the ball, so please leave out
              names and personal details.
            </p>
          </>
        )}
      </footer>
    </main>
  );
}
