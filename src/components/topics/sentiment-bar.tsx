import type { SentimentSnapshot } from "@/lib/topic-types";

function scoreToPosition(score: number) {
  return Math.min(Math.max((score + 1) * 50, 0), 100);
}

export function SentimentBar({
  sentiment,
  compact = false,
}: {
  sentiment: Pick<SentimentSnapshot, "lean" | "score" | "label">;
  compact?: boolean;
}) {
  const position = scoreToPosition(sentiment.score);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 font-mono text-[9px] font-semibold uppercase text-[var(--muted)]">
        <span>{sentiment.lean}</span>
        {compact ? null : <span>{sentiment.label}</span>}
      </div>
      <div className={compact ? "relative h-1 bg-[var(--meter-track)]" : "relative h-2 bg-[var(--meter-track)]"}>
        <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--rule-strong)]" />
        <span
          className={
            compact
              ? "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--meter-fill)]"
              : "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--page)] bg-[var(--meter-fill)]"
          }
          style={{ left: `${position}%` }}
        />
      </div>
      <div className={compact ? "sr-only" : "mt-2 grid grid-cols-3 font-mono text-[9px] font-semibold uppercase text-[var(--subtle)]"}>
        <span>Critical</span>
        <span className="text-center">Neutral</span>
        <span className="text-right">Optimistic</span>
      </div>
    </div>
  );
}
