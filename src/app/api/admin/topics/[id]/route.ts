import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { deleteTopic } from "@/lib/admin-topics";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();

    const { id } = await params;
    const result = await deleteTopic(id);

    return Response.json({
      action: "deleted_topic",
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
        error: error instanceof Error ? error.message : "Could not delete Topic.",
      },
      {
        status: 400,
      },
    );
  }
}
