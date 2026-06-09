"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { newsCategories } from "@/lib/topic-types";

type ArticlePreview = {
  article: {
    title: string;
    normalizedUrl: string;
    urlHash: string;
    source: string;
    sourceHost: string;
    snippet: string | null;
    imageUrl: string | null;
    author: string | null;
    publishedAt: string | null;
    fetchedAt: string;
  };
  proposed: {
    topicTitle: string;
    slug: string;
    centralDevelopment: string;
    category: string;
  };
  duplicateCandidates: DuplicateCandidate[];
};

type DuplicateCandidate = {
  topicId: string;
  title: string;
  slug: string;
  status: string;
  centralDevelopment: string | null;
  anchorArticleTitle: string | null;
  anchorArticleUrl: string | null;
  matchReasons: string[];
  confidence: "exact_url" | "strong_title" | "weak_text";
};

type QueueTopic = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  centralDevelopment: string | null;
  updatedAt: string;
  createdAt: string;
  anchorArticleTitle: string | null;
  anchorArticleUrl: string | null;
  anchorArticleSource: string | null;
  anchorImageUrl: string | null;
  materialUpdateCount: number;
  mainFeedEnabled: boolean;
  categoryFeedEnabled: boolean;
  isFeaturedMain: boolean;
  featuredAt: string | null;
};

type TopicDraft = {
  title: string;
  category: string;
  centralDevelopment: string;
};

