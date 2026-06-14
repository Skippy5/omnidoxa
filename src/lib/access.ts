import "server-only";

import {
  applyAccessOverrideToMember,
  getActiveAccessOverrideByEmail,
} from "@/lib/access-overrides";
import { getDb } from "@/lib/db";
import { isConfiguredAdminEmail } from "@/lib/auth-config";
import {
  getOrCreateCurrentMember,
  requireMember,
  type CurrentMember,
} from "@/lib/auth";

export type AccessState = {
  member: CurrentMember | null;
  isMember: boolean;
  isSubscriber: boolean;
  isAdmin: boolean;
};

export async function hasActiveAdminGrant(memberId: string) {
  const result = await getDb().execute({
    sql: `
      SELECT id
      FROM admin_grants
      WHERE member_id = ?
        AND revoked_at IS NULL
      LIMIT 1
    `,
    args: [memberId],
  });

  return Boolean(result.rows[0]);
}

export async function ensureConfiguredAdminGrant(member: CurrentMember) {
  if (!isConfiguredAdminEmail(member.email)) {
    return;
  }

  await getDb().execute({
    sql: `
      INSERT INTO admin_grants (id, member_id, granted_by)
      SELECT ?, ?, 'OMNIDOXA_ADMIN_EMAILS'
      WHERE NOT EXISTS (
        SELECT 1
        FROM admin_grants
        WHERE member_id = ?
          AND revoked_at IS NULL
      )
    `,
    args: [crypto.randomUUID(), member.id, member.id],
  });
}

export async function getAccessState(): Promise<AccessState> {
  const member = await getOrCreateCurrentMember();

  if (!member) {
    return {
      member: null,
      isMember: false,
      isSubscriber: false,
      isAdmin: false,
    };
  }

  await ensureConfiguredAdminGrant(member);
  const override = await applyAccessOverrideToMember(member.id, member.email);
  const effectiveOverride =
    override ?? (await getActiveAccessOverrideByEmail(member.email));

  return {
    member,
    isMember: true,
    isSubscriber:
      member.isSubscriber || effectiveOverride?.subscriptionStatus === "subscriber",
    isAdmin: await hasActiveAdminGrant(member.id),
  };
}

export async function requireAdminMember() {
  let member: CurrentMember;

  try {
    member = await requireMember();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("configured")) {
      throw new Error("Admin access is not configured.");
    }

    if (message.includes("login")) {
      throw new Error("Admin login required.");
    }

    throw error;
  }

  await ensureConfiguredAdminGrant(member);
  await applyAccessOverrideToMember(member.id, member.email);

  if (!(await hasActiveAdminGrant(member.id))) {
    throw new Error("Admin access denied.");
  }

  return {
    member,
    adminId: member.id,
  };
}
