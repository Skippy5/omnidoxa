"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
  analysisVersion: number;
  lastSentimentAt: string | null;
  analysisReviewStatus: string | null;
  candidatePostCount: number;
  verifiedPostCount: number;
};

type TopicDraft = {
  title: string;
  category: string;
  centralDevelopment: string;
};

type AnalysisPost = {
  id: string;
  lean: string;
  author: string | null;
  authorHandle: string | null;
  text: string;
  url: string;
  likes: number;
  retweets: number;
  reviewStatus: string;
  isVerified: boolean;
  postDate: string | null;
};

type AnalysisViewpoint = {
  id: string;
  lean: string;
  label: string | null;
  summary: string;
  sentimentScore: number | null;
  posts: AnalysisPost[];
};

type TopicAnalysis = {
  topicId: string;
  status: string;
  analysisVersion: number;
  reviewStatus: string;
  neutralSummary: string | null;
  discourseSummary: string | null;
  discoursePreview: string | null;
  viewpoints: AnalysisViewpoint[];
  threshold: {
    requiredPerLean: number;
    verifiedByLean: Record<string, number>;
    isSatisfied: boolean;
  };
};

type AnalysisReviewDraft = {
  neutralSummary: string;
  discourseSummary: string;
  discoursePreview: string;
  viewpointSummaries: Record<string, string>;
  verifiedPostIds: string[];
};

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
  const [analysis, setAnalysis] = useState<TopicAnalysis | null>(null);
  const [reviewDraft, setReviewDraft] = useState<AnalysisReviewDraft | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          headers: {},
        }),
      );

      setQueue(data.topics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Queue failed to load.");
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

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
                }
              : {},
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

  function setAnalysisReviewDraft(nextAnalysis: TopicAnalysis) {
    setReviewDraft({
      neutralSummary: nextAnalysis.neutralSummary ?? "",
      discourseSummary: nextAnalysis.discourseSummary ?? "",
      discoursePreview: nextAnalysis.discoursePreview ?? "",
      viewpointSummaries: Object.fromEntries(
        nextAnalysis.viewpoints.map((viewpoint) => [
          viewpoint.id,
          viewpoint.summary,
        ]),
      ),
      verifiedPostIds: nextAnalysis.viewpoints.flatMap((viewpoint) =>
        viewpoint.posts
          .filter((post) => post.isVerified)
          .map((post) => post.id),
      ),
    });
  }

  async function loadAnalysis(topic: QueueTopic) {
    setError(null);
    setMessage(null);
    setIsLoadingAnalysis(true);

    try {
      const data = await readJsonResponse<{ analysis: TopicAnalysis }>(
        await fetch(`/api/admin/topics/${topic.id}/analysis`),
      );

      setAnalysis(data.analysis);
      setAnalysisReviewDraft(data.analysis);
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Could not load analysis.",
      );
    } finally {
      setIsLoadingAnalysis(false);
    }
  }

  async function runSentiment(topic: QueueTopic) {
    setError(null);
    setMessage(null);
    setMutatingTopicId(topic.id);

    try {
      await readJsonResponse(
        await fetch(`/api/admin/topics/${topic.id}/analyze`, {
          method: "POST",
        }),
      );

      setMessage("Grok analysis stored for editorial review.");
      setAnalysis(null);
      setReviewDraft(null);
      await loadQueue();
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Could not run Grok analysis.",
      );
    } finally {
      setMutatingTopicId(null);
    }
  }

  function toggleVerifiedPost(postId: string) {
    setReviewDraft((current) => {
      if (!current) {
        return current;
      }

      const verified = new Set(current.verifiedPostIds);

      if (verified.has(postId)) {
        verified.delete(postId);
      } else {
        verified.add(postId);
      }

      return {
        ...current,
        verifiedPostIds: Array.from(verified),
      };
    });
  }

  async function submitReview() {
    if (!analysis || !reviewDraft) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmittingReview(true);

    try {
      const data = await readJsonResponse<{
        result: {
          status: string;
          reviewStatus: string;
          threshold: {
            requiredPerLean: number;
            verifiedByLean: Record<string, number>;
            isSatisfied: boolean;
          };
        };
      }>(
        await fetch(`/api/admin/topics/${analysis.topicId}/review`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(reviewDraft),
        }),
      );

      setMessage(
        data.result.reviewStatus === "approved"
          ? "Analysis approved. Evidence Threshold is satisfied."
          : `Analysis saved. Need at least ${data.result.threshold.requiredPerLean} verified posts per side. Current: left ${
              data.result.threshold.verifiedByLean.left ?? 0
            }, center ${
              data.result.threshold.verifiedByLean.center ?? 0
            }, right ${data.result.threshold.verifiedByLean.right ?? 0}.`,
      );
      setAnalysis(null);
      setReviewDraft(null);
      await loadQueue();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Could not save analysis review.",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
      <section className="min-w-0">
        <div className="border-b border-[var(--rule)] pb-7">
          <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
            Phase 6 Admin Publishing
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
            htmlFor="article-url"
            className="block font-mono text-[10px] font-semibold uppercase text-[var(--accent)]"
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

        {isLoadingAnalysis ? (
          <div className="mt-8 border border-[var(--rule)] bg-[var(--surface)] p-5 text-sm text-[var(--copy)]">
            Loading analysis review.
          </div>
        ) : null}

        {analysis && reviewDraft ? (
          <section className="mt-8 border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
                  Editorial Review
                </p>
                <h2 className="mt-2 font-serif text-2xl font-bold italic text-[var(--heading)]">
                  Analysis Version {analysis.analysisVersion}
                </h2>
              </div>
              <span className="border border-[var(--rule)] px-3 py-2 font-mono text-[10px] uppercase text-[var(--copy)]">
                {analysis.reviewStatus}
              </span>
            </div>
            <p className="mt-4 border border-[var(--rule)] bg-[var(--page)] p-4 text-sm leading-6 text-[var(--copy)]">
              Check at least {analysis.threshold.requiredPerLean} real posts in each
              Left, Center, and Right section to approve the analysis. Unchecked
              posts remain candidates for later review.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="block text-sm font-semibold text-[var(--heading)]">
                Neutral Topic Summary
                <textarea
                  value={reviewDraft.neutralSummary}
                  onChange={(event) =>
                    setReviewDraft((current) =>
                      current
                        ? {
                            ...current,
                            neutralSummary: event.target.value,
                          }
                        : current,
                    )
                  }
                  rows={4}
                  className="mt-2 w-full resize-y border border-[var(--rule)] bg-[var(--page)] px-3 py-3 text-sm font-normal leading-7 text-[var(--heading)] outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-sm font-semibold text-[var(--heading)]">
                Discourse Summary
                <textarea
                  value={reviewDraft.discourseSummary}
                  onChange={(event) =>
                    setReviewDraft((current) =>
                      current
                        ? {
                            ...current,
                            discourseSummary: event.target.value,
                          }
                        : current,
                    )
                  }
                  rows={4}
                  className="mt-2 w-full resize-y border border-[var(--rule)] bg-[var(--page)] px-3 py-3 text-sm font-normal leading-7 text-[var(--heading)] outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-sm font-semibold text-[var(--heading)]">
                Discourse Preview
                <textarea
                  value={reviewDraft.discoursePreview}
                  onChange={(event) =>
                    setReviewDraft((current) =>
                      current
                        ? {
                            ...current,
                            discoursePreview: event.target.value,
                          }
                        : current,
                    )
                  }
                  rows={3}
                  className="mt-2 w-full resize-y border border-[var(--rule)] bg-[var(--page)] px-3 py-3 text-sm font-normal leading-7 text-[var(--heading)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-5">
              {analysis.viewpoints.map((viewpoint) => {
                const verifiedCount = reviewDraft.verifiedPostIds.filter((postId) =>
                  viewpoint.posts.some((post) => post.id === postId),
                ).length;

                return (
                  <article
                    key={viewpoint.id}
                    className="border border-[var(--rule)] bg-[var(--page)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
                          {viewpoint.lean} viewpoint
                        </p>
                        <h3 className="mt-1 font-serif text-xl font-bold text-[var(--heading)]">
                          {viewpoint.label ?? "Candidate analysis"}
                        </h3>
                      </div>
                      <span className="border border-[var(--rule)] px-3 py-1 font-mono text-[10px] uppercase text-[var(--copy)]">
                        {verifiedCount}/{analysis.threshold.requiredPerLean} verified
                      </span>
                    </div>

                    <label className="mt-4 block text-sm font-semibold text-[var(--heading)]">
                      Viewpoint Summary
                      <textarea
                        value={reviewDraft.viewpointSummaries[viewpoint.id] ?? ""}
                        onChange={(event) =>
                          setReviewDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  viewpointSummaries: {
                                    ...current.viewpointSummaries,
                                    [viewpoint.id]: event.target.value,
                                  },
                                }
                              : current,
                          )
                        }
                        rows={4}
                        className="mt-2 w-full resize-y border border-[var(--rule)] bg-[var(--surface)] px-3 py-3 text-sm font-normal leading-7 text-[var(--heading)] outline-none focus:border-[var(--accent)]"
                      />
                    </label>

                    <div className="mt-4 grid gap-3">
                      {viewpoint.posts.map((post) => (
                        <label
                          key={post.id}
                          className="grid gap-3 border border-[var(--rule)] bg-[var(--surface)] p-4 text-sm text-[var(--copy)]"
                        >
                          <span className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={reviewDraft.verifiedPostIds.includes(post.id)}
                              onChange={() => toggleVerifiedPost(post.id)}
                              className="mt-1"
                            />
                            <span>
                              <span className="block font-semibold text-[var(--heading)]">
                                {post.authorHandle ?? post.author ?? "Unknown author"}
                              </span>
                              <span className="mt-2 block leading-6">{post.text}</span>
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-3 pl-7 font-mono text-[10px] uppercase text-[var(--subtle)]">
                            <Link
                              href={post.url}
                              className="text-[var(--accent)] hover:text-[var(--heading)]"
                            >
                              Source
                            </Link>
                            <span>{post.likes} likes</span>
                            <span>{post.retweets} reposts</span>
                            <span>{post.reviewStatus}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--rule)] pt-5">
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={() => void submitReview()}
                className="min-h-11 border border-[var(--rule-strong)] bg-[var(--button-bg)] px-5 font-mono text-xs font-semibold uppercase text-[var(--button-text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Review
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={() => {
                  setAnalysis(null);
                  setReviewDraft(null);
                }}
                className="min-h-11 border border-[var(--rule)] px-5 font-mono text-xs font-semibold uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
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
                  {topic.lastSentimentAt ? (
                    <span>
                      analysis v{topic.analysisVersion} {topic.analysisReviewStatus ?? "pending"}
                    </span>
                  ) : (
                    <span>no analysis</span>
                  )}
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
                {topic.candidatePostCount > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 font-mono text-[9px] uppercase text-[var(--subtle)]">
                    <span className="border border-[var(--rule)] px-2 py-1">
                      {topic.candidatePostCount} candidates
                    </span>
                    <span className="border border-[var(--rule)] px-2 py-1">
                      {topic.verifiedPostCount} verified
                    </span>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--rule)] pt-4">
                  <button
                    type="button"
                    disabled={mutatingTopicId === topic.id}
                    onClick={() => void runSentiment(topic)}
                    className="min-h-9 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {topic.candidatePostCount > 0
                      ? "Re-run Sentiment"
                      : "Run Sentiment"}
                  </button>
                  {topic.candidatePostCount > 0 ? (
                    <button
                      type="button"
                      disabled={mutatingTopicId === topic.id || isLoadingAnalysis}
                      onClick={() => void loadAnalysis(topic)}
                      className="min-h-9 border border-[var(--rule-strong)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Review Analysis
                    </button>
                  ) : null}
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
                  ) : topic.status === "review" ? (
                    <p className="min-h-9 border border-[var(--rule)] px-3 py-2 font-mono text-[10px] uppercase text-[var(--copy)]">
                      Review required before publishing
                    </p>
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