const STORAGE_KEY = "omnidoxa-admin-token";

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

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

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function AdminConsole() {
  const [adminToken, setAdminToken] = useState("");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ArticlePreview | null>(null);
  const [draft, setDraft] = useState<TopicDraft>({
    title: "",
    category: newsCategories[0],
    centralDevelopment: "",
  });
  const [queue, setQueue] = useState<QueueTopic[]>([]);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [mutatingTopicId, setMutatingTopicId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};

    if (adminToken) {
      headers["x-omnidoxa-admin-token"] = adminToken;
    }

    return headers;
  }, [adminToken]);

  async function readJsonResponse<T>(response: Response): Promise<T> {
    const data = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Request failed.");
    }

    return data;
  }

  const loadQueue = useCallback(async () => {
    setIsLoadingQueue(true);

    try {
      const data = await readJsonResponse<{ topics: QueueTopic[] }>(
        await fetch("/api/admin/topics", {
          headers: authHeaders,
        }),
      );

      setQueue(data.topics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Queue failed to load.");
    } finally {
      setIsLoadingQueue(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedToken = window.sessionStorage.getItem(STORAGE_KEY);

      if (storedToken) {
        setAdminToken(storedToken);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, adminToken);
  }, [adminToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQueue();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPreview(null);
    setIsPreviewing(true);

    try {
      const data = await readJsonResponse<ArticlePreview>(
        await fetch("/api/admin/articles/preview", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({ url }),
        }),
      );

      setPreview(data);
      setDraft({
        title: data.proposed.topicTitle,
        category: data.proposed.category,
        centralDevelopment: data.proposed.centralDevelopment,
      });
      setSelectedDuplicateId(data.duplicateCandidates[0]?.topicId ?? "");
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Could not preview this article.",
      );
    } finally {
      setIsPreviewing(false);
    }
  }

  async function saveTopic(action: "create_new" | "attach_material_update") {
    if (!preview) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      const data = await readJsonResponse<{
        action: string;
        result: { id?: string; slug?: string; topicId?: string };
      }>(
        await fetch("/api/admin/topics", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            article: preview.article,
            topic: draft,
            duplicateDecision: {
              action,
              targetTopicId:
                action === "attach_material_update" ? selectedDuplicateId : undefined,
            },
          }),
        }),
      );

      setMessage(
        data.action === "attached_material_update"
          ? "Material Update attached to the selected Topic."
          : "Draft Topic created and added to the queue.",
      );
      setPreview(null);
      setUrl("");
      await loadQueue();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateTopicVisibility(
    topic: QueueTopic,
    action: "publish" | "archive" | "hide",
    placement?: {
      mainFeedEnabled: boolean;
      categoryFeedEnabled: boolean;
      isFeaturedMain: boolean;
    },
  ) {
    setError(null);
    setMessage(null);
    setMutatingTopicId(topic.id);

    try {
      await readJsonResponse(
        await fetch(`/api/admin/topics/${topic.id}/${action}`, {
          method: "POST",
          headers:
            action === "publish"
              ? {
                  "content-type": "application/json",
                  ...authHeaders,
                }
              : authHeaders,
          body:
            action === "publish" && placement
              ? JSON.stringify(placement)
              : undefined,
        }),
      );

      setMessage(
        action === "publish"
          ? placement?.isFeaturedMain
            ? "Topic published and promoted as the main page story."
            : "Topic published with selected public placement."
          : action === "archive"
            ? "Topic archived. It is removed from browse feeds but remains directly viewable."
          : "Topic hidden from public pages.",
      );
      await loadQueue();
    } catch (visibilityError) {
      setError(
        visibilityError instanceof Error
          ? visibilityError.message
          : "Could not update Topic visibility.",
      );
    } finally {
      setMutatingTopicId(null);
    }
  }

  async function updateTopicPlacement(
    topic: QueueTopic,
    placement: {
      mainFeedEnabled: boolean;
      categoryFeedEnabled: boolean;
      isFeaturedMain: boolean;
    },
  ) {
    setError(null);
    setMessage(null);
    setMutatingTopicId(topic.id);

    try {
      await readJsonResponse(
        await fetch(`/api/admin/topics/${topic.id}/placement`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(placement),
        }),
      );

      setMessage(
        placement.isFeaturedMain
          ? "Topic promoted as the main page story."
          : "Topic placement updated.",
      );
      await loadQueue();
    } catch (placementError) {
      setError(
        placementError instanceof Error
          ? placementError.message
          : "Could not update Topic placement.",
      );
    } finally {
      setMutatingTopicId(null);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
      <section className="min-w-0">
        <div className="border-b border-[var(--rule)] pb-7">
          <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
            Phase 5 Admin Publishing
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold italic leading-tight text-[var(--heading)] sm:text-5xl">
            Anchor Article Desk
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--copy)]">
            Submit a source URL, review the extracted article metadata, edit the
            Central Development, then create a draft Topic or attach the source
            as a Material Update. Publish ready draft Topics into the public
            free layer, route them to the home page or category feed, and
            promote one Topic as the main page story.
          </p>
        </div>

        <form
          onSubmit={handlePreview}
          className="mt-8 border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6"
        >
          <label
            htmlFor="admin-token"
            className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]"
          >
            Admin token
          </label>
          <input
            id="admin-token"
            type="password"
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="Required on deployed environments"
            className="mt-3 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm text-[var(--heading)] outline-none focus:border-[var(--accent)]"
          />

          <label
            htmlFor="article-url"
            className="mt-6 block font-mono text-[10px] font-semibold uppercase text-[var(--accent)]"
          >
            Anchor Article URL
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="article-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/news/article"
              className="min-h-11 flex-1 border border-[var(--rule)] bg-[var(--page)] px-3 text-sm text-[var(--heading)] outline-none focus:border-[var(--accent)]"
              required
            />
            <button
              type="submit"
              disabled={isPreviewing}
              className="min-h-11 border border-[var(--rule-strong)] bg-[var(--button-bg)] px-5 font-mono text-xs font-semibold uppercase text-[var(--button-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPreviewing ? "Fetching" : "Preview"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="mt-5 border border-[var(--sentiment-critical)] bg-[var(--panel)] p-4 text-sm leading-6 text-[var(--heading)]">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-5 border border-[var(--rule-strong)] bg-[var(--panel)] p-4 text-sm leading-6 text-[var(--heading)]">
            {message}
          </div>
        ) : null}

        {preview ? (
          <section className="mt-8 grid gap-5">
            <div className="border border-[var(--rule)] bg-[var(--panel-strong)] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
                    Article Metadata
                  </p>
                  <h2 className="mt-3 font-serif text-2xl font-bold leading-tight text-[var(--heading)]">
                    {preview.article.title}
                  </h2>
                </div>
                <span className="border border-[var(--rule-strong)] px-3 py-2 font-mono text-[10px] uppercase text-[var(--copy)]">
                  {preview.article.source}
                </span>
              </div>

              {preview.article.snippet ? (
                <p className="mt-4 text-sm leading-7 text-[var(--copy)]">
                  {preview.article.snippet}
                </p>
              ) : null}

              <dl className="mt-5 grid gap-3 text-sm text-[var(--copy)] sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--subtle)]">
                    Published
                  </dt>
                  <dd className="mt-1">{formatDate(preview.article.publishedAt)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-[var(--subtle)]">
                    URL hash
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {preview.article.urlHash.slice(0, 20)}
                  </dd>
                </div>
              </dl>
            </div>

            {preview.duplicateCandidates.length > 0 ? (
              <div className="border border-[var(--sentiment-critical)] bg-[var(--surface)] p-5 sm:p-6">
                <p className="font-mono text-[10px] font-semibold uppercase text-[var(--sentiment-critical)]">
                  Duplicate Candidates
                </p>
                <div className="mt-4 grid gap-3">
                  {preview.duplicateCandidates.map((candidate) => (
                    <label
                      key={candidate.topicId}
                      className="grid gap-3 border border-[var(--rule)] bg-[var(--page)] p-4 text-sm text-[var(--copy)]"
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="duplicate"
                          checked={selectedDuplicateId === candidate.topicId}
                          onChange={() => setSelectedDuplicateId(candidate.topicId)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-serif text-lg font-bold text-[var(--heading)]">
                            {candidate.title}
                          </span>
                          <span className="mt-1 block font-mono text-[10px] uppercase text-[var(--subtle)]">
                            {candidate.confidence} - {statusLabel(candidate.status)}
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-2 pl-7">
                        {candidate.matchReasons.map((reason) => (
                          <span
                            key={reason}
                            className="border border-[var(--rule)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--muted)]"
                          >
                            {reason}
                          </span>
                        ))}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
              <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
                Draft Topic Setup
              </p>

              <label className="mt-5 block text-sm font-semibold text-[var(--heading)]">
                Topic title
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="mt-5 block text-sm font-semibold text-[var(--heading)]">
                Category
                <select
                  value={draft.category}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
                >
                  {newsCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <label className="mt-5 block text-sm font-semibold text-[var(--heading)]">
                Central Development
                <textarea
                  value={draft.centralDevelopment}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      centralDevelopment: event.target.value,
                    }))
                  }
                  rows={5}
                  className="mt-2 w-full resize-y border border-[var(--rule)] bg-[var(--page)] px-3 py-3 text-sm font-normal leading-7 text-[var(--heading)] outline-none focus:border-[var(--accent)]"
                />
              </label>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveTopic("create_new")}
                  className="min-h-11 border border-[var(--rule-strong)] bg-[var(--button-bg)] px-5 font-mono text-xs font-semibold uppercase text-[var(--button-text)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Create Draft Topic
                </button>
                {preview.duplicateCandidates.length > 0 ? (
                  <button
                    type="button"
                    disabled={isSaving || !selectedDuplicateId}
                    onClick={() => void saveTopic("attach_material_update")}
                    className="min-h-11 border border-[var(--rule-strong)] px-5 font-mono text-xs font-semibold uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Attach Material Update
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </section>

      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <div className="border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
                Admin Queue
              </p>
              <h2 className="mt-2 font-serif text-2xl font-bold italic text-[var(--heading)]">
                Topic Queue
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadQueue()}
              className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)]"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {isLoadingQueue ? (
              <p className="border border-[var(--rule)] bg-[var(--page)] p-4 text-sm text-[var(--copy)]">
                Loading queue.
              </p>
            ) : null}

            {!isLoadingQueue && queue.length === 0 ? (
              <p className="border border-[var(--rule)] bg-[var(--page)] p-4 text-sm text-[var(--copy)]">
                No draft Topics are waiting.
              </p>
            ) : null}

            {queue.map((topic) => (
              <article
                key={topic.id}
                className="border border-[var(--rule)] bg-[var(--page)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase text-[var(--subtle)]">
                  <span>{statusLabel(topic.status)}</span>
                  <span>{topic.category ?? "Uncategorized"}</span>
                  <span>{formatDate(topic.updatedAt)}</span>
                </div>
                <h3 className="mt-3 font-serif text-xl font-bold leading-tight text-[var(--heading)]">
                  {topic.title}
                </h3>
                {topic.centralDevelopment ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--copy)]">
                    {topic.centralDevelopment}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                  <span>{topic.anchorArticleSource ?? "No anchor source"}</span>
                  <span>{topic.materialUpdateCount} updates</span>
                  <span>{topic.anchorImageUrl ? "image captured" : "no image"}</span>
                  {topic.anchorArticleUrl ? (
                    <Link
                      href={topic.anchorArticleUrl}
                      className="text-[var(--accent)] hover:text-[var(--heading)]"
                    >
                      Source
                    </Link>
                  ) : null}
                </div>
                  {topic.status === "published" || topic.status === "archived" ? (
                  <div className="mt-3 flex flex-wrap gap-2 font-mono text-[9px] uppercase text-[var(--subtle)]">
                    <span className="border border-[var(--rule)] px-2 py-1">
                      {topic.mainFeedEnabled ? "Main page" : "Main off"}
                    </span>
                    <span className="border border-[var(--rule)] px-2 py-1">
                      {topic.categoryFeedEnabled ? "Category" : "Category off"}
                    </span>
                    {topic.isFeaturedMain ? (
                      <span className="border border-[var(--accent)] px-2 py-1 text-[var(--accent)]">
                        Main story
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--rule)] pt-4">
                  {topic.status === "published" || topic.status === "archived" ? (
                    <>
                      <Link
                        href={`/topics/${topic.slug}`}
                        className="inline-flex min-h-9 items-center border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] hover:border-[var(--accent)]"
                      >
                        View
                      </Link>
                      {topic.status === "published" ? (
                        <>
                          <button
                            type="button"
                            disabled={mutatingTopicId === topic.id}
                            onClick={() =>
                              void updateTopicVisibility(topic, "archive")
                            }
                            className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            disabled={mutatingTopicId === topic.id}
                            onClick={() => void updateTopicVisibility(topic, "hide")}
                            className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Hide
                          </button>
                          <button
                            type="button"
                            disabled={mutatingTopicId === topic.id}
                            onClick={() =>
                              void updateTopicPlacement(topic, {
                                mainFeedEnabled: !topic.mainFeedEnabled,
                                categoryFeedEnabled: topic.categoryFeedEnabled,
                                isFeaturedMain:
                                  !topic.mainFeedEnabled
                                    ? topic.isFeaturedMain
                                    : false,
                              })
                            }
                            className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {topic.mainFeedEnabled ? "Remove Main" : "Add Main"}
                          </button>
                          <button
                            type="button"
                            disabled={mutatingTopicId === topic.id}
                            onClick={() =>
                              void updateTopicPlacement(topic, {
                                mainFeedEnabled: topic.mainFeedEnabled,
                                categoryFeedEnabled: !topic.categoryFeedEnabled,
                                isFeaturedMain: topic.isFeaturedMain,
                              })
                            }
                            className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {topic.categoryFeedEnabled
                              ? "Remove Category"
                              : "Add Category"}
                          </button>
                          <button
                            type="button"
                            disabled={mutatingTopicId === topic.id}
                            onClick={() =>
                              void updateTopicPlacement(topic, {
                                mainFeedEnabled: true,
                                categoryFeedEnabled: topic.categoryFeedEnabled,
                                isFeaturedMain: !topic.isFeaturedMain,
                              })
                            }
                            className="min-h-9 border border-[var(--rule-strong)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {topic.isFeaturedMain ? "Unpromote" : "Promote Main"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={mutatingTopicId === topic.id}
                          onClick={() => void updateTopicVisibility(topic, "hide")}
                          className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Hide
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={mutatingTopicId === topic.id}
                        onClick={() =>
                          void updateTopicVisibility(topic, "publish", {
                            mainFeedEnabled: true,
                            categoryFeedEnabled: true,
                            isFeaturedMain: false,
                          })
                        }
                        className="min-h-9 border border-[var(--rule-strong)] bg-[var(--button-bg)] px-3 font-mono text-[10px] uppercase text-[var(--button-text)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Publish Main + Category
                      </button>
                      <button
                        type="button"
                        disabled={mutatingTopicId === topic.id}
                        onClick={() =>
                          void updateTopicVisibility(topic, "publish", {
                            mainFeedEnabled: false,
                            categoryFeedEnabled: true,
                            isFeaturedMain: false,
                          })
                        }
                        className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Publish Category
                      </button>
                      <button
                        type="button"
                        disabled={mutatingTopicId === topic.id}
                        onClick={() =>
                          void updateTopicVisibility(topic, "publish", {
                            mainFeedEnabled: true,
                            categoryFeedEnabled: false,
                            isFeaturedMain: false,
                          })
                        }
                        className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Publish Main
                      </button>
                      <button
                        type="button"
                        disabled={mutatingTopicId === topic.id}
                        onClick={() =>
                          void updateTopicVisibility(topic, "publish", {
                            mainFeedEnabled: true,
                            categoryFeedEnabled: true,
                            isFeaturedMain: true,
                          })
                        }
                        className="min-h-9 border border-[var(--rule-strong)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Publish + Promote
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
