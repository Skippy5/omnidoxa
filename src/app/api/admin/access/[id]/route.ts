import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import { revokeAccessOverride } from "@/lib/access-overrides";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, { params }: RouteProps) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    return Response.json({
      access: await revokeAccessOverride({
        id,
        actorId: admin.adminId,
        actorEmail: admin.email,
      }),
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
          error instanceof Error ? error.message : "Could not revoke access.",
      },
      {
        status: 400,
      },
    );
  }
}
