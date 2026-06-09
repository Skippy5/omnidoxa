import "server-only";

import { getDb } from "./db";
import { ensureTopicPlacementColumns } from "./topic-schema-guards";
import {
  hashUrl,
  normalizeTitle,
  proposeCentralDevelopment,
  slugify,
  titleFingerprint,
} from "./text-processing";
import type { ArticleMetadata } from "./article-fetcher";

const DEFAULT_CATEGORY = "Politics";
const DUPLICATE_LIMIT = 5;

export type DuplicateCandidate = {
  topicId: string;
  title: string;
  slug: string;
  status: string;
  centralDevelopment: string | null;
  anchorArticleTitle: string | null;
  anchorArticleUrl: string | null;
  matchReasons: string[];
  confidence: "exact_url" | "strong_title" | "weak_text";
};

export type ArticlePreview = {
  article: ArticleMetadata & {
    urlHash: string;
  };
  proposed: {
    topicTitle: string;
    slug: string;
    centralDevelopment: string;
    category: string;
  };
  duplicateCandidates: DuplicateCandidate[];
};

export type AdminQueueTopic = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  centralDevelopment: string | null;
  updatedAt: string;
  createdAt: string;
  anchorArticleTitle: string | null;
  anchorArticleUrl: string | null;
  anchorArticleSource: string | null;
  anchorImageUrl: string | null;
  materialUpdateCount: number;
  mainFeedEnabled: boolean;
  categoryFeedEnabled: boolean;
  isFeaturedMain: boolean;
  featuredAt: string | null;
};

export type TopicPlacementOptions = {
  mainFeedEnabled?: boolean;
  categoryFeedEnabled?: boolean;
  isFeaturedMain?: boolean;
};

type TopicRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  central_development: string | null;
  anchor_article_title: string | null;
  anchor_article_url: string | null;
};

function rowText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function rowNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
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

function asTopicRow(row: Record<string, unknown>): TopicRow {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    status: String(row.status),
    central_development: rowText(row.central_development),
    anchor_article_title: rowText(row.anchor_article_title),
    anchor_article_url: rowText(row.anchor_article_url),
  };
}

function asQueueTopic(row: Record<string, unknown>): AdminQueueTopic {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    status: String(row.status),
    category: rowText(row.category),
    centralDevelopment: rowText(row.central_development),
    updatedAt: String(row.updated_at),
    createdAt: String(row.created_at),
    anchorArticleTitle: rowText(row.anchor_article_title),
    anchorArticleUrl: rowText(row.anchor_article_url),
    anchorArticleSource: rowText(row.anchor_article_source),
    anchorImageUrl: rowText(row.anchor_image_url),
    materialUpdateCount: rowNumber(row.material_update_count),
    mainFeedEnabled: rowBoolean(row.main_feed_enabled, true),
    categoryFeedEnabled: rowBoolean(row.category_feed_enabled, true),
    isFeaturedMain: rowBoolean(row.is_featured_main),
    featuredAt: rowText(row.featured_at),
  };
}

function normalizePlacementOptions(options: TopicPlacementOptions = {}) {
  const mainFeedEnabled = options.mainFeedEnabled ?? true;
  const categoryFeedEnabled = options.categoryFeedEnabled ?? true;
  const isFeaturedMain = mainFeedEnabled && (options.isFeaturedMain ?? false);

  return {
    mainFeedEnabled,
    categoryFeedEnabled,
    isFeaturedMain,
  };
}

function placeholderNeutralSummary({
  title,
  centralDevelopment,
  anchorSnippet,
}: {
  title: string;
  centralDevelopment: string | null;
  anchorSnippet: string | null;
}) {
  return (
    centralDevelopment ||
    anchorSnippet ||
    `OmniDoxa is tracking ${title} from the submitted Anchor Article.`
  );
}

function placeholderDiscoursePreview() {
  return "Editorial analysis has not run yet. This published Topic is using a temporary free-layer placeholder while the full Left, Center, and Right analysis remains locked.";
}

