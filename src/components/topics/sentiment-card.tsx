import type { SentimentSnapshot } from "@/lib/placeholder-topics";
import { SentimentBar } from "./sentiment-bar";

export function SentimentCard({
  sentiment,
}: {
  sentiment: SentimentSnapshot;
}) {
  return (
    <article className="border border-[var(--rule)] border-t-[var(--rule-strong)] bg-[var(--panel)] p-6">
      <div className="text-center">
        <h3 className="font-serif text-lg font-bold italic text-[var(--heading)]">
          {sentiment.lean} Sentiment
        </h3>
        <p className="mt-2 font-mono text-[9px] font-semibold uppercase text-[var(--accent)]">
          {sentiment.evidenceCount} posts locked
        </p>
      </div>

      <div className="mt-6">
        <SentimentBar sentiment={sentiment} />
      </div>

      <div className="mt-6 grid min-h-32 place-items-center border border-[var(--rule)] bg-[var(--redaction)] px-5 text-center">
        <p className="max-w-48 font-serif text-sm italic leading-6 text-[var(--copy)]">
          {sentiment.summary}
        </p>
      </div>
    </article>
  );
}
