import type { SentimentSnapshot } from "@/lib/placeholder-topics";

function scoreToPosition(score: number) {
  return Math.min(Math.max((score + 1) * 50, 0), 100);
}

export function SentimentBar({
  sentiment,
}: {
  sentiment: Pick<SentimentSnapshot, "lean" | "score" | "label">;
}) {
  const position = scoreToPosition(sentiment.score);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase text-[var(--muted)]">
        <span>{sentiment.lean}</span>
        <span>{sentiment.label}</span>
      </div>
      <div className="relative h-2 bg-[var(--meter-track)]">
        <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--rule-strong)]" />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--page)] bg-[var(--accent)]"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 font-mono text-[9px] font-semibold uppercase text-[var(--subtle)]">
        <span>Critical</span>
        <span className="text-center">Neutral</span>
        <span className="text-right">Optimistic</span>
      </div>
    </div>
  );
}
