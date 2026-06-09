import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { hideTopic } from "@/lib/admin-topics";

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
    const result = await hideTopic(id);

    return Response.json({
      action: "hidden_topic",
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
        error: error instanceof Error ? error.message : "Could not hide Topic.",
      },
      {
        status: 400,
      },
    );
  }
}
