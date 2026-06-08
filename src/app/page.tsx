import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const navItems = ["Politics", "Tech", "Entertainment", "Economy", "Science"];

const stories = [
  {
    category: "Politics",
    time: "2h Ago",
    title: "Legislative Deadlock: The Hidden Cost of Infinite Amendments.",
    image: "/editorial/politics.png",
    alt: "Monochrome editorial image of a capitol building",
    sentiment: [
      { label: "Left", score: "-0.8", value: 12, accent: "coral" },
      { label: "Center", score: "-0.2", value: 42, accent: "steel" },
      { label: "Right", score: "+0.4", value: 72, accent: "steel" },
    ],
  },
  {
    category: "Technology",
    time: "4h Ago",
    title: "Quantum Supremacy: Beyond the Theoretical Horizon.",
    image: "/editorial/technology.png",
    alt: "Monochrome editorial portrait representing artificial intelligence",
    sentiment: [
      { label: "Left", score: "+0.6", value: 82, accent: "steel" },
      { label: "Center", score: "+0.9", value: 96, accent: "steel" },
      { label: "Right", score: "-0.1", value: 46, accent: "steel" },
    ],
  },
  {
    category: "Global",
    time: "6h Ago",
    title: "Resource Mapping: The New Scramble for Arctic Rare Earths.",
    image: "/editorial/global.png",
    alt: "Monochrome editorial image of planet Earth",
    sentiment: [
      { label: "Left", score: "+0.2", value: 62, accent: "steel" },
      { label: "Center", score: "0.0", value: 52, accent: "steel" },
      { label: "Right", score: "-0.3", value: 36, accent: "coral" },
    ],
  },
];

export default function Home() {
  return (
    <main id="top" className="min-h-dvh bg-[var(--page)] text-foreground">
      <Header />

      <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.18fr_0.82fr] lg:px-10 lg:pb-24">
        <div className="relative min-h-[280px] overflow-hidden rounded-sm border border-[var(--rule)] bg-[var(--surface)] shadow-[var(--shell-shadow)] sm:min-h-[380px]">
          <Image
            src="/editorial/lead-analysis.png"
            alt="Abstract blue half-sphere surrounded by a dotted analytic ring"
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover"
          />
          <div className="absolute left-6 top-6 bg-[var(--accent-strong)] px-4 py-2 font-mono text-xs font-semibold uppercase text-[var(--accent-text)] sm:left-8">
            Lead Analysis
          </div>
        </div>

        <article className="flex flex-col justify-center gap-8 lg:pl-2">
          <div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs uppercase text-[var(--heading)]">
              <span>Global Affairs</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span className="text-[var(--copy)]">14 Min Read</span>
            </div>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl font-bold leading-[0.92] text-[var(--heading)] sm:text-6xl lg:text-7xl">
              The Silken Web: How Algorithmic Diplomacy is Reshaping Trade.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--copy)]">
              A deep dive into the automated negotiation protocols currently
              dictating cross-border tariffs between the G7 and emerging
              markets.
            </p>
          </div>

          <EditorialSentiment />
        </article>
      </section>

      <section
        id="stories"
        className="mx-auto grid w-full max-w-7xl gap-12 px-6 pb-24 sm:px-8 md:grid-cols-3 lg:px-10"
      >
        {stories.map((story) => (
          <StoryCard key={story.title} story={story} />
        ))}
      </section>

      <section
        id="methodology"
        className="mx-auto grid w-full max-w-7xl gap-12 px-6 pb-28 pt-4 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:pb-36"
      >
        <div className="max-w-3xl">
          <h2 className="font-serif text-4xl font-bold leading-tight text-[var(--heading)] sm:text-5xl">
            Methodology of Intelligence.
          </h2>
          <p className="mt-8 max-w-2xl text-xl leading-9 text-[var(--copy)]">
            Omnidoxa doesn&apos;t just aggregate; it evaluates. Using natural
            language processing, we dissect the semantic tone of every report
            to provide you with a clearer picture of the prevailing narrative.
          </p>
          <Link
            href="#methodology"
            className="mt-10 inline-flex min-h-12 items-center border border-[var(--rule-strong)] px-8 font-mono text-sm font-semibold uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface)]"
          >
            Read Our Ethics Statement
          </Link>
        </div>

        <aside className="justify-self-start rounded-sm border border-[var(--rule)] bg-[var(--panel-strong)] p-8 shadow-[var(--shell-shadow)] lg:w-[350px] lg:justify-self-center">
          <h2 className="font-serif text-3xl italic leading-tight text-[var(--heading)]">
            The Week in Wisdom
          </h2>
          <p className="mt-6 text-sm leading-7 text-[var(--copy)]">
            An aggregated distillation of top-tier editorial positions across
            global publications. We track consistency, bias, and factual
            evolution.
          </p>
          <Metric label="Fact Density" value="94%" width="94%" />
          <Metric label="Source Diversity" value="82%" width="82%" />
        </aside>
      </section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-5 sm:px-8 lg:px-10">
      <div className="flex min-w-0 items-center gap-10">
        <Link
          href="/"
          className="font-serif text-2xl font-bold text-[var(--heading)]"
        >
          Omnidoxa
        </Link>
        <nav className="hidden items-center gap-9 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item}
              href="#stories"
              className="font-serif text-sm italic text-[var(--copy)] transition-colors hover:text-[var(--heading)]"
            >
              {item}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-5">
        <Link
          href="/briefing"
          className="hidden border border-[var(--rule-strong)] bg-[var(--button-bg)] px-5 py-3 font-mono text-xs text-[var(--button-text)] transition-colors hover:opacity-90 sm:inline-flex"
        >
          Daily Briefing
        </Link>
        <ThemeToggle />
        <Link
          href="/admin"
          aria-label="Account"
          className="grid h-8 w-8 place-items-center rounded-full border border-transparent text-[var(--nav-icon)] transition-colors hover:border-[var(--rule-strong)] hover:text-[var(--heading)]"
        >
          <span className="h-4 w-4 rounded-full border-2 border-current before:mx-auto before:mt-1 before:block before:h-1.5 before:w-1.5 before:rounded-full before:bg-current" />
        </Link>
      </div>
    </header>
  );
}

