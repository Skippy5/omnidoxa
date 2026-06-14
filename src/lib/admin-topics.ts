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
import {
  analyzeTopicWithGrok,
  GrokAnalysisError,
  type GrokSentimentAnalysis,
} from "./grok";

const DEFAULT_CATEGORY = "Politics";
const DUPLICATE_LIMIT = 5;
const EVIDENCE_THRESHOLD = 2;
const LEANS = ["left", "center", "right"] as const;

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
  analysisVersion: number;
  lastSentimentAt: string | null;
  analysisReviewStatus: string | null;
  candidatePostCount: number;
  verifiedPostCount: number;
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

type TopicAnalysisInputRow = {
  id: string;
  title: string;
  status: string;
  central_development: string | null;
  analysis_version: number | string | null;
};

type TopicArticleRow = {
  article_role: string;
  title: string;
  url: string;
  snippet: string | null;
  published_at: string | null;
};

export type AdminAnalysisPost = {
  id: string;
  lean: string;
  author: string | null;
  authorHandle: string | null;
  text: string;
  url: string;
  likes: number;
  retweets: number;
  reviewStatus: string;
  isVerified: boolean;
  postDate: string | null;
};

export type AdminAnalysisViewpoint = {
  id: string;
  lean: string;
  label: string | null;
  summary: string;
  sentimentScore: number | null;
  posts: AdminAnalysisPost[];
};

