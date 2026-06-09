import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { archiveTopic } from "@/lib/admin-topics";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();

    const { id } = await params;
    const result = await archiveTopic(id);

    return Response.json({
      action: "archived_topic",
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
        error: error instanceof Error ? error.message : "Could not archive Topic.",
      },
      {
        status: 400,
      },
    );
  }
}
