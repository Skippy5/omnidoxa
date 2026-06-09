import "server-only";

import { getDb } from "./db";
import { ensureTopicPlacementColumns } from "./topic-schema-guards";
import type {
  LockedSocialPostPreview,
  PublicTopic,
  SentimentSnapshot,
} from "./topic-types";

const CATEGORY_ASSETS: Record<string, Pick<PublicTopic, "image" | "imageAlt">> = {
  Politics: {
    image: "/editorial/politics.png",
    imageAlt: "Monochrome editorial image of a capitol building",
  },
  "Tech & AI": {
    image: "/editorial/technology.png",
    imageAlt: "Monochrome editorial portrait representing artificial intelligence",
  },
  World: {
    image: "/editorial/global.png",
    imageAlt: "Monochrome editorial image of planet Earth",
  },
};

const DEFAULT_ASSET = CATEGORY_ASSETS.Politics;

type PublishedTopicRow = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  central_development: string | null;
  neutral_summary: string | null;
  discourse_preview: string | null;
  heat_score: number | string | null;
  main_feed_enabled: number | string | null;
  category_feed_enabled: number | string | null;
  is_featured_main: number | string | null;
  featured_at: string | null;
  last_updated_at: string;
  anchor_article_title: string | null;
  anchor_article_url: string | null;
  anchor_article_source: string | null;
  anchor_image_url: string | null;
};

type SentimentRow = {
  lean: string;
  label: string | null;
  sentiment_score: number | string | null;
  verified_count: number | string | null;
};

const LEAN_LABELS = ["Left", "Center", "Right"] as const;

function rowText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function rowNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value ?? fallback);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function rowBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true";
  }

  return fallback;
}

function estimateReadTime(topic: PublishedTopicRow) {
  const wordCount = [
    topic.title,
    topic.central_development,
    topic.neutral_summary,
    topic.discourse_preview,
  ]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  return `${Math.max(2, Math.ceil(wordCount / 180))} min read`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours >= 0 && diffHours < 24) {
    return `Updated ${Math.max(1, diffHours)}h ago`;
  }

  return `Updated ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date)}`;
}

function fallbackNeutralSummary(row: PublishedTopicRow) {
  return (
    row.neutral_summary ??
    row.central_development ??
    `OmniDoxa is tracking ${row.title} from the submitted Anchor Article.`
  );
}

function fallbackDiscoursePreview(row: PublishedTopicRow) {
  return (
    row.discourse_preview ??
    "Editorial analysis has not run yet. This published Topic is using a temporary free-layer placeholder while the full Left, Center, and Right analysis remains locked."
  );
}

function sentimentLabel(score: number) {
  if (score <= -0.45) {
    return "Critical";
  }

  if (score < -0.12) {
    return "Skeptical";
  }

  if (score <= 0.12) {
    return "Pending";
  }

  if (score < 0.45) {
    return "Measured";
  }

  return "Supportive";
}

function placeholderSummary(lean: string) {
  return `${lean} analysis is pending editorial review.`;
}

function mapSentimentRows(rows: SentimentRow[]): SentimentSnapshot[] {
  return LEAN_LABELS.map((leanLabel) => {
    const row = rows.find(
      (candidate) => candidate.lean.toLowerCase() === leanLabel.toLowerCase(),
    );
    const score = rowNumber(row?.sentiment_score, 0);

    return {
      lean: leanLabel,
      score,
      label: rowText(row?.label) ?? sentimentLabel(score),
      summary: placeholderSummary(leanLabel),
      evidenceCount: rowNumber(row?.verified_count, 0),
    };
  });
}

function lockedPostsFromSentiment(
  sentiment: SentimentSnapshot[],
): LockedSocialPostPreview[] {
  return sentiment.map((snapshot) => ({
    lean: snapshot.lean,
    platform: "X",
    sourceLabel:
      snapshot.evidenceCount > 0
        ? "Verified evidence locked"
        : "Evidence pending review",
    evidenceCount: snapshot.evidenceCount,
  }));
}

