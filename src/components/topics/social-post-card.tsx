import type { LockedSocialPostPreview } from "@/lib/placeholder-topics";

export function SocialPostCard({
  post,
}: {
  post: LockedSocialPostPreview;
}) {
  return (
    <article className="relative overflow-hidden border border-[var(--rule)] bg-[var(--panel)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
            {post.lean} evidence
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--heading)]">
            {post.sourceLabel}
          </h3>
        </div>
        <span className="border border-[var(--rule-strong)] px-3 py-1 font-mono text-[10px] font-semibold uppercase text-[var(--heading)]">
          {post.platform}
        </span>
      </div>

      <div className="mt-5 space-y-3" aria-hidden="true">
        <span className="block h-3 w-full bg-[var(--redaction)]" />
        <span className="block h-3 w-11/12 bg-[var(--redaction)]" />
        <span className="block h-3 w-3/5 bg-[var(--redaction)]" />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--rule)] pt-4 font-mono text-[10px] font-semibold uppercase text-[var(--muted)]">
        <span>{post.evidenceCount} posts</span>
        <span>Subscriber locked</span>
      </div>
    </article>
  );
}
