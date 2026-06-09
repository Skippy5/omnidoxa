import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { LockedPremiumPanel } from "@/components/topics/locked-premium-panel";
import { TopicFeed } from "@/components/topics/topic-feed";
import { TopicHero } from "@/components/topics/topic-hero";
import { getFeaturedMainTopic, listPublishedTopics } from "@/lib/public-topics";

type HomeProps = {
  searchParams?: Promise<{
    category?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const activeCategory = params?.category;
  const visibleTopics = await listPublishedTopics({
    category: activeCategory,
    placement: activeCategory ? "category" : "main",
  });
  const featuredTopic = activeCategory ? null : await getFeaturedMainTopic();
  const leadTopic = featuredTopic ?? visibleTopics[0] ?? null;

  return (
    <main className="min-h-dvh bg-[var(--page)] text-foreground">
      <SiteNav />
      {leadTopic ? (
        <TopicHero topic={leadTopic} />
      ) : (
        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
            Topic Index
          </p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl font-bold leading-tight text-[var(--heading)] sm:text-6xl">
            No published Topics yet.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[var(--copy)]">
            Publish a Topic from the Admin queue to place it on the main page or
            in its category feed.
          </p>
        </section>
      )}
      <TopicFeed topics={visibleTopics} activeCategory={activeCategory} />

      {leadTopic ? (
        <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8 lg:px-10">
          <LockedPremiumPanel topic={leadTopic} />
        </section>
      ) : null}

      <SiteFooter />
    </main>
  );
}