function mapTopicRow(row: PublishedTopicRow, sentimentRows: SentimentRow[]) {
  const category = row.category ?? "Politics";
  const categoryImage = CATEGORY_ASSETS[category] ?? DEFAULT_ASSET;
  const articleImage = rowText(row.anchor_image_url);
  const image = articleImage ?? categoryImage.image;
  const imageAlt = articleImage
    ? `Image from ${row.anchor_article_source ?? "the Anchor Article"} for ${row.title}`
    : categoryImage.imageAlt;
  const sentiment = mapSentimentRows(sentimentRows);

  return {
    id: row.id,
    slug: row.slug,
    category,
    title: row.title,
    kicker: row.anchor_article_source ?? "OmniDoxa",
    updatedAt: formatUpdatedAt(row.last_updated_at),
    readTime: estimateReadTime(row),
    heatScore: rowNumber(row.heat_score, 0),
    image,
    imageAlt,
    heroImage: image,
    heroImageAlt: imageAlt,
    centralDevelopment:
      row.central_development ??
      `OmniDoxa is tracking the central development behind ${row.title}.`,
    neutralSummary: fallbackNeutralSummary(row),
    discoursePreview: fallbackDiscoursePreview(row),
    anchorArticle: {
      title: row.anchor_article_title ?? row.title,
      source: row.anchor_article_source ?? "Anchor Article",
      url: row.anchor_article_url ?? "#",
    },
    sentiment,
    lockedSocialPosts: lockedPostsFromSentiment(sentiment),
  } satisfies PublicTopic;
}

function canUseDatabase(error: unknown) {
  return !(
    error instanceof Error &&
    error.message.includes("Missing required environment variable")
  );
}

async function getSentimentsByTopicIds(topicIds: string[]) {
  if (topicIds.length === 0) {
    return new Map<string, SentimentRow[]>();
  }

  const db = getDb();
  const placeholders = topicIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `
      SELECT
        v.topic_id,
        v.lean,
        v.label,
        v.sentiment_score,
        COUNT(p.id) AS verified_count
      FROM topic_viewpoints v
      JOIN topics current_topic
        ON current_topic.id = v.topic_id
       AND current_topic.analysis_version = v.analysis_version
      JOIN topic_analysis_runs approved_run
        ON approved_run.topic_id = v.topic_id
       AND approved_run.analysis_version = v.analysis_version
       AND approved_run.review_status = 'approved'
      LEFT JOIN topic_social_posts p
        ON p.topic_id = v.topic_id
       AND p.viewpoint_lean = v.lean
       AND p.analysis_version = v.analysis_version
       AND p.review_status = 'verified'
       AND p.is_verified = 1
      WHERE v.topic_id IN (${placeholders})
      GROUP BY v.topic_id, v.lean, v.label, v.sentiment_score
    `,
    args: topicIds,
  });

  const byTopic = new Map<string, SentimentRow[]>();

  for (const rawRow of result.rows) {
    const row = rawRow as Record<string, unknown>;
    const topicId = String(row.topic_id);
    const rows = byTopic.get(topicId) ?? [];

    rows.push({
      lean: String(row.lean),
      label: rowText(row.label),
      sentiment_score: row.sentiment_score as number | string | null,
      verified_count: row.verified_count as number | string | null,
    });
    byTopic.set(topicId, rows);
  }

  return byTopic;
}