export type AdminTopicAnalysis = {
  topicId: string;
  status: string;
  analysisVersion: number;
  reviewStatus: string;
  neutralSummary: string | null;
  discourseSummary: string | null;
  discoursePreview: string | null;
  viewpoints: AdminAnalysisViewpoint[];
  threshold: {
    requiredPerLean: number;
    verifiedByLean: Record<string, number>;
    isSatisfied: boolean;
  };
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
    analysisVersion: rowNumber(row.analysis_version),
    lastSentimentAt: rowText(row.last_sentiment_at),
    analysisReviewStatus: rowText(row.analysis_review_status),
    candidatePostCount: rowNumber(row.candidate_post_count),
    verifiedPostCount: rowNumber(row.verified_post_count),
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
      t.analysis_version,
      t.last_sentiment_at,
      t.updated_at,
      t.created_at,
      anchor.title AS anchor_article_title,
      anchor.url AS anchor_article_url,
      anchor.source AS anchor_article_source,
      anchor.image_url AS anchor_image_url,
      analysis.review_status AS analysis_review_status,
      (
        SELECT COUNT(*)
        FROM topic_social_posts candidate_posts
        WHERE candidate_posts.topic_id = t.id
          AND candidate_posts.analysis_version = t.analysis_version
      ) AS candidate_post_count,
      (
        SELECT COUNT(*)
        FROM topic_social_posts verified_posts
        WHERE verified_posts.topic_id = t.id
          AND verified_posts.analysis_version = t.analysis_version
          AND verified_posts.review_status = 'verified'
          AND verified_posts.is_verified = 1
      ) AS verified_post_count,
      COUNT(updates.id) AS material_update_count
    FROM topics t
    LEFT JOIN topic_articles anchor
      ON anchor.topic_id = t.id
     AND anchor.article_role = 'anchor'
    LEFT JOIN topic_analysis_runs analysis
      ON analysis.topic_id = t.id
     AND analysis.analysis_version = t.analysis_version
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
        t.status,
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
  const status = String(row.status);

  if (status === "review") {
    throw new Error("Analysis review must satisfy the Evidence Threshold before publishing.");
  }

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

function asAnalysisInputRow(row: Record<string, unknown>): TopicAnalysisInputRow {
  return {
    id: String(row.id),
    title: String(row.title),
    status: String(row.status),
    central_development: rowText(row.central_development),
    analysis_version: row.analysis_version as number | string | null,
  };
}

function asArticleRow(row: Record<string, unknown>): TopicArticleRow {
  return {
    article_role: String(row.article_role),
    title: String(row.title),
    url: String(row.url),
    snippet: rowText(row.snippet),
    published_at: rowText(row.published_at),
  };
}

function analysisLabel(score: number) {
  if (score <= -0.45) {
    return "Critical";
  }

  if (score < -0.12) {
    return "Skeptical";
  }

  if (score <= 0.12) {
    return "Measured";
  }

  if (score < 0.45) {
    return "Cautiously Supportive";
  }

  return "Supportive";
}

async function loadTopicAnalysisInput(topicId: string) {
  const db = getDb();
  const topicResult = await db.execute({
    sql: `
      SELECT id, title, status, central_development, analysis_version
      FROM topics
      WHERE id = ?
      LIMIT 1
    `,
    args: [topicId],
  });
  const topicRow = topicResult.rows[0] as Record<string, unknown> | undefined;

  if (!topicRow) {
    throw new Error("Topic not found.");
  }

  const articleResult = await db.execute({
    sql: `
      SELECT article_role, title, url, snippet, published_at
      FROM topic_articles
      WHERE topic_id = ?
      ORDER BY
        CASE article_role
          WHEN 'anchor' THEN 1
          WHEN 'material_update' THEN 2
          ELSE 3
        END,
        created_at ASC
    `,
    args: [topicId],
  });
  const articles = articleResult.rows.map((row) =>
    asArticleRow(row as Record<string, unknown>),
  );
  const anchorArticle =
    articles.find((article) => article.article_role === "anchor") ?? articles[0];

  if (!anchorArticle) {
    throw new Error("Topic does not have an Anchor Article.");
  }

  return {
    topic: asAnalysisInputRow(topicRow),
    anchorArticle,
    materialUpdates: articles.filter(
      (article) => article.article_role === "material_update",
    ),
  };
}

function summarizeAnalysisRun(analysis: GrokSentimentAnalysis) {
  return {
    model: analysis.model,
    searchWindow: analysis.searchWindow,
    neutralTopicSummary: analysis.neutralTopicSummary,
    viewpointCounts: Object.fromEntries(
      analysis.viewpoints.map((viewpoint) => [
        viewpoint.lean,
        viewpoint.posts.length,
      ]),
    ),
  };
}

async function nextAnalysisVersion(topicId: string, currentVersion: unknown) {
  const result = await getDb().execute({
    sql: `
      SELECT COALESCE(MAX(analysis_version), ?) AS max_version
      FROM topic_analysis_runs
      WHERE topic_id = ?
    `,
    args: [rowNumber(currentVersion), topicId],
  });

  return rowNumber(result.rows[0]?.max_version) + 1;
}

async function storeRejectedAnalysisRun({
  topicId,
  analysisVersion,
  error,
}: {
  topicId: string;
  analysisVersion: number;
  error: GrokAnalysisError;
}) {
  const now = new Date().toISOString();

  await getDb().batch(
    [
      {
        sql: `
          INSERT INTO topic_analysis_runs (
            id,
            topic_id,
            analysis_version,
            provider,
            model,
            raw_response_json,
            review_status,
            created_at
          )
          VALUES (?, ?, ?, 'xai', ?, ?, 'rejected', ?)
        `,
        args: [
          crypto.randomUUID(),
          topicId,
          analysisVersion,
          error.model,
          JSON.stringify({
            error: error.message,
            rawResponse: error.rawResponse,
            searchWindow: error.searchWindow,
          }),
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
          VALUES (?, ?, 'sentiment_run_failed', ?, NULL, ?)
        `,
        args: [
          crypto.randomUUID(),
          topicId,
          `Grok analysis version ${analysisVersion} was rejected by validation: ${error.message}`,
          now,
        ],
      },
    ],
    "write",
  );
}

export async function runTopicAnalysis(topicId: string) {
  const db = getDb();
  const input = await loadTopicAnalysisInput(topicId);
  const now = new Date().toISOString();
  const nextVersion = await nextAnalysisVersion(
    topicId,
    input.topic.analysis_version,
  );
  const statusAfterRun =
    input.topic.status === "published" || input.topic.status === "archived"
      ? input.topic.status
      : "review";
  let analysis: GrokSentimentAnalysis;

  try {
    analysis = await analyzeTopicWithGrok({
      title: input.topic.title,
      centralDevelopment: input.topic.central_development,
      anchorArticle: {
        title: input.anchorArticle.title,
        url: input.anchorArticle.url,
        summary: input.anchorArticle.snippet,
        publishedAt: input.anchorArticle.published_at,
      },
      materialUpdates: input.materialUpdates.map((article) => ({
        title: article.title,
        url: article.url,
        summary: article.snippet,
        publishedAt: article.published_at,
      })),
    });
  } catch (error) {
    if (error instanceof GrokAnalysisError) {
      await storeRejectedAnalysisRun({
        topicId,
        analysisVersion: nextVersion,
        error,
      });

      throw new Error(
        `xAI returned data OmniDoxa could not store: ${error.message}. The raw response was saved as rejected analysis version ${nextVersion}.`,
      );
    }

    throw error;
  }

  const runId = crypto.randomUUID();
  const batch: { sql: string; args: (string | number | null)[] }[] = [
    {
      sql: `
        INSERT INTO topic_analysis_runs (
          id,
          topic_id,
          analysis_version,
          provider,
          model,
          raw_response_json,
          review_status,
          created_at
        )
        VALUES (?, ?, ?, 'xai', ?, ?, 'pending', ?)
      `,
      args: [
        runId,
        topicId,
        nextVersion,
        analysis.model,
        JSON.stringify({
          rawResponse: analysis.rawResponse,
          parsed: summarizeAnalysisRun(analysis),
        }),
        now,
      ],
    },
  ];

  for (const viewpoint of analysis.viewpoints) {
    batch.push({
      sql: `
        INSERT INTO topic_viewpoints (
          id,
          topic_id,
          lean,
          label,
          summary,
          original_summary,
          sentiment_score,
          analysis_version,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        topicId,
        viewpoint.lean,
        viewpoint.label || analysisLabel(viewpoint.sentimentScore),
        viewpoint.summary,
        viewpoint.summary,
        viewpoint.sentimentScore,
        nextVersion,
        now,
      ],
    });

    for (const post of viewpoint.posts) {
      batch.push({
        sql: `
          INSERT INTO topic_social_posts (
            id,
            topic_id,
            viewpoint_lean,
            author,
            author_handle,
            text,
            url,
            platform,
            likes,
            retweets,
            review_status,
            is_verified,
            post_date,
            analysis_version,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'x', ?, ?, 'candidate', 0, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          topicId,
          viewpoint.lean,
          post.author,
          post.authorHandle,
          post.text,
          post.url,
          post.likes,
          post.retweets,
          post.postDate,
          nextVersion,
          now,
        ],
      });
    }
  }

  batch.push(
    {
      sql: `
        UPDATE topics
        SET
          status = ?,
          analysis_version = ?,
          neutral_summary = ?,
          discourse_summary = ?,
          discourse_preview = ?,
          last_sentiment_at = ?,
          last_updated_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      args: [
        statusAfterRun,
        nextVersion,
        analysis.neutralTopicSummary,
        analysis.discourseSummary,
        analysis.discoursePreview,
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
        VALUES (?, ?, 'sentiment_run', ?, NULL, ?)
      `,
      args: [
        crypto.randomUUID(),
        topicId,
        `Grok analysis version ${nextVersion} stored for editorial review.`,
        now,
      ],
    },
  );

  await db.batch(batch, "write");

  return {
    topicId,
    analysisVersion: nextVersion,
    status: statusAfterRun,
    reviewStatus: "pending",
    neutralTopicSummary: analysis.neutralTopicSummary,
    viewpointCounts: Object.fromEntries(
      analysis.viewpoints.map((viewpoint) => [
        viewpoint.lean,
        viewpoint.posts.length,
      ]),
    ),
  };
}

function thresholdFromPosts(posts: AdminAnalysisPost[]) {
  const verifiedByLean = Object.fromEntries(
    LEANS.map((lean) => [lean, 0]),
  ) as Record<string, number>;

  for (const post of posts) {
    if (post.isVerified && post.reviewStatus === "verified") {
      verifiedByLean[post.lean] = (verifiedByLean[post.lean] ?? 0) + 1;
    }
  }

  return {
    requiredPerLean: EVIDENCE_THRESHOLD,
    verifiedByLean,
    isSatisfied: LEANS.every(
      (lean) => (verifiedByLean[lean] ?? 0) >= EVIDENCE_THRESHOLD,
    ),
  };
}

export async function getTopicAnalysisReview(
  topicId: string,
): Promise<AdminTopicAnalysis> {
  const db = getDb();
  const topicResult = await db.execute({
    sql: `
      SELECT
        t.id,
        t.status,
        t.analysis_version,
        t.neutral_summary,
        t.discourse_summary,
        t.discourse_preview,
        r.review_status
      FROM topics t
      JOIN topic_analysis_runs r
        ON r.topic_id = t.id
       AND r.analysis_version = t.analysis_version
      WHERE t.id = ?
      LIMIT 1
    `,
    args: [topicId],
  });
  const topic = topicResult.rows[0] as Record<string, unknown> | undefined;

  if (!topic) {
    throw new Error("Topic analysis not found.");
  }

  const analysisVersion = rowNumber(topic.analysis_version);
  const viewpointResult = await db.execute({
    sql: `
      SELECT
        id,
        lean,
        label,
        summary,
        sentiment_score
      FROM topic_viewpoints
      WHERE topic_id = ?
        AND analysis_version = ?
      ORDER BY
        CASE lean
          WHEN 'left' THEN 1
          WHEN 'center' THEN 2
          WHEN 'right' THEN 3
          ELSE 4
        END
    `,
    args: [topicId, analysisVersion],
  });
  const postResult = await db.execute({
    sql: `
      SELECT
        id,
        viewpoint_lean,
        author,
        author_handle,
        text,
        url,
        likes,
        retweets,
        review_status,
        is_verified,
        post_date
      FROM topic_social_posts
      WHERE topic_id = ?
        AND analysis_version = ?
      ORDER BY
        CASE viewpoint_lean
          WHEN 'left' THEN 1
          WHEN 'center' THEN 2
          WHEN 'right' THEN 3
          ELSE 4
        END,
        created_at ASC
    `,
    args: [topicId, analysisVersion],
  });
  const posts = postResult.rows.map((rawPost) => {
    const post = rawPost as Record<string, unknown>;

    return {
      id: String(post.id),
      lean: String(post.viewpoint_lean),
      author: rowText(post.author),
      authorHandle: rowText(post.author_handle),
      text: String(post.text),
      url: String(post.url),
      likes: rowNumber(post.likes),
      retweets: rowNumber(post.retweets),
      reviewStatus: String(post.review_status),
      isVerified: rowBoolean(post.is_verified),
      postDate: rowText(post.post_date),
    } satisfies AdminAnalysisPost;
  });

  return {
    topicId,
    status: String(topic.status),
    analysisVersion,
    reviewStatus: String(topic.review_status),
    neutralSummary: rowText(topic.neutral_summary),
    discourseSummary: rowText(topic.discourse_summary),
    discoursePreview: rowText(topic.discourse_preview),
    viewpoints: viewpointResult.rows.map((rawViewpoint) => {
      const viewpoint = rawViewpoint as Record<string, unknown>;
      const lean = String(viewpoint.lean);

      return {
        id: String(viewpoint.id),
        lean,
        label: rowText(viewpoint.label),
        summary: String(viewpoint.summary),
        sentimentScore:
          viewpoint.sentiment_score === null
            ? null
            : rowNumber(viewpoint.sentiment_score),
        posts: posts.filter((post) => post.lean === lean),
      } satisfies AdminAnalysisViewpoint;
    }),
    threshold: thresholdFromPosts(posts),
  };
}

export async function submitTopicAnalysisReview({
  topicId,
  neutralSummary,
  discourseSummary,
  discoursePreview,
  viewpointSummaries,
  verifiedPostIds,
}: {
  topicId: string;
  neutralSummary?: string;
  discourseSummary?: string;
  discoursePreview?: string;
  viewpointSummaries?: Record<string, string>;
  verifiedPostIds: string[];
}) {
  const current = await getTopicAnalysisReview(topicId);
  const db = getDb();
  const now = new Date().toISOString();
  const verified = new Set(verifiedPostIds);
  const validPostIds = new Set(
    current.viewpoints.flatMap((viewpoint) =>
      viewpoint.posts.map((post) => post.id),
    ),
  );
  const batch: { sql: string; args: (string | number | null)[] }[] = [];

  for (const postId of verified) {
    if (!validPostIds.has(postId)) {
      throw new Error("Review contains a Social Post that is not in this analysis.");
    }
  }

  batch.push({
    sql: `
      UPDATE topics
      SET
        neutral_summary = ?,
        discourse_summary = ?,
        discourse_preview = ?,
        updated_at = ?,
        last_updated_at = ?
      WHERE id = ?
    `,
    args: [
      neutralSummary?.trim() || current.neutralSummary,
      discourseSummary?.trim() || current.discourseSummary,
      discoursePreview?.trim() || current.discoursePreview,
      now,
      now,
      topicId,
    ],
  });

  for (const viewpoint of current.viewpoints) {
    const summary = viewpointSummaries?.[viewpoint.id]?.trim();

    if (summary) {
      batch.push({
        sql: `
          UPDATE topic_viewpoints
          SET summary = ?
          WHERE id = ?
            AND topic_id = ?
            AND analysis_version = ?
        `,
        args: [summary, viewpoint.id, topicId, current.analysisVersion],
      });
    }

    for (const post of viewpoint.posts) {
      const isVerified = verified.has(post.id);

      batch.push({
        sql: `
          UPDATE topic_social_posts
          SET review_status = ?, is_verified = ?
          WHERE id = ?
            AND topic_id = ?
            AND analysis_version = ?
        `,
        args: [
          isVerified ? "verified" : "rejected",
          isVerified ? 1 : 0,
          post.id,
          topicId,
          current.analysisVersion,
        ],
      });
    }
  }

  const reviewedPosts = current.viewpoints.flatMap((viewpoint) =>
    viewpoint.posts.map((post) => ({
      ...post,
      reviewStatus: verified.has(post.id) ? "verified" : "rejected",
      isVerified: verified.has(post.id),
    })),
  );
  const threshold = thresholdFromPosts(reviewedPosts);
  const reviewStatus = threshold.isSatisfied ? "approved" : "needs_revision";
  const topicStatus =
    current.status === "published" || current.status === "archived"
      ? current.status
      : threshold.isSatisfied
        ? "pending_publish"
        : "review";

  batch.push(
    {
      sql: `
        UPDATE topic_analysis_runs
        SET review_status = ?, reviewed_at = ?
        WHERE topic_id = ?
          AND analysis_version = ?
      `,
      args: [reviewStatus, now, topicId, current.analysisVersion],
    },
    {
      sql: `
        UPDATE topics
        SET status = ?, updated_at = ?, last_updated_at = ?
        WHERE id = ?
      `,
      args: [topicStatus, now, now, topicId],
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
        VALUES (?, ?, 'sentiment_review', ?, NULL, ?)
      `,
      args: [
        crypto.randomUUID(),
        topicId,
        threshold.isSatisfied
          ? "Analysis approved; Evidence Threshold satisfied."
          : "Analysis reviewed; Evidence Threshold still needs more verified posts.",
        now,
      ],
    },
  );

  await db.batch(batch, "write");

  return {
    topicId,
    analysisVersion: current.analysisVersion,
    reviewStatus,
    status: topicStatus,
    threshold,
  };
}
