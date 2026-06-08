import Image from "next/image";
import Link from "next/link";
import type { PlaceholderTopic } from "@/lib/placeholder-topics";
import { SentimentBar } from "./sentiment-bar";

export function TopicHero({ topic }: { topic: PlaceholderTopic }) {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-12">
      <Link
        href={`/topics/${topic.slug}`}
        className="relative min-h-[300px] overflow-hidden border border-[var(--rule)] bg-[var(--surface)] shadow-[var(--shell-shadow)] sm:min-h-[420px]"
      >
        <Image
          src={topic.image}
          alt={topic.imageAlt}
          fill
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="object-cover [filter:var(--image-filter)]"
        />
        <div className="absolute left-5 top-5 bg-[var(--accent-strong)] px-4 py-2 font-mono text-xs font-semibold uppercase text-[var(--accent-text)]">
          Lead Topic
        </div>
      </Link>

      <article className="flex flex-col justify-center">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-semibold uppercase text-[var(--accent)]">
          <span>{topic.category}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          <span className="text-[var(--copy)]">{topic.updatedAt}</span>
          <span className="text-[var(--copy)]">{topic.readTime}</span>
        </div>

        <h1 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-[1.02] text-[var(--heading)] sm:text-5xl lg:text-6xl">
          {topic.title}
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--copy)] sm:text-lg">
          {topic.neutralSummary}
        </p>

        <div className="mt-8 border border-[var(--rule)] bg-[var(--panel)] p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-mono text-xs font-semibold uppercase text-[var(--heading)]">
              Discourse Preview
            </h2>
            <span className="font-mono text-[10px] font-semibold uppercase text-[var(--muted)]">
              Heat {topic.heatScore}
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--copy)]">
            {topic.discoursePreview}
          </p>
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
