import { SocialPostCard } from "./social-post-card";
import type { PublicTopic } from "@/lib/topic-types";

export function LockedPremiumPanel({ topic }: { topic: PublicTopic }) {
  if (topic.premiumAnalysis) {
    return (
      <section className="border border-[var(--rule-strong)] bg-[var(--panel-strong)] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
              Premium Analysis
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[var(--heading)]">
              Full Viewpoints and verified Social Posts
            </h2>
          </div>
          <span className="border border-[var(--rule)] px-3 py-2 font-mono text-[10px] uppercase text-[var(--copy)]">
            Version {topic.premiumAnalysis.analysisVersion}
          </span>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {topic.premiumAnalysis.viewpoints.map((viewpoint) => (
            <article
              key={`${topic.id}-${viewpoint.lean}-premium`}
              className="border border-[var(--rule)] bg-[var(--panel)] p-5"
            >
              <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
                {viewpoint.lean} Viewpoint
              </p>
              <h3 className="mt-2 font-serif text-xl font-bold italic text-[var(--heading)]">
                {viewpoint.label ?? "Reviewed analysis"}
              </h3>
              <p className="mt-4 text-sm leading-7 text-[var(--copy)]">
                {viewpoint.summary}
              </p>

              <div className="mt-5 grid gap-3 border-t border-[var(--rule)] pt-4">
                {viewpoint.posts.length > 0 ? (
                  viewpoint.posts.map((post) => (
                    <a
                      key={post.id}
                      href={post.url}
                      className="block border border-[var(--rule)] bg-[var(--surface)] p-4 hover:border-[var(--accent)]"
                    >
                      <span className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
                        {post.authorHandle ?? post.author ?? "X post"}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-[var(--copy)]">
                        {post.text}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-3 font-mono text-[9px] uppercase text-[var(--subtle)]">
                        <span>{post.likes} likes</span>
                        <span>{post.retweets} reposts</span>
                      </span>
                    </a>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[var(--copy)]">
                    No verified posts are attached to this viewpoint yet.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

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
