import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { LockedPremiumPanel } from "@/components/topics/locked-premium-panel";
import { SentimentCard } from "@/components/topics/sentiment-card";
import { getTopicBySlug, placeholderTopics } from "@/lib/placeholder-topics";

type TopicPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export function generateStaticParams() {
  return placeholderTopics.map((topic) => ({
    id: topic.slug,
  }));
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const { id } = await params;
  const topic = getTopicBySlug(id);

  if (!topic) {
    return {
      title: "Topic not found | OmniDoxa",
    };
  }

  return {
    title: `${topic.title} | OmniDoxa`,
    description: topic.neutralSummary,
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { id } = await params;
  const topic = getTopicBySlug(id);

  if (!topic) {
    notFound();
  }

  const featureImage = topic.heroImage ?? topic.image;
  const featureImageAlt = topic.heroImageAlt ?? topic.imageAlt;

  return (
    <main className="min-h-dvh bg-[var(--page)] text-foreground">
      <SiteNav />

      <article className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="grid gap-8 lg:grid-cols-[1fr_260px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
              <span>{topic.category} Analysis</span>
              <span>{topic.updatedAt.replace("Updated ", "")}</span>
            </div>

            <h1 className="mt-4 max-w-5xl font-serif text-5xl font-bold italic leading-[0.9] text-[var(--heading)] sm:text-6xl lg:text-7xl">
              {topic.title}
            </h1>

            <div className="mt-7 flex items-center gap-4">
              <span className="h-5 w-5 rounded-sm bg-[var(--sentiment-critical)]" />
              <div>
                <p className="font-serif text-sm font-bold text-[var(--heading)]">
                  OmniDoxa Editorial
                </p>
                <p className="font-mono text-[9px] font-semibold uppercase text-[var(--subtle)]">
                  Neutral topic correspondent
                </p>
              </div>
            </div>
          </div>

          <aside className="border-l-2 border-[var(--rule-strong)] bg-[var(--panel)] px-5 py-4">
            <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
              Analytical Sentiment
            </p>
            <p className="mt-2 font-serif text-xl font-bold italic text-[var(--heading)]">
              Neutral-High III
            </p>
          </aside>
        </header>

        <div className="relative mt-10 min-h-[300px] overflow-hidden rounded-sm border border-[var(--rule)] bg-[var(--surface)] shadow-[var(--shell-shadow)] sm:min-h-[460px] lg:min-h-[610px]">
          <Image
            src={featureImage}
            alt={featureImageAlt}
            fill
            priority
            sizes="(min-width: 1024px) 100vw, 100vw"
            className="object-cover [filter:var(--image-filter)]"
          />
        </div>

        <section className="mt-12">
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
            Deep Discourse Analysis: Social Sentiment
          </p>

          <div className="mt-7 grid gap-6 md:grid-cols-3">
            {topic.sentiment.map((sentiment) => (
              <SentimentCard
                key={`${topic.id}-${sentiment.lean}`}
                sentiment={sentiment}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <p className="font-serif text-xl font-bold italic leading-8 text-[var(--heading)]">
            This analysis is distilled from placeholder verified sources and
            hours of algorithmic cross-referencing.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/pricing"
              className="inline-flex min-h-10 items-center border border-[var(--rule-strong)] bg-[var(--button-bg)] px-6 font-mono text-[10px] font-semibold uppercase text-[var(--button-text)] hover:opacity-90"
            >
              Download PDF Report
            </Link>
            <Link
              href={topic.anchorArticle.url}
              className="inline-flex min-h-10 items-center border border-[var(--rule-strong)] px-6 font-mono text-[10px] font-semibold uppercase text-[var(--heading)] hover:border-[var(--accent)]"
            >
              Read Original Article
            </Link>
          </div>
        </section>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <section className="border border-[var(--rule)] bg-[var(--panel-strong)] p-6 sm:p-7">
            <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
              Central Development
            </p>
            <p className="mt-4 text-base leading-8 text-[var(--copy)]">
              {topic.centralDevelopment}
            </p>
          </section>

          <section className="border border-[var(--rule)] bg-[var(--surface)] p-6 sm:p-7">
            <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
              Neutral Topic Summary
            </p>
            <p className="mt-4 text-base leading-8 text-[var(--copy)]">
              {topic.neutralSummary}
            </p>
          </section>

          <section className="border border-[var(--rule)] bg-[var(--surface)] p-6 sm:p-7">
            <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
              Discourse Preview
            </p>
            <p className="mt-4 text-base leading-8 text-[var(--copy)]">
              {topic.discoursePreview}
            </p>
          </section>

          <section className="border border-[var(--rule)] bg-[var(--panel)] p-6 sm:p-7">
            <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
              Anchor Article
            </p>
            <h2 className="mt-4 font-serif text-2xl font-bold leading-tight text-[var(--heading)]">
              {topic.anchorArticle.title}
            </h2>
            <p className="mt-3 text-sm text-[var(--copy)]">
              {topic.anchorArticle.source}
            </p>
            <Link
              href={topic.anchorArticle.url}
              className="mt-5 inline-flex min-h-10 items-center border border-[var(--rule-strong)] px-4 font-mono text-xs font-semibold uppercase text-[var(--heading)] hover:border-[var(--accent)] hover:bg-[var(--surface)]"
            >
              Open source
            </Link>
          </section>
        </div>

        <div className="mt-10">
          <LockedPremiumPanel topic={topic} />
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
