import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { updateTopicPlacement } from "@/lib/admin-topics";

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

function requireBoolean(value: unknown, name: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be a boolean.`);
  }

  return value;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();
    assertSmallBody(request);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const result = await updateTopicPlacement(id, {
      mainFeedEnabled: requireBoolean(body.mainFeedEnabled, "mainFeedEnabled"),
      categoryFeedEnabled: requireBoolean(
        body.categoryFeedEnabled,
        "categoryFeedEnabled",
      ),
      isFeaturedMain: requireBoolean(body.isFeaturedMain, "isFeaturedMain"),
    });

    return Response.json({
      action: "updated_topic_placement",
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
        error:
          error instanceof Error ? error.message : "Could not update placement.",
      },
      {
        status: 400,
      },
    );
  }
}
