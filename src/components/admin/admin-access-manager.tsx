"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";

type AccessLevel = "basic" | "premium";

type AccessOverride = {
  id: string;
  email: string;
  accessLevel: AccessLevel;
  subscriptionStatus: "free" | "subscriber";
  isAdmin: boolean;
  notes: string | null;
  memberId: string | null;
  signedIn: boolean;
  activeMemberSubscriptionStatus: string | null;
  activeAdminGrant: boolean;
  updatedAt: string;
  createdAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function accessLabel(access: AccessOverride) {
  const labels = [
    access.accessLevel === "premium" ? "Free Premium" : "Basic",
  ];

  if (access.isAdmin) {
    labels.push("Admin");
  }

  return labels.join(" + ");
}

export function AdminAccessManager() {
  const [accessList, setAccessList] = useState<AccessOverride[]>([]);
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("basic");
  const [isAdmin, setIsAdmin] = useState(false);
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function readJsonResponse<T>(response: Response): Promise<T> {
    const data = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Request failed.");
    }

    return data;
  }

  const loadAccess = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJsonResponse<{ access: AccessOverride[] }>(
        await fetch("/api/admin/access"),
      );

      setAccessList(data.access);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Access list failed to load.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccess();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAccess]);

  function resetForm() {
    setEmail("");
    setAccessLevel("basic");
    setIsAdmin(false);
    setNotes("");
    setEditingId(null);
  }

  function editAccess(access: AccessOverride) {
    setEmail(access.email);
    setAccessLevel(access.accessLevel);
    setIsAdmin(access.isAdmin);
    setNotes(access.notes ?? "");
    setEditingId(access.id);
    setMessage(null);
    setError(null);
  }

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      await readJsonResponse<{ access: AccessOverride }>(
        await fetch("/api/admin/access", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email,
            accessLevel,
            isAdmin,
            notes,
          }),
        }),
      );

      setMessage(
        editingId
          ? "Access updated."
          : "Access saved. The grant will apply when the email signs in.",
      );
      resetForm();
      await loadAccess();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save access.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function revokeAccess(access: AccessOverride) {
    setMutatingId(access.id);
    setMessage(null);
    setError(null);

    try {
      await readJsonResponse(
        await fetch(`/api/admin/access/${access.id}`, {
          method: "DELETE",
        }),
      );

      if (editingId === access.id) {
        resetForm();
      }

      setMessage("Access revoked.");
      await loadAccess();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Could not revoke access.",
      );
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:px-8">
      <section className="min-w-0">
        <div className="border-b border-[var(--rule)] pb-7">
          <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
            Phase 6 Access
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold italic leading-tight text-[var(--heading)] sm:text-5xl">
            Access Desk
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--copy)]">
            Grant access by verified email before or after a Member signs in.
          </p>
        </div>

        <form
          onSubmit={saveAccess}
          className="mt-8 border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6"
        >
          <div className="flex items-center gap-2 text-[var(--heading)]">
            <KeyRound size={18} className="text-[var(--accent)]" />
            <h2 className="font-serif text-2xl font-bold italic">
              {editingId ? "Edit Access" : "Grant Access"}
            </h2>
          </div>

          <label className="mt-5 block text-sm font-semibold text-[var(--heading)]">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@example.com"
              className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
              required
            />
          </label>

          <label className="mt-5 block text-sm font-semibold text-[var(--heading)]">
            Membership
            <select
              value={accessLevel}
              onChange={(event) =>
                setAccessLevel(event.target.value as AccessLevel)
              }
              className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
            >
              <option value="basic">Basic Membership</option>
              <option value="premium">Free Premium</option>
            </select>
          </label>

          <label className="mt-5 flex items-center gap-3 border border-[var(--rule)] bg-[var(--page)] p-3 text-sm font-semibold text-[var(--heading)]">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(event) => setIsAdmin(event.target.checked)}
              className="h-4 w-4"
            />
            Admin access
          </label>

          <label className="mt-5 block text-sm font-semibold text-[var(--heading)]">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="mt-2 w-full resize-y border border-[var(--rule)] bg-[var(--page)] px-3 py-3 text-sm font-normal leading-7 text-[var(--heading)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex min-h-11 items-center gap-2 border border-[var(--rule-strong)] bg-[var(--button-bg)] px-5 font-mono text-xs font-semibold uppercase text-[var(--button-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {isSaving ? "Saving" : "Save Access"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="min-h-11 border border-[var(--rule)] px-5 font-mono text-xs font-semibold uppercase text-[var(--heading)]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        {message ? (
          <div className="mt-5 border border-[var(--rule-strong)] bg-[var(--panel)] p-4 text-sm leading-6 text-[var(--heading)]">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 border border-[var(--sentiment-critical)] bg-[var(--panel)] p-4 text-sm leading-6 text-[var(--heading)]">
            {error}
          </div>
        ) : null}
      </section>

      <section className="min-w-0">
        <div className="border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
                Access Overrides
              </p>
              <h2 className="mt-2 font-serif text-2xl font-bold italic text-[var(--heading)]">
                Members And Admins
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadAccess()}
              className="inline-flex min-h-9 items-center gap-2 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)]"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {isLoading ? (
              <p className="border border-[var(--rule)] bg-[var(--page)] p-4 text-sm text-[var(--copy)]">
                Loading access.
              </p>
            ) : null}

            {!isLoading && accessList.length === 0 ? (
              <p className="border border-[var(--rule)] bg-[var(--page)] p-4 text-sm text-[var(--copy)]">
                No access overrides are configured.
              </p>
            ) : null}

            {accessList.map((access) => (
              <article
                key={access.id}
                className="border border-[var(--rule)] bg-[var(--page)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-all font-serif text-xl font-bold text-[var(--heading)]">
                      {access.email}
                    </h3>
                    <p className="mt-2 font-mono text-[10px] uppercase text-[var(--accent)]">
                      {accessLabel(access)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {access.signedIn ? (
                      <span className="inline-flex min-h-8 items-center gap-1 border border-[var(--rule)] px-2 font-mono text-[9px] uppercase text-[var(--heading)]">
                        <ShieldCheck size={13} />
                        Signed in
                      </span>
                    ) : (
                      <span className="inline-flex min-h-8 items-center border border-[var(--rule)] px-2 font-mono text-[9px] uppercase text-[var(--muted)]">
                        Pending sign-in
                      </span>
                    )}
                  </div>
                </div>

                {access.notes ? (
                  <p className="mt-3 text-sm leading-6 text-[var(--copy)]">
                    {access.notes}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                  <span>Updated {formatDate(access.updatedAt)}</span>
                  {access.activeAdminGrant ? <span>admin grant active</span> : null}
                  {access.activeMemberSubscriptionStatus ? (
                    <span>
                      member status {access.activeMemberSubscriptionStatus}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--rule)] pt-4">
                  <button
                    type="button"
                    onClick={() => editAccess(access)}
                    className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={mutatingId === access.id}
                    onClick={() => void revokeAccess(access)}
                    className="inline-flex min-h-9 items-center gap-2 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={13} />
                    Revoke
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
