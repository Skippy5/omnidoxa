import "server-only";

import { getDb } from "@/lib/db";
import type { SubscriptionStatus } from "@/lib/schema";

export type AccessLevel = "basic" | "premium";

export type AccessOverrideDto = {
  id: string;
  email: string;
  accessLevel: AccessLevel;
  subscriptionStatus: Extract<SubscriptionStatus, "free" | "subscriber">;
  isAdmin: boolean;
  notes: string | null;
  memberId: string | null;
  signedIn: boolean;
  activeMemberSubscriptionStatus: SubscriptionStatus | null;
  activeAdminGrant: boolean;
  updatedAt: string;
  createdAt: string;
};

const ADMIN_GRANT_PREFIX = "access_override:";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let ensureAccessOverrideSchemaPromise: Promise<void> | null = null;

export function normalizeAccessEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error("A valid email address is required.");
  }

  return normalized;
}

export function subscriptionStatusFromAccessLevel(
  accessLevel: unknown,
): Extract<SubscriptionStatus, "free" | "subscriber"> {
  return accessLevel === "premium" ? "subscriber" : "free";
}

export function accessLevelFromSubscriptionStatus(
  status: SubscriptionStatus,
): AccessLevel {
  return status === "subscriber" ? "premium" : "basic";
}

async function ensureAccessOverrideSchemaOnce() {
  await getDb().execute(`
    CREATE TABLE IF NOT EXISTS access_overrides (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      subscription_status TEXT DEFAULT 'free',
      is_admin INTEGER DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      revoked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await getDb().execute(
    "CREATE INDEX IF NOT EXISTS idx_access_overrides_email ON access_overrides(email)",
  );
  await getDb().execute(
    "CREATE INDEX IF NOT EXISTS idx_access_overrides_active ON access_overrides(revoked_at)",
  );
}

export async function ensureAccessOverrideSchema() {
  ensureAccessOverrideSchemaPromise ??= ensureAccessOverrideSchemaOnce().catch(
    (error) => {
      ensureAccessOverrideSchemaPromise = null;
      throw error;
    },
  );

  return ensureAccessOverrideSchemaPromise;
}

function mapAccessOverrideRow(row: Record<string, unknown>): AccessOverrideDto {
  const subscriptionStatus = String(
    row.subscription_status ?? "free",
  ) as SubscriptionStatus;

  return {
    id: String(row.id),
    email: String(row.email),
    accessLevel: accessLevelFromSubscriptionStatus(subscriptionStatus),
    subscriptionStatus:
      subscriptionStatus === "subscriber" ? "subscriber" : "free",
    isAdmin: Number(row.is_admin ?? 0) === 1,
    notes: typeof row.notes === "string" ? row.notes : null,
    memberId: typeof row.member_id === "string" ? row.member_id : null,
    signedIn: Boolean(row.member_id),
    activeMemberSubscriptionStatus:
      typeof row.member_subscription_status === "string"
        ? (row.member_subscription_status as SubscriptionStatus)
        : null,
    activeAdminGrant: Number(row.active_admin_grant ?? 0) === 1,
    updatedAt: String(row.updated_at),
    createdAt: String(row.created_at),
  };
}

export async function getActiveAccessOverrideByEmail(email: string) {
  await ensureAccessOverrideSchema();

  const normalizedEmail = normalizeAccessEmail(email);
  const result = await getDb().execute({
    sql: `
      SELECT id, email, subscription_status, is_admin, notes, created_at, updated_at
      FROM access_overrides
      WHERE email = ?
        AND revoked_at IS NULL
      LIMIT 1
    `,
    args: [normalizedEmail],
  });

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapAccessOverrideRow(row);
}

export async function applyAccessOverrideToMember(memberId: string, email: string) {
  const override = await getActiveAccessOverrideByEmail(email);

  if (!override) {
    return null;
  }

  if (override.isAdmin) {
    await getDb().execute({
      sql: `
        INSERT INTO admin_grants (id, member_id, granted_by)
        SELECT ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM admin_grants
          WHERE member_id = ?
            AND revoked_at IS NULL
        )
      `,
      args: [
        crypto.randomUUID(),
        memberId,
        `${ADMIN_GRANT_PREFIX}${override.email}`,
        memberId,
      ],
    });
  } else {
    await getDb().execute({
      sql: `
        UPDATE admin_grants
        SET revoked_at = datetime('now')
        WHERE member_id = ?
          AND revoked_at IS NULL
          AND granted_by LIKE ?
      `,
      args: [memberId, `${ADMIN_GRANT_PREFIX}%`],
    });
  }

  return override;
}

async function applyAccessOverrideToMatchingMembers(email: string) {
  const members = await getDb().execute({
    sql: `
      SELECT id
      FROM members
      WHERE lower(email) = ?
    `,
    args: [email],
  });

  for (const member of members.rows) {
    const memberId = String(member.id);

    await applyAccessOverrideToMember(memberId, email);
  }
}

export async function listAccessOverrides() {
  await ensureAccessOverrideSchema();

  const result = await getDb().execute(`
    SELECT
      access_overrides.id,
      access_overrides.email,
      access_overrides.subscription_status,
      access_overrides.is_admin,
      access_overrides.notes,
      access_overrides.created_at,
      access_overrides.updated_at,
      members.id AS member_id,
      members.subscription_status AS member_subscription_status,
      CASE
        WHEN members.id IS NULL THEN 0
        WHEN EXISTS (
          SELECT 1
          FROM admin_grants
          WHERE admin_grants.member_id = members.id
            AND admin_grants.revoked_at IS NULL
        ) THEN 1
        ELSE 0
      END AS active_admin_grant
    FROM access_overrides
    LEFT JOIN members
      ON lower(members.email) = access_overrides.email
    WHERE access_overrides.revoked_at IS NULL
    ORDER BY access_overrides.updated_at DESC
  `);

  return result.rows.map((row) =>
    mapAccessOverrideRow(row as Record<string, unknown>),
  );
}

export async function upsertAccessOverride({
  email,
  accessLevel,
  isAdmin,
  notes,
  actorId,
}: {
  email: string;
  accessLevel: AccessLevel;
  isAdmin: boolean;
  notes?: string | null;
  actorId: string;
}) {
  await ensureAccessOverrideSchema();

  const normalizedEmail = normalizeAccessEmail(email);
  const subscriptionStatus = subscriptionStatusFromAccessLevel(accessLevel);
  const trimmedNotes = notes?.trim() ? notes.trim().slice(0, 500) : null;
  const existing = await getDb().execute({
    sql: "SELECT id FROM access_overrides WHERE email = ? LIMIT 1",
    args: [normalizedEmail],
  });
  const existingId = existing.rows[0]?.id;

  if (typeof existingId === "string") {
    await getDb().execute({
      sql: `
        UPDATE access_overrides
        SET subscription_status = ?,
            is_admin = ?,
            notes = ?,
            updated_by = ?,
            revoked_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        subscriptionStatus,
        isAdmin ? 1 : 0,
        trimmedNotes,
        actorId,
        existingId,
      ],
    });
  } else {
    await getDb().execute({
      sql: `
        INSERT INTO access_overrides (
          id,
          email,
          subscription_status,
          is_admin,
          notes,
          created_by,
          updated_by,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      args: [
        crypto.randomUUID(),
        normalizedEmail,
        subscriptionStatus,
        isAdmin ? 1 : 0,
        trimmedNotes,
        actorId,
        actorId,
      ],
    });
  }

  await applyAccessOverrideToMatchingMembers(normalizedEmail);

  const override = await getActiveAccessOverrideByEmail(normalizedEmail);

  if (!override) {
    throw new Error("Access override could not be saved.");
  }

  return override;
}

export async function revokeAccessOverride({
  id,
  actorId,
  actorEmail,
}: {
  id: string;
  actorId: string;
  actorEmail?: string | null;
}) {
  await ensureAccessOverrideSchema();

  const existing = await getDb().execute({
    sql: `
      SELECT id, email, is_admin
      FROM access_overrides
      WHERE id = ?
        AND revoked_at IS NULL
      LIMIT 1
    `,
    args: [id],
  });
  const row = existing.rows[0];

  if (!row) {
    throw new Error("Access override was not found.");
  }

  const email = String(row.email);
  const isAdmin = Number(row.is_admin ?? 0) === 1;

  if (actorEmail && actorEmail === email && isAdmin) {
    throw new Error("You cannot remove your own Admin access.");
  }

  await getDb().execute({
    sql: `
      UPDATE access_overrides
      SET revoked_at = datetime('now'),
          updated_by = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [actorId, id],
  });

  const members = await getDb().execute({
    sql: "SELECT id FROM members WHERE lower(email) = ?",
    args: [email],
  });

  for (const member of members.rows) {
    await getDb().execute({
      sql: `
        UPDATE admin_grants
        SET revoked_at = datetime('now')
        WHERE member_id = ?
          AND revoked_at IS NULL
          AND granted_by LIKE ?
      `,
      args: [String(member.id), `${ADMIN_GRANT_PREFIX}%`],
    });
  }

  return {
    id,
    email,
  };
}
