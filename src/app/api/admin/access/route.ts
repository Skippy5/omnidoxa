import { NextRequest } from "next/server";
import {
  adminAccessErrorResponse,
  requireAdmin,
} from "@/lib/admin-access";
import {
  listAccessOverrides,
  upsertAccessOverride,
  type AccessLevel,
} from "@/lib/access-overrides";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8_192;

function assertSmallBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
}

function requireAccessLevel(value: unknown): AccessLevel {
  if (value === "basic" || value === "premium") {
    return value;
  }

  throw new Error("Access level must be basic or premium.");
}

export async function GET() {
  try {
    await requireAdmin();

    return Response.json({
      access: await listAccessOverrides(),
    });
  } catch (error) {
    return adminAccessErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    assertSmallBody(request);

    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";
    const accessLevel = requireAccessLevel(body.accessLevel);
    const isAdmin = body.isAdmin === true;
    const notes = typeof body.notes === "string" ? body.notes : null;

    if (admin.email && admin.email === email.trim().toLowerCase() && !isAdmin) {
      throw new Error("You cannot remove your own Admin access.");
    }

    return Response.json({
      access: await upsertAccessOverride({
        email,
        accessLevel,
        isAdmin,
        notes,
        actorId: admin.adminId,
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
          error instanceof Error ? error.message : "Could not save access.",
      },
      {
        status: 400,
      },
    );
  }
}
