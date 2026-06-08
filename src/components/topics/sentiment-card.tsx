import type { SentimentSnapshot } from "@/lib/placeholder-topics";
import { SentimentBar } from "./sentiment-bar";

export function SentimentCard({
  sentiment,
}: {
  sentiment: SentimentSnapshot;
}) {
  return (
    <article className="border border-[var(--rule)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-2xl font-bold text-[var(--heading)]">
            {sentiment.lean}
          </h3>
          <p className="mt-1 font-mono text-xs font-semibold uppercase text-[var(--accent)]">
            {sentiment.evidenceCount} verified posts locked
          </p>
        </div>
        <span className="border border-[var(--rule-strong)] px-3 py-1 font-mono text-[10px] font-semibold uppercase text-[var(--heading)]">
          {sentiment.label}
        </span>
      </div>

      <p className="mt-5 min-h-20 text-sm leading-7 text-[var(--copy)]">
        {sentiment.summary}
      </p>

      <div className="mt-6">
        <SentimentBar sentiment={sentiment} />
      </div>
    </article>
  );
}