export async function listPublishedTopics({
  category,
  placement = "all",
}: {
  category?: string;
  placement?: "all" | "main" | "category";
} = {}) {
  try {
    await ensureTopicPlacementColumns();

    const db = getDb();
    const placementFilter =
      placement === "main"
        ? "AND t.main_feed_enabled = 1"
        : placement === "category"
          ? "AND t.category_feed_enabled = 1"
          : "";
    const result = await db.execute({
      sql: `
        SELECT
          t.id,
          t.title,
          t.slug,
          t.category,
          t.central_development,
          t.neutral_summary,
          t.discourse_preview,
          t.heat_score,
          t.main_feed_enabled,
          t.category_feed_enabled,
          t.is_featured_main,
          t.featured_at,
          t.last_updated_at,
          anchor.title AS anchor_article_title,
          anchor.url AS anchor_article_url,
          anchor.source AS anchor_article_source,
          anchor.image_url AS anchor_image_url
        FROM topics t
        LEFT JOIN topic_articles anchor
          ON anchor.topic_id = t.id
         AND anchor.article_role = 'anchor'
        WHERE t.status = 'published'
          AND (? IS NULL OR t.category = ?)
          ${placementFilter}
        ORDER BY
          t.is_featured_main DESC,
          t.featured_at DESC,
          t.heat_score DESC,
          t.last_updated_at DESC
        LIMIT 24
      `,
      args: [category ?? null, category ?? null],
    });
    const rows = result.rows as unknown as PublishedTopicRow[];
    const sentimentsByTopic = await getSentimentsByTopicIds(
      rows.map((row) => row.id),
    );

    return rows.map((row) => mapTopicRow(row, sentimentsByTopic.get(row.id) ?? []));
  } catch (error) {
    if (canUseDatabase(error)) {
      console.error("Could not load published Topics.", error);
    }

    return [];
  }
}

export async function getPublicTopicBySlug(slug: string) {
  try {
    await ensureTopicPlacementColumns();

    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT
          t.id,
          t.title,
          t.slug,
          t.category,
          t.central_development,
          t.neutral_summary,
          t.discourse_preview,
          t.heat_score,
          t.main_feed_enabled,
          t.category_feed_enabled,
          t.is_featured_main,
          t.featured_at,
          t.last_updated_at,
          anchor.title AS anchor_article_title,
          anchor.url AS anchor_article_url,
          anchor.source AS anchor_article_source,
          anchor.image_url AS anchor_image_url
        FROM topics t
        LEFT JOIN topic_articles anchor
          ON anchor.topic_id = t.id
         AND anchor.article_role = 'anchor'
        WHERE t.status IN ('published', 'archived')
          AND t.slug = ?
        LIMIT 1
      `,
      args: [slug],
    });
    const row = result.rows[0] as unknown as PublishedTopicRow | undefined;

    if (!row) {
      return null;
    }

    const sentimentsByTopic = await getSentimentsByTopicIds([row.id]);

    return mapTopicRow(row, sentimentsByTopic.get(row.id) ?? []);
  } catch (error) {
    if (canUseDatabase(error)) {
      console.error("Could not load public Topic.", error);
    }

    return null;
  }
}

export const getPublishedTopicBySlug = getPublicTopicBySlug;

export async function getFeaturedMainTopic() {
  try {
    await ensureTopicPlacementColumns();

    const db = getDb();
    const result = await db.execute(`
      SELECT
        t.id,
        t.title,
        t.slug,
        t.category,
        t.central_development,
        t.neutral_summary,
        t.discourse_preview,
        t.heat_score,
        t.main_feed_enabled,
        t.category_feed_enabled,
        t.is_featured_main,
        t.featured_at,
        t.last_updated_at,
        anchor.title AS anchor_article_title,
        anchor.url AS anchor_article_url,
        anchor.source AS anchor_article_source,
        anchor.image_url AS anchor_image_url
      FROM topics t
      LEFT JOIN topic_articles anchor
        ON anchor.topic_id = t.id
       AND anchor.article_role = 'anchor'
      WHERE t.status = 'published'
        AND t.main_feed_enabled = 1
        AND t.is_featured_main = 1
      ORDER BY t.featured_at DESC, t.last_updated_at DESC
      LIMIT 1
    `);
    const row = result.rows[0] as unknown as PublishedTopicRow | undefined;

    if (!row || !rowBoolean(row.is_featured_main)) {
      return null;
    }

    const sentimentsByTopic = await getSentimentsByTopicIds([row.id]);

    return mapTopicRow(row, sentimentsByTopic.get(row.id) ?? []);
  } catch (error) {
    if (canUseDatabase(error)) {
      console.error("Could not load featured Topic.", error);
    }

    return null;
  }
}
