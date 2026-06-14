import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { runTopicAnalysis } from "@/lib/admin-topics";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();

    const { id } = await params;
    const result = await runTopicAnalysis(id);

    return Response.json({
      action: "analyzed_topic",
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
        error: error instanceof Error ? error.message : "Could not analyze Topic.",
      },
      {
        status: 400,
      },
    );
  }
}
