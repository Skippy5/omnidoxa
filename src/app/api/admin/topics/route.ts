import { NextRequest } from "next/server";
import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import {
  attachMaterialUpdate,
  createDraftTopic,
  listAdminQueue,
} from "@/lib/admin-topics";
import type { ArticleMetadata } from "@/lib/article-fetcher";
import { hashUrl, normalizeTitle, normalizeUrl } from "@/lib/text-processing";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_768;

type ArticlePayload = ArticleMetadata & {
  urlHash: string;
};

type CreateTopicBody = {
  article?: Partial<ArticlePayload>;
  topic?: {
    title?: unknown;
    category?: unknown;
    centralDevelopment?: unknown;
  };
  duplicateDecision?: {
    action?: unknown;
    targetTopicId?: unknown;
  };
};

function assertSmallBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
}

function asArticlePayload(article: Partial<ArticlePayload> | undefined) {
  if (!article) {
    throw new Error("Article metadata is required.");
  }

  if (
    typeof article.title !== "string" ||
    typeof article.normalizedUrl !== "string" ||
    typeof article.source !== "string" ||
    typeof article.sourceHost !== "string" ||
    typeof article.fetchedAt !== "string"
  ) {
    throw new Error("Article metadata is incomplete.");
  }

  const normalizedUrl = normalizeUrl(article.normalizedUrl);
  const urlHash = hashUrl(normalizedUrl);

  if (article.urlHash !== urlHash) {
    throw new Error("Article URL hash does not match the normalized URL.");
  }

  return {
    title: normalizeTitle(article.title),
    url: normalizedUrl,
    normalizedUrl,
    urlHash,
    source: article.source,
    sourceHost: article.sourceHost,
    snippet: typeof article.snippet === "string" ? article.snippet : null,
    imageUrl: typeof article.imageUrl === "string" ? article.imageUrl : null,
    author: typeof article.author === "string" ? article.author : null,
    publishedAt: typeof article.publishedAt === "string" ? article.publishedAt : null,
    fetchedAt: article.fetchedAt,
  };
}

export async function GET() {
  try {
    await requireAdmin();

    return Response.json({
      topics: await listAdminQueue(),
    });
  } catch (error) {
    return adminAccessErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    assertSmallBody(request);

    const body = (await request.json()) as CreateTopicBody;
    const article = asArticlePayload(body.article);
    const action = body.duplicateDecision?.action;

    if (action === "attach_material_update") {
      const targetTopicId = body.duplicateDecision?.targetTopicId;

      if (typeof targetTopicId !== "string" || !targetTopicId) {
        return Response.json(
          { error: "A target Topic is required for Material Updates." },
          { status: 400 },
        );
      }

      const result = await attachMaterialUpdate({
        topicId: targetTopicId,
        article,
        description: body.topic?.centralDevelopment?.toString(),
      });

      return Response.json({
        action: "attached_material_update",
        result,
      });
    }

    if (action !== "create_new") {
      return Response.json(
        { error: "Choose whether to create a new Topic or attach a Material Update." },
        { status: 400 },
      );
    }

    if (
      typeof body.topic?.title !== "string" ||
      typeof body.topic?.category !== "string" ||
      typeof body.topic?.centralDevelopment !== "string" ||
      !body.topic.title.trim() ||
      !body.topic.centralDevelopment.trim()
    ) {
      return Response.json(
        { error: "Topic title, category, and Central Development are required." },
        { status: 400 },
      );
    }

    const result = await createDraftTopic({
      article,
      topic: {
        title: body.topic.title,
        category: body.topic.category,
        centralDevelopment: body.topic.centralDevelopment,
      },
    });

    return Response.json({
      action: "created_draft_topic",
      result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes("Admin") ||
        error.message.includes("configured") ||
        error.message.includes("rate limit")
      )
    ) {
      return adminAccessErrorResponse(error);
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not create Topic.",
      },
      {
        status: 400,
      },
    );
  }
}
