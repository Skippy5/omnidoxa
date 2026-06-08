import Image from "next/image";
import Link from "next/link";
import type { PlaceholderTopic } from "@/lib/placeholder-topics";
import { SentimentBar } from "./sentiment-bar";

export function TopicHero({ topic }: { topic: PlaceholderTopic }) {
  const image = topic.heroImage ?? topic.image;
  const imageAlt = topic.heroImageAlt ?? topic.imageAlt;

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.18fr_0.82fr] lg:px-8 lg:pb-20 lg:pt-10">
      <Link
        href={`/topics/${topic.slug}`}
        className="relative min-h-[320px] overflow-hidden rounded-sm border border-[var(--rule)] bg-[var(--surface)] shadow-[var(--shell-shadow)] sm:min-h-[460px] lg:min-h-[610px]"
      >
        <Image
          src={image}
          alt={imageAlt}
          fill
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="object-cover [filter:var(--image-filter)]"
        />
        <div className="absolute left-6 top-6 bg-[var(--accent-strong)] px-4 py-2 font-mono text-[10px] font-semibold uppercase text-[var(--accent-text)] sm:left-8">
          Lead Analysis
        </div>
      </Link>

      <article className="flex flex-col justify-center">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-semibold uppercase text-[var(--accent)]">
          <span>{topic.category}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          <span className="text-[var(--copy)]">{topic.updatedAt}</span>
          <span className="text-[var(--copy)]">{topic.readTime}</span>
        </div>

        <h1 className="mt-5 max-w-3xl font-serif text-5xl font-bold leading-[0.9] text-[var(--heading)] sm:text-6xl lg:text-7xl">
          {topic.title}
        </h1>

        <p className="mt-8 max-w-xl text-base leading-8 text-[var(--copy)] sm:text-lg">
          {topic.neutralSummary}
        </p>

        <div className="mt-8 w-full max-w-lg rounded-sm border border-[var(--rule)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-mono text-[10px] font-semibold uppercase text-[var(--heading)]">
              Editorial Sentiment
            </h2>
            <span className="text-xs font-semibold text-[var(--heading)]">
              Neutral - Rational
            </span>
          </div>
          <div className="mt-6 space-y-4">
            {topic.sentiment.map((sentiment) => (
              <SentimentBar
                key={`${topic.id}-${sentiment.lean}`}
                sentiment={sentiment}
              />
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
