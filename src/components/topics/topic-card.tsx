import Link from "next/link";
import type { PublicTopic } from "@/lib/topic-types";
import { SentimentBar } from "./sentiment-bar";
import { TopicImage } from "./topic-image";

export function TopicCard({ topic }: { topic: PublicTopic }) {
  return (
    <article className="min-w-0">
      <Link
        href={`/topics/${topic.slug}`}
        className="relative block aspect-[1.36] overflow-hidden rounded-sm bg-[var(--surface)]"
      >
        <TopicImage
          src={topic.image}
          alt={topic.imageAlt}
          sizes="(min-width: 768px) 33vw, 100vw"
        />
      </Link>

      <div className="mt-5 flex items-center justify-between gap-4 font-mono text-[9px] font-semibold uppercase text-[var(--accent)]">
        <span>{topic.category}</span>
        <span className="font-sans text-xs font-normal normal-case text-[var(--muted)]">
          {topic.updatedAt.replace("Updated ", "")}
        </span>
      </div>

      <h2 className="mt-3 min-h-28 border-b border-[var(--rule)] pb-5 font-serif text-2xl font-bold leading-tight text-[var(--heading)]">
        <Link href={`/topics/${topic.slug}`} className="hover:underline">
          {topic.title}
        </Link>
      </h2>

      <div className="mt-5">
        <h3 className="font-mono text-[9px] font-semibold uppercase text-[var(--copy)]">
          Social Sentiment
        </h3>

        <div className="mt-4 space-y-3">
          {topic.sentiment.map((sentiment) => (
            <SentimentBar
              key={`${topic.id}-${sentiment.lean}`}
              sentiment={sentiment}
              compact
            />
          ))}
        </div>
      </div>
    </article>
  );
}