function confidenceFromReasons(reasons: string[]) {
  if (reasons.includes("Exact normalized URL match")) {
    return "exact_url" as const;
  }

  if (reasons.includes("Similar normalized title")) {
    return "strong_title" as const;
  }

  return "weak_text" as const;
}

async function makeUniqueSlug(baseTitle: string) {
  const db = getDb();
  const baseSlug = slugify(baseTitle);

  for (let suffix = 0; suffix < 50; suffix += 1) {
    const slug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existing = await db.execute({
      sql: "SELECT id FROM topics WHERE slug = ? LIMIT 1",
      args: [slug],
    });

    if (existing.rows.length === 0) {
      return slug;
    }
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function buildArticlePreview(
  metadata: ArticleMetadata,
): Promise<ArticlePreview> {
  const topicTitle = normalizeTitle(metadata.title);
  const urlHash = hashUrl(metadata.normalizedUrl);
  const slug = await makeUniqueSlug(topicTitle);
  const duplicateCandidates = await findDuplicateCandidates({
    urlHash,
    title: topicTitle,
    source: metadata.source,
  });

  return {
    article: {
      ...metadata,
      urlHash,
    },
    proposed: {
      topicTitle,
      slug,
      centralDevelopment: proposeCentralDevelopment(topicTitle, metadata.snippet),
      category: DEFAULT_CATEGORY,
    },
    duplicateCandidates,
  };
}

export async function findDuplicateCandidates({
  urlHash,
  title,
  source,
}: {
  urlHash: string;
  title: string;
  source: string;
}) {
  const db = getDb();
  const fingerprint = titleFingerprint(title);
  const exactRows = await db.execute({
    sql: `
      SELECT
        t.id,
        t.title,
        t.slug,
        t.status,
        t.central_development,
        a.title AS anchor_article_title,
        a.url AS anchor_article_url
      FROM topic_articles a
      JOIN topics t ON t.id = a.topic_id
      WHERE a.url_hash = ?
      ORDER BY t.updated_at DESC
      LIMIT ?
    `,
    args: [urlHash, DUPLICATE_LIMIT],
  });
  const fuzzyRows = fingerprint
    ? await db.execute({
        sql: `
          SELECT
            t.id,
            t.title,
            t.slug,
            t.status,
            t.central_development,
            a.title AS anchor_article_title,
            a.url AS anchor_article_url
          FROM topic_articles a
          JOIN topics t ON t.id = a.topic_id
          WHERE lower(t.title) LIKE ?
             OR lower(a.title) LIKE ?
             OR lower(a.source) = lower(?)
          ORDER BY t.updated_at DESC
          LIMIT ?
        `,
        args: [`%${fingerprint.slice(0, 48)}%`, `%${fingerprint.slice(0, 48)}%`, source, DUPLICATE_LIMIT],
      })
    : { rows: [] };

  const candidates = new Map<string, DuplicateCandidate>();

  for (const rawRow of [...exactRows.rows, ...fuzzyRows.rows]) {
    const row = asTopicRow(rawRow as Record<string, unknown>);
    const reasons = candidates.get(row.id)?.matchReasons ?? [];

    if (exactRows.rows.includes(rawRow) && !reasons.includes("Exact normalized URL match")) {
      reasons.push("Exact normalized URL match");
    }

    const normalizedCandidateTitle = titleFingerprint(row.title);

    if (
      normalizedCandidateTitle &&
      fingerprint &&
      (
        normalizedCandidateTitle.includes(fingerprint.slice(0, 32)) ||
        fingerprint.includes(normalizedCandidateTitle.slice(0, 32))
      ) &&
      !reasons.includes("Similar normalized title")
    ) {
      reasons.push("Similar normalized title");
    }

    if (row.anchor_article_title && !reasons.includes("Same source or nearby article family")) {
      reasons.push("Same source or nearby article family");
    }

    candidates.set(row.id, {
      topicId: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      centralDevelopment: row.central_development,
      anchorArticleTitle: row.anchor_article_title,
      anchorArticleUrl: row.anchor_article_url,
      matchReasons: reasons,
      confidence: confidenceFromReasons(reasons),
    });
  }

  return Array.from(candidates.values()).slice(0, DUPLICATE_LIMIT);
}

export async function listAdminQueue() {
  await ensureTopicPlacementColumns();

  const db = getDb();
  const result = await db.execute(`
    SELECT
      t.id,
      t.title,
      t.slug,
      t.status,
      t.category,
      t.central_development,
      t.main_feed_enabled,
      t.category_feed_enabled,
      t.is_featured_main,
      t.featured_at,
      t.updated_at,
      t.created_at,
      anchor.title AS anchor_article_title,
      anchor.url AS anchor_article_url,
      anchor.source AS anchor_article_source,
      anchor.image_url AS anchor_image_url,
      COUNT(updates.id) AS material_update_count
    FROM topics t
    LEFT JOIN topic_articles anchor
      ON anchor.topic_id = t.id
     AND anchor.article_role = 'anchor'
    LEFT JOIN topic_articles updates
      ON updates.topic_id = t.id
     AND updates.article_role = 'material_update'
    WHERE t.status IN ('draft', 'review', 'pending_publish', 'published', 'archived', 'hidden')
    GROUP BY t.id
    ORDER BY
      CASE t.status
        WHEN 'draft' THEN 1
        WHEN 'review' THEN 2
        WHEN 'pending_publish' THEN 3
        WHEN 'published' THEN 4
        WHEN 'archived' THEN 5
        ELSE 5
      END,
      t.updated_at DESC
    LIMIT 50
  `);

  return result.rows.map((row) => asQueueTopic(row as Record<string, unknown>));
}

export async function createDraftTopic({
  article,
  topic,
}: {
  article: ArticleMetadata & { urlHash: string };
  topic: {
    title: string;
    category: string;
    centralDevelopment: string;
  };
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const topicId = crypto.randomUUID();
  const articleId = crypto.randomUUID();
  const slug = await makeUniqueSlug(topic.title);

  await db.batch(
    [
      {
        sql: `
          INSERT INTO topics (
            id,
            title,
            slug,
            central_development,
            neutral_summary,
            discourse_summary,
            discourse_preview,
            category,
            status,
            heat_score,
            discovery_sources,
            first_seen_at,
            last_updated_at,
            analysis_version,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, 'draft', 0, ?, ?, ?, 0, ?, ?)
        `,
        args: [
          topicId,
          normalizeTitle(topic.title),
          slug,
          topic.centralDevelopment.trim(),
          topic.category,
          JSON.stringify([{ type: "anchor_article", url: article.normalizedUrl }]),
          now,
          now,
          now,
          now,
        ],
      },
      {
        sql: `
          INSERT INTO topic_articles (
            id,
            topic_id,
            article_role,
            title,
            url,
            url_hash,
            source,
            source_tier,
            snippet,
            image_url,
            author,
            published_at,
            fetched_at,
            is_material_update,
            created_at
          )
          VALUES (?, ?, 'anchor', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 0, ?)
        `,
        args: [
          articleId,
          topicId,
          article.title,
          article.normalizedUrl,
          article.urlHash,
          article.source,
          article.snippet,
          article.imageUrl,
          article.author,
          article.publishedAt,
          article.fetchedAt,
          now,
        ],
      },
    ],
    "write",
  );

  return {
    id: topicId,
    slug,
  };
}

export async function attachMaterialUpdate({
  topicId,
  article,
  description,
}: {
  topicId: string;
  article: ArticleMetadata & { urlHash: string };
  description?: string | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const articleId = crypto.randomUUID();
  const updateId = crypto.randomUUID();

  await db.batch(
    [
      {
        sql: `
          INSERT INTO topic_articles (
            id,
            topic_id,
            article_role,
            title,
            url,
            url_hash,
            source,
            source_tier,
            snippet,
            image_url,
            author,
            published_at,
            fetched_at,
            is_material_update,
            created_at
          )
          VALUES (?, ?, 'material_update', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 1, ?)
        `,
        args: [
          articleId,
          topicId,
          article.title,
          article.normalizedUrl,
          article.urlHash,
          article.source,
          article.snippet,
          article.imageUrl,
          article.author,
          article.publishedAt,
          article.fetchedAt,
          now,
        ],
      },
      {
        sql: `
          INSERT INTO topic_updates (
            id,
            topic_id,
            update_type,
            description,
            source,
            detected_at
          )
          VALUES (?, ?, 'material_update', ?, ?, ?)
        `,
        args: [
          updateId,
          topicId,
          description?.trim() || article.title,
          article.normalizedUrl,
          now,
        ],
      },
      {
        sql: `
          UPDATE topics
          SET last_updated_at = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [now, now, topicId],
      },
    ],
    "write",
  );

  return {
    id: articleId,
    topicId,
  };
}

export async function publishTopic(
  topicId: string,
  placementOptions: TopicPlacementOptions = {},
) {
  await ensureTopicPlacementColumns();

  const db = getDb();
  const now = new Date().toISOString();
  const placement = normalizePlacementOptions(placementOptions);
  const topicResult = await db.execute({
    sql: `
      SELECT
        t.id,
        t.title,
        t.central_development,
        t.neutral_summary,
        t.discourse_summary,
        t.discourse_preview,
        t.heat_score,
        anchor.snippet AS anchor_snippet
      FROM topics t
      LEFT JOIN topic_articles anchor
        ON anchor.topic_id = t.id
       AND anchor.article_role = 'anchor'
      WHERE t.id = ?
      LIMIT 1
    `,
    args: [topicId],
  });
  const row = topicResult.rows[0] as Record<string, unknown> | undefined;

  if (!row) {
    throw new Error("Topic not found.");
  }

  const title = String(row.title);
  const centralDevelopment = rowText(row.central_development);
  const anchorSnippet = rowText(row.anchor_snippet);
  const neutralSummary =
    rowText(row.neutral_summary) ??
    placeholderNeutralSummary({
      title,
      centralDevelopment,
      anchorSnippet,
    });
  const discoursePreview =
    rowText(row.discourse_preview) ?? placeholderDiscoursePreview();
  const discourseSummary =
    rowText(row.discourse_summary) ?? placeholderDiscoursePreview();
  const heatScore = Math.max(rowNumber(row.heat_score), 36);
  const updateId = crypto.randomUUID();
  const batch: { sql: string; args: (string | number | null)[] }[] = [];

  if (placement.isFeaturedMain) {
    batch.push({
      sql: `
        UPDATE topics
        SET is_featured_main = 0, featured_at = NULL
        WHERE is_featured_main = 1
          AND id <> ?
      `,
      args: [topicId],
    });
  }

  batch.push(
    {
      sql: `
          UPDATE topics
          SET
            status = 'published',
            main_feed_enabled = ?,
            category_feed_enabled = ?,
            is_featured_main = ?,
            featured_at = ?,
            neutral_summary = ?,
            discourse_summary = ?,
            discourse_preview = ?,
            heat_score = ?,
            last_sentiment_at = COALESCE(last_sentiment_at, ?),
            last_updated_at = ?,
            updated_at = ?
          WHERE id = ?
        `,
      args: [
        placement.mainFeedEnabled ? 1 : 0,
        placement.categoryFeedEnabled ? 1 : 0,
        placement.isFeaturedMain ? 1 : 0,
        placement.isFeaturedMain ? now : null,
          neutralSummary,
          discourseSummary,
          discoursePreview,
          heatScore,
          now,
          now,
          now,
          topicId,
      ],
    },
    {
      sql: `
          INSERT INTO topic_updates (
            id,
            topic_id,
            update_type,
            description,
            source,
            detected_at
          )
          VALUES (?, ?, 'published', ?, NULL, ?)
        `,
      args: [
          updateId,
          topicId,
          placement.isFeaturedMain
            ? "Topic published and promoted as the main page story."
            : "Topic published with temporary free-layer placeholder analysis.",
          now,
      ],
    },
  );

  await db.batch(batch, "write");

  return {
    id: topicId,
    status: "published" as const,
    ...placement,
  };
}

export async function hideTopic(topicId: string) {
  await ensureTopicPlacementColumns();

  const db = getDb();
  const now = new Date().toISOString();
  const updateId = crypto.randomUUID();
  const existing = await db.execute({
    sql: "SELECT id FROM topics WHERE id = ? LIMIT 1",
    args: [topicId],
  });

  if (existing.rows.length === 0) {
    throw new Error("Topic not found.");
  }

  await db.batch(
    [
      {
        sql: `
          UPDATE topics
          SET
            status = 'hidden',
            is_featured_main = 0,
            featured_at = NULL,
            last_updated_at = ?,
            updated_at = ?
          WHERE id = ?
        `,
        args: [now, now, topicId],
      },
      {
        sql: `
          INSERT INTO topic_updates (
            id,
            topic_id,
            update_type,
            description,
            source,
            detected_at
          )
          VALUES (?, ?, 'hidden', ?, NULL, ?)
        `,
        args: [updateId, topicId, "Topic hidden from public pages.", now],
      },
    ],
    "write",
  );

  return {
    id: topicId,
    status: "hidden" as const,
  };
}

export async function archiveTopic(topicId: string) {
  await ensureTopicPlacementColumns();

  const db = getDb();
  const now = new Date().toISOString();
  const updateId = crypto.randomUUID();
  const existing = await db.execute({
    sql: "SELECT id FROM topics WHERE id = ? LIMIT 1",
    args: [topicId],
  });

  if (existing.rows.length === 0) {
    throw new Error("Topic not found.");
  }

  await db.batch(
    [
      {
        sql: `
          UPDATE topics
          SET
            status = 'archived',
            main_feed_enabled = 0,
            category_feed_enabled = 0,
            is_featured_main = 0,
            featured_at = NULL,
            last_updated_at = ?,
            updated_at = ?
          WHERE id = ?
        `,
        args: [now, now, topicId],
      },
      {
        sql: `
          INSERT INTO topic_updates (
            id,
            topic_id,
            update_type,
            description,
            source,
            detected_at
          )
          VALUES (?, ?, 'archived', ?, NULL, ?)
        `,
        args: [
          updateId,
          topicId,
          "Topic archived: removed from browse feeds but remains directly viewable.",
          now,
        ],
      },
    ],
    "write",
  );

  return {
    id: topicId,
    status: "archived" as const,
  };
}

export async function updateTopicPlacement(
  topicId: string,
  placementOptions: TopicPlacementOptions,
) {
  await ensureTopicPlacementColumns();

  const db = getDb();
  const now = new Date().toISOString();
  const placement = normalizePlacementOptions(placementOptions);
  const existing = await db.execute({
    sql: "SELECT id FROM topics WHERE id = ? LIMIT 1",
    args: [topicId],
  });

  if (existing.rows.length === 0) {
    throw new Error("Topic not found.");
  }

  const batch: { sql: string; args: (string | number | null)[] }[] = [];

  if (placement.isFeaturedMain) {
    batch.push({
      sql: `
        UPDATE topics
        SET is_featured_main = 0, featured_at = NULL
        WHERE is_featured_main = 1
          AND id <> ?
      `,
      args: [topicId],
    });
  }

  batch.push(
    {
      sql: `
        UPDATE topics
        SET
          main_feed_enabled = ?,
          category_feed_enabled = ?,
          is_featured_main = ?,
          featured_at = ?,
          last_updated_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      args: [
        placement.mainFeedEnabled ? 1 : 0,
        placement.categoryFeedEnabled ? 1 : 0,
        placement.isFeaturedMain ? 1 : 0,
        placement.isFeaturedMain ? now : null,
        now,
        now,
        topicId,
      ],
    },
    {
      sql: `
        INSERT INTO topic_updates (
          id,
          topic_id,
          update_type,
          description,
          source,
          detected_at
        )
        VALUES (?, ?, 'placement_updated', ?, NULL, ?)
      `,
      args: [
        crypto.randomUUID(),
        topicId,
        placement.isFeaturedMain
          ? "Topic promoted as the main page story."
          : "Topic public placement updated.",
        now,
      ],
    },
  );

  await db.batch(batch, "write");

  return {
    id: topicId,
    ...placement,
  };
}
