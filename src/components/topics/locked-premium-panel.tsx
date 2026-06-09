import { SocialPostCard } from "./social-post-card";
import type { PublicTopic } from "@/lib/topic-types";

export function LockedPremiumPanel({ topic }: { topic: PublicTopic }) {
  return (
    <section className="border border-[var(--rule-strong)] bg-[var(--panel-strong)] p-5 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
            Premium Analysis
          </p>
          <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[var(--heading)]">
            Full Viewpoints and verified Social Posts are locked.
          </h2>
          <p className="mt-5 text-sm leading-7 text-[var(--copy)]">
            Subscribers unlock the complete Left, Center, and Right Viewpoints,
            reviewed evidence links, and versioned analysis history.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {topic.lockedSocialPosts.map((post) => (
            <SocialPostCard key={`${topic.id}-${post.lean}`} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
