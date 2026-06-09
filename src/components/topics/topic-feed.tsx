import type { PublicTopic } from "@/lib/topic-types";
import { TopicCard } from "./topic-card";

export function TopicFeed({
  topics,
  activeCategory,
}: {
  topics: PublicTopic[];
  activeCategory?: string;
}) {
  return (
    <section
      id="topics"
      className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
            Topic Index
          </p>
          <h2 className="mt-2 font-serif text-3xl font-bold leading-tight text-[var(--heading)] sm:text-4xl">
            {activeCategory ? `${activeCategory} Topics` : "Current discourse map"}
          </h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-[var(--copy)]">
          Free Topic layers include neutral summaries, discourse previews, and
          locked premium evidence states.
        </p>
      </div>

      <div className="mt-10 grid gap-12 md:grid-cols-3">
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
      </div>

      {topics.length === 0 ? (
        <p className="mt-10 border border-[var(--rule)] bg-[var(--surface)] p-6 text-sm leading-7 text-[var(--copy)]">
          No Topics are available for this category yet.
        </p>
      ) : null}
    </section>
  );
}
