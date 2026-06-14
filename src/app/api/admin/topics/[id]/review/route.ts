import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { submitTopicAnalysisReview } from "@/lib/admin-topics";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 65_536;

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

type ReviewBody = {
  neutralSummary?: unknown;
  discourseSummary?: unknown;
  discoursePreview?: unknown;
  viewpointSummaries?: unknown;
  verifiedPostIds?: unknown;
};

function assertSmallBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function viewpointSummaries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();
    assertSmallBody(request);

    const { id } = await params;
    const body = (await request.json()) as ReviewBody;
    const verifiedPostIds = Array.isArray(body.verifiedPostIds)
      ? body.verifiedPostIds.filter(
          (postId): postId is string => typeof postId === "string",
        )
      : [];
    const result = await submitTopicAnalysisReview({
      topicId: id,
      neutralSummary: stringOrUndefined(body.neutralSummary),
      discourseSummary: stringOrUndefined(body.discourseSummary),
      discoursePreview: stringOrUndefined(body.discoursePreview),
      viewpointSummaries: viewpointSummaries(body.viewpointSummaries),
      verifiedPostIds,
    });

    return Response.json({
      action: "reviewed_analysis",
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
        error: error instanceof Error ? error.message : "Could not review analysis.",
      },
      {
        status: 400,
      },
    );
  }
}
