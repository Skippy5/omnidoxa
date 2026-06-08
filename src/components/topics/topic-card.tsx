import Image from "next/image";
import Link from "next/link";
import type { PlaceholderTopic } from "@/lib/placeholder-topics";
import { SentimentBar } from "./sentiment-bar";

export function TopicCard({ topic }: { topic: PlaceholderTopic }) {
  return (
    <article className="grid gap-5 border-t border-[var(--rule)] pt-6 md:grid-cols-[220px_1fr]">
      <Link
        href={`/topics/${topic.slug}`}
        className="relative aspect-[1.45] overflow-hidden bg-[var(--surface)] md:aspect-[1.18]"
      >
        <Image
          src={topic.image}
          alt={topic.imageAlt}
          fill
          sizes="(min-width: 768px) 220px, 100vw"
          className="object-cover [filter:var(--image-filter)]"
        />
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
          <span>{topic.category}</span>
          <span className="text-[var(--muted)]">{topic.updatedAt}</span>
          <span className="text-[var(--muted)]">{topic.readTime}</span>
        </div>

        <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[var(--heading)]">
          <Link href={`/topics/${topic.slug}`} className="hover:underline">
            {topic.title}
          </Link>
        </h2>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--copy)]">
          {topic.discoursePreview}
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {topic.sentiment.map((sentiment) => (
            <SentimentBar
              key={`${topic.id}-${sentiment.lean}`}
              sentiment={sentiment}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