function EditorialSentiment() {
  return (
    <div className="w-full max-w-lg rounded-sm border border-[var(--rule)] bg-[var(--panel)] p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-xs font-semibold uppercase text-[var(--copy)]">
          Editorial Sentiment
        </h2>
        <p className="text-xs text-[var(--heading)]">Neutral - Rational</p>
      </div>
      <div className="mt-5 h-1.5 bg-[var(--meter-track)]">
        <div className="relative h-full w-1/2 bg-[var(--sentiment-critical)]">
          <span className="absolute right-[-6px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[var(--panel)] bg-[var(--heading)]" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 font-mono text-[10px] font-semibold uppercase text-[var(--copy)]">
        <span>Critical</span>
        <span className="text-center">Objective</span>
        <span className="text-right">Optimistic</span>
      </div>
    </div>
  );
}

function StoryCard({
  story,
}: {
  story: (typeof stories)[number];
}) {
  return (
    <article className="min-w-0">
      <div className="relative aspect-[1.36] overflow-hidden rounded-sm bg-[var(--surface)]">
        <Image
          src={story.image}
          alt={story.alt}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover [filter:var(--image-filter)]"
        />
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 font-mono text-[10px] font-semibold uppercase text-[var(--heading)]">
        <span>{story.category}</span>
        <span className="font-sans text-xs font-normal normal-case text-[var(--muted)]">
          {story.time}
        </span>
      </div>

      <h2 className="mt-4 min-h-[4.5rem] border-b border-[var(--rule)] pb-6 font-serif text-2xl font-bold leading-snug text-[var(--heading)]">
        {story.title}
      </h2>

      <div className="mt-6">
        <h3 className="font-mono text-[10px] font-semibold uppercase text-[var(--copy)]">
          Social Sentiment (Tweets)
        </h3>
        <div className="mt-5 space-y-3">
          {story.sentiment.map((item) => (
            <SentimentBar key={`${story.title}-${item.label}`} item={item} />
          ))}
        </div>
      </div>
    </article>
  );
}

function SentimentBar({
  item,
}: {
  item: {
    label: string;
    score: string;
    value: number;
    accent: string;
  };
}) {
  const isCoral = item.accent === "coral";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase text-[var(--muted)]">
        <span>{item.label}</span>
        <span>{item.score}</span>
      </div>
      <div className="relative h-1 bg-[var(--meter-track)]">
        <div
          className={
            isCoral
              ? "h-full bg-[var(--sentiment-critical)]"
              : "h-full bg-[var(--meter-fill)]"
          }
          style={{ width: `${item.value}%` }}
        />
        <span
          className={
            isCoral
              ? "absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[var(--sentiment-hot)]"
              : "absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[var(--heading)]"
          }
          style={{ left: `calc(${item.value}% - 5px)` }}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: string;
}) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] font-semibold uppercase text-[var(--heading)]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 bg-[var(--metric-track)]">
        <div className="h-full bg-[var(--heading)]" style={{ width }} />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer
      id="footer"
      className="bg-[var(--footer)] px-6 py-16 sm:px-8 lg:px-10"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1fr_auto]">
        <div>
          <Link
            href="/"
            className="font-serif text-xl font-bold text-[var(--heading)]"
          >
            Omnidoxa
          </Link>
          <p className="mt-6 max-w-xl font-mono text-sm uppercase leading-7 text-[var(--copy)]">
            (c) 2024 Omnidoxa. A premium digital publication dedicated to the
            curation of human wisdom and technological advancement.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-10 gap-y-4 font-mono text-sm uppercase text-[var(--subtle)]">
          <Link href="#top" className="hover:text-[var(--heading)]">
            Mission
          </Link>
          <Link href="#stories" className="hover:text-[var(--heading)]">
            Archives
          </Link>
          <Link href="#methodology" className="hover:text-[var(--heading)]">
            Methodology
          </Link>
          <Link href="#footer" className="hover:text-[var(--heading)]">
            Privacy
          </Link>
          <Link href="#methodology" className="hover:text-[var(--heading)]">
            Ethics Statement
          </Link>
        </nav>
      </div>
    </footer>
  );
}
