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

  return (
    <main className="min-h-dvh bg-[var(--page)] text-foreground">
      <SiteNav />

      <article className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <Link
          href="/#topics"
          className="font-mono text-xs font-semibold uppercase text-[var(--accent)] hover:text-[var(--heading)]"
        >
          Back to Topics
        </Link>

        <div className="mt-7 grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative min-h-[300px] overflow-hidden border border-[var(--rule)] bg-[var(--surface)] shadow-[var(--shell-shadow)] sm:min-h-[460px]">
            <Image
              src={topic.image}
              alt={topic.imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="object-cover [filter:var(--image-filter)]"
            />
          </div>

          <header className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-semibold uppercase text-[var(--accent)]">
              <span>{topic.category}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span className="text-[var(--copy)]">{topic.updatedAt}</span>
              <span className="text-[var(--copy)]">{topic.readTime}</span>
            </div>

            <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.02] text-[var(--heading)] sm:text-5xl lg:text-6xl">
              {topic.title}
            </h1>

            <p className="mt-6 border-l-2 border-[var(--accent)] pl-5 text-base leading-8 text-[var(--copy)] sm:text-lg">
              {topic.centralDevelopment}
            </p>
          </header>
        </div>

        <div className="mt-10 grid gap-7 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="border border-[var(--rule)] bg-[var(--surface)] p-6 sm:p-7">
            <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
              Neutral Topic Summary
            </p>
            <p className="mt-4 text-lg leading-9 text-[var(--copy)]">
              {topic.neutralSummary}
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

        <section className="mt-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
              Discourse Preview
            </p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-[var(--heading)]">
              Viewpoint distribution
            </h2>
            <p className="mt-4 text-base leading-8 text-[var(--copy)]">
              {topic.discoursePreview}
            </p>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {topic.sentiment.map((sentiment) => (
              <SentimentCard
                key={`${topic.id}-${sentiment.lean}`}
                sentiment={sentiment}
              />
            ))}
          </div>
        </section>

        <div className="mt-10">
          <LockedPremiumPanel topic={topic} />
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
