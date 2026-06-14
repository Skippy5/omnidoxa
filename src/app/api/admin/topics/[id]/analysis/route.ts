import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { getTopicAnalysisReview } from "@/lib/admin-topics";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();

    const { id } = await params;

    return Response.json({
      analysis: await getTopicAnalysisReview(id),
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
        error: error instanceof Error ? error.message : "Could not load analysis.",
      },
      {
        status: 400,
      },
    );
  }
}
