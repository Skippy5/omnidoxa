import "server-only";

import { requireAdminMember } from "@/lib/access";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const MAX_CONCURRENT_FETCHES = 2;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
let activeAdminFetches = 0;

export async function requireAdmin() {
  const { adminId, member } = await requireAdminMember();

  enforceRateLimit(`admin:${adminId}`);

  return {
    adminId,
    email: member.email,
  };
}

function enforceRateLimit(key: string) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  bucket.count += 1;

  if (bucket.count > RATE_LIMIT_MAX) {
    throw new Error("Admin request rate limit exceeded.");
  }
}

export function acquireAdminFetchSlot() {
  if (activeAdminFetches >= MAX_CONCURRENT_FETCHES) {
    throw new Error("Too many article fetches are already in progress.");
  }

  activeAdminFetches += 1;

  return () => {
    activeAdminFetches = Math.max(0, activeAdminFetches - 1);
  };
}

export function adminAccessErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Admin access denied.";

  return Response.json(
    {
      error: message,
    },
    {
      status: message.includes("rate limit")
        ? 429
        : message.includes("progress")
          ? 429
          : message.includes("configured")
            ? 503
            : 401,
    },
  );
}
