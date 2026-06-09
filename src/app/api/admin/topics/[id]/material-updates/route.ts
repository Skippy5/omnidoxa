import { NextRequest } from "next/server";
import {
  acquireAdminFetchSlot,
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { attachMaterialUpdate, buildArticlePreview } from "@/lib/admin-topics";
import { fetchArticleMetadata } from "@/lib/article-fetcher";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8_192;

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function assertSmallBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  let releaseFetchSlot: (() => void) | null = null;

  try {
    await requireAdmin();
    assertSmallBody(request);

    const { id } = await params;
    const body = (await request.json()) as {
      url?: unknown;
      description?: unknown;
    };

    if (typeof body.url !== "string" || !body.url.trim()) {
      return Response.json({ error: "A public article URL is required." }, { status: 400 });
    }

    releaseFetchSlot = acquireAdminFetchSlot();

    const metadata = await fetchArticleMetadata(body.url);
    const preview = await buildArticlePreview(metadata);
    const result = await attachMaterialUpdate({
      topicId: id,
      article: preview.article,
      description: typeof body.description === "string" ? body.description : null,
    });

    return Response.json({
      action: "attached_material_update",
      result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes("Admin") ||
        error.message.includes("configured") ||
        error.message.includes("rate limit") ||
        error.message.includes("progress")
      )
    ) {
      return adminAccessErrorResponse(error);
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not attach Material Update.",
      },
      {
        status: 400,
      },
    );
  } finally {
    releaseFetchSlot?.();
  }
}
