import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { isClerkConfigured } from "@/lib/auth-config";
import type { Member, SubscriptionStatus } from "@/lib/schema";

export type CurrentMember = Member & {
  isSubscriber: boolean;
};

type ClerkIdentity = {
  clerkUserId: string;
  email: string;
};

export async function getCurrentClerkIdentity(): Promise<ClerkIdentity | null> {
  if (!isClerkConfigured()) {
    return null;
  }

  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await currentUser();

  if (!user) {
    return null;
  }

  const primaryEmail =
    user.primaryEmailAddress?.verification?.status === "verified"
      ? user.primaryEmailAddress.emailAddress
      : user.emailAddresses.find(
          (emailAddress) =>
            emailAddress.emailAddress &&
            emailAddress.verification?.status === "verified",
        )?.emailAddress;

  if (!primaryEmail) {
    throw new Error("Signed-in account needs a verified email address.");
  }

  return {
    clerkUserId: user.id,
    email: primaryEmail.toLowerCase(),
  };
}

function mapMemberRow(row: Record<string, unknown>): CurrentMember {
  const subscriptionStatus = String(
    row.subscription_status ?? "free",
  ) as SubscriptionStatus;

  return {
    id: String(row.id),
    clerkUserId: String(row.clerk_user_id),
    email: String(row.email),
    subscriptionStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    isSubscriber: subscriptionStatus === "subscriber",
  };
}

export async function getOrCreateCurrentMember() {
  const identity = await getCurrentClerkIdentity();

  if (!identity) {
    return null;
  }

  const db = getDb();

  await db.execute({
    sql: `
      INSERT INTO members (id, clerk_user_id, email, subscription_status, updated_at)
      VALUES (?, ?, ?, 'free', datetime('now'))
      ON CONFLICT(clerk_user_id) DO UPDATE SET
        email = excluded.email,
        updated_at = datetime('now')
    `,
    args: [crypto.randomUUID(), identity.clerkUserId, identity.email],
  });

  const member = await db.execute({
    sql: `
      SELECT id, clerk_user_id, email, subscription_status, created_at, updated_at
      FROM members
      WHERE clerk_user_id = ?
      LIMIT 1
    `,
    args: [identity.clerkUserId],
  });

  const row = member.rows[0];

  if (!row) {
    throw new Error("Could not load OmniDoxa member profile.");
  }

  return mapMemberRow(row);
}

export async function requireMember() {
  if (!isClerkConfigured()) {
    throw new Error("Member login is not configured.");
  }

  const member = await getOrCreateCurrentMember();

  if (!member) {
    throw new Error("Member login required.");
  }

  return member;
}
