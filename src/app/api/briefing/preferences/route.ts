import { NextRequest } from "next/server";
import {
  getBriefingPreferences,
  saveBriefingPreferences,
} from "@/lib/briefing-preferences";
import { requireMember } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 12_288;

function assertSmallBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
}

function preferenceErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Briefing preferences failed.";

  return Response.json(
    {
      error: message,
    },
    {
      status: message.includes("configured")
        ? 503
        : message.includes("login")
          ? 401
          : 400,
    },
  );
}

export async function GET() {
  try {
    const member = await requireMember();

    return Response.json({
      preferences: await getBriefingPreferences(member.id),
    });
  } catch (error) {
    return preferenceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSmallBody(request);

    const member = await requireMember();
    const body = (await request.json()) as Record<string, unknown>;

    return Response.json({
      preferences: await saveBriefingPreferences(member.id, body),
    });
  } catch (error) {
    return preferenceErrorResponse(error);
  }
}
