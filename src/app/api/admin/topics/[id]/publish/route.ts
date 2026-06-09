import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { publishTopic } from "@/lib/admin-topics";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 4_096;

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function assertSmallBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
}

function booleanOrUndefined(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();
    assertSmallBody(request);

    const { id } = await params;
    const body = request.headers.get("content-length")
      ? ((await request.json()) as Record<string, unknown>)
      : {};
    const result = await publishTopic(id, {
      mainFeedEnabled: booleanOrUndefined(body.mainFeedEnabled),
      categoryFeedEnabled: booleanOrUndefined(body.categoryFeedEnabled),
      isFeaturedMain: booleanOrUndefined(body.isFeaturedMain),
    });

    return Response.json({
      action: "published_topic",
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
        error: error instanceof Error ? error.message : "Could not publish Topic.",
      },
      {
        status: 400,
      },
    );
  }
}
