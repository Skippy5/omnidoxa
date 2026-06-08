import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { LockedPremiumPanel } from "@/components/topics/locked-premium-panel";
import { TopicFeed } from "@/components/topics/topic-feed";
import { TopicHero } from "@/components/topics/topic-hero";
import { placeholderTopics } from "@/lib/placeholder-topics";

export default function Home() {
  const leadTopic = placeholderTopics[0];

  return (
    <main className="min-h-dvh bg-[var(--page)] text-foreground">
      <SiteNav />
      <TopicHero topic={leadTopic} />
      <TopicFeed topics={placeholderTopics} />

      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8 lg:px-10">
        <LockedPremiumPanel topic={leadTopic} />
      </section>

      <SiteFooter />
    </main>
  );
}
