import { EightBall } from "./EightBall.jsx";
import { Link, useRoute } from "./router.jsx";
import { TipJar } from "./TipJar.jsx";

const PAGES = {
  "/": {
    mode: "classic",
    title: "Not-so-magic 8 Ball",
    tagline: "Ask a question. No magic involved: Jev weighs all 20 answers on the die and picks the best fit.",
  },
  "/make": {
    mode: "custom",
    title: "Make your own · Not-so-magic 8 Ball",
    tagline: "Write your own choices on the die. Jev weighs them against your question and picks the best fit.",
  },
};

export function App() {
  const [path, navigate] = useRoute();
  const route = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const page = PAGES[route];

  return (
    <main className="page">
      <nav className="modes" aria-label="Choose a ball">
        {Object.entries({ "/": "Classic", "/make": "Make your own" }).map(([to, label]) => (
          <Link key={to} to={to} navigate={navigate} aria-current={route === to ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <header className="masthead">
        <h1><span className="not-so">Not-so-</span>magic 8 Ball</h1>
        <p>{page ? page.tagline : "That page isn't on the die."}</p>
      </header>

      {page ? (
        <>
          <title>{page.title}</title>
          {/* A fresh ball per page, as if each were its own page. */}
          <EightBall key={page.mode} mode={page.mode} />
        </>
      ) : (
        <>
          <title>Not found · Not-so-magic 8 Ball</title>
          <p className="asked">
            Try the <Link to="/" navigate={navigate}>classic ball</Link> instead.
          </p>
        </>
      )}

      <footer className="credit">
        <TipJar />
        <p>Answers chosen by Jev from TypeSafe AI.</p>
      </footer>
    </main>
  );
}
