import type { PlaceholderTopic } from "@/lib/placeholder-topics";
import { TopicCard } from "./topic-card";

export function TopicFeed({
  topics,
}: {
  topics: PlaceholderTopic[];
}) {
  return (
    <section
      id="topics"
      className="mx-auto w-full max-w-7xl px-5 pb-20 pt-4 sm:px-8 lg:px-10"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
            Public Topics
          </p>
          <h2 className="mt-2 font-serif text-4xl font-bold text-[var(--heading)]">
            Current discourse map
          </h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-[var(--copy)]">
          Free Topic layers include neutral summaries, discourse previews, and
          locked premium evidence states.
        </p>
      </div>

      <div className="mt-10 space-y-8">
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
      </div>
    </section>
  );
}
