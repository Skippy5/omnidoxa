"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ClipboardCheck,
  EyeOff,
  ExternalLink,
  Home,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
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
  anchorArticlePublishedAt: string | null;
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

type StoryFilters = {
  search: string;
  status: string;
  category: string;
  placement: string;
  analysis: string;
  postedFrom: string;
  postedTo: string;
};

const defaultStoryFilters: StoryFilters = {
  search: "",
  status: "all",
  category: "all",
  placement: "all",
  analysis: "all",
  postedFrom: "",
  postedTo: "",
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

function parseFilterDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTopicDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function placementMatches(topic: QueueTopic, placement: string) {
  if (placement === "all") {
    return true;
  }

  if (topic.status !== "published") {
    return placement === "unplaced";
  }

  if (placement === "main") {
    return topic.mainFeedEnabled;
  }

  if (placement === "category") {
    return topic.categoryFeedEnabled;
  }

  if (placement === "featured") {
    return topic.isFeaturedMain;
  }

  return !topic.mainFeedEnabled && !topic.categoryFeedEnabled && !topic.isFeaturedMain;
}

function analysisMatches(topic: QueueTopic, analysis: string) {
  if (analysis === "all") {
    return true;
  }

  if (analysis === "none") {
    return !topic.lastSentimentAt;
  }

  if (analysis === "review") {
    return topic.status === "review" || topic.analysisReviewStatus === "pending";
  }

  if (analysis === "approved") {
    return topic.analysisReviewStatus === "approved";
  }

  return topic.candidatePostCount > 0;
}

function placementBadges(topic: QueueTopic) {
  const badges: string[] = [];

  if (topic.status !== "published") {
    return badges;
  }

  if (topic.mainFeedEnabled) {
    badges.push("Main");
  }

  if (topic.categoryFeedEnabled) {
    badges.push("Category");
  }

  if (topic.isFeaturedMain) {
    badges.push("Lead");
  }

  return badges;
}

function analysisLabel(topic: QueueTopic) {
  if (!topic.lastSentimentAt) {
    return "No analysis";
  }

  return `v${topic.analysisVersion} ${statusLabel(
    topic.analysisReviewStatus ?? "pending",
  )}`;
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
  const [storyFilters, setStoryFilters] =
    useState<StoryFilters>(defaultStoryFilters);
  const [deleteCandidate, setDeleteCandidate] = useState<QueueTopic | null>(null);
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

  const statusOptions = useMemo(
    () => Array.from(new Set(queue.map((topic) => topic.status))).sort(),
    [queue],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...newsCategories,
          ...queue
            .map((topic) => topic.category)
            .filter((category): category is string => Boolean(category)),
        ]),
      ).sort(),
    [queue],
  );
  const filteredQueue = useMemo(() => {
    const search = storyFilters.search.trim().toLowerCase();
    const postedFrom = parseFilterDate(storyFilters.postedFrom);
    const postedTo = parseFilterDate(storyFilters.postedTo, true);

    return queue.filter((topic) => {
      if (storyFilters.status !== "all" && topic.status !== storyFilters.status) {
        return false;
      }

      if (
        storyFilters.category !== "all" &&
        topic.category !== storyFilters.category
      ) {
        return false;
      }

      if (!placementMatches(topic, storyFilters.placement)) {
        return false;
      }

      if (!analysisMatches(topic, storyFilters.analysis)) {
        return false;
      }

      if (postedFrom || postedTo) {
        const postedAt = parseTopicDate(topic.anchorArticlePublishedAt);

        if (!postedAt) {
          return false;
        }

        if (postedFrom && postedAt < postedFrom) {
          return false;
        }

        if (postedTo && postedAt > postedTo) {
          return false;
        }
      }

      if (!search) {
        return true;
      }

      return [
        topic.title,
        topic.centralDevelopment,
        topic.anchorArticleTitle,
        topic.anchorArticleSource,
        topic.category,
        topic.status,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search));
    });
  }, [queue, storyFilters]);
  const activeFilterCount = Object.entries(storyFilters).filter(
    ([key, value]) =>
      value !== defaultStoryFilters[key as keyof StoryFilters],
  ).length;

  async function readJsonResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const isJson = contentType.includes("application/json");
    const data = isJson && text
      ? (JSON.parse(text) as T & { error?: string })
      : ({ error: text.slice(0, 240) } as T & { error?: string });

    if (!response.ok) {
      throw new Error(
        data.error && !data.error.trim().startsWith("<!DOCTYPE")
          ? data.error
          : `Request failed with status ${response.status}. The server returned ${contentType || "non-JSON"} instead of JSON.`,
      );
    }

    if (!isJson) {
      throw new Error(
        `Expected JSON but received ${contentType || "non-JSON"} from the server.`,
      );
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

  async function deleteSelectedTopic() {
    if (!deleteCandidate) {
      return;
    }

    setError(null);
    setMessage(null);
    setMutatingTopicId(deleteCandidate.id);

    try {
      await readJsonResponse(
        await fetch(`/api/admin/topics/${deleteCandidate.id}`, {
          method: "DELETE",
        }),
      );

      setMessage("Topic deleted from story management. Audit records were retained.");
      setDeleteCandidate(null);
      await loadQueue();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete Topic.",
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

  function renderStoryActions(topic: QueueTopic) {
    const isMutating = mutatingTopicId === topic.id;
    const actionClass =
      "inline-flex min-h-9 items-center gap-2 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-60 hover:border-[var(--accent)]";
    const primaryActionClass =
      "inline-flex min-h-9 items-center gap-2 border border-[var(--rule-strong)] bg-[var(--button-bg)] px-3 font-mono text-[10px] uppercase text-[var(--button-text)] disabled:cursor-not-allowed disabled:opacity-60";
    const dangerActionClass =
      "inline-flex min-h-9 items-center gap-2 border border-[var(--sentiment-critical)] px-3 font-mono text-[10px] uppercase text-[var(--sentiment-critical)] disabled:cursor-not-allowed disabled:opacity-60";

    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isMutating}
          onClick={() => void runSentiment(topic)}
          className={actionClass}
        >
          <PlayCircle size={14} />
          {topic.candidatePostCount > 0 ? "Re-run" : "Analyze"}
        </button>

        {topic.candidatePostCount > 0 ? (
          <button
            type="button"
            disabled={isMutating || isLoadingAnalysis}
            onClick={() => void loadAnalysis(topic)}
            className={actionClass}
          >
            <ClipboardCheck size={14} />
            Review
          </button>
        ) : null}

        {topic.status === "published" || topic.status === "archived" ? (
          <>
            <Link
              href={`/topics/${topic.slug}`}
              className={actionClass}
            >
              <ExternalLink size={14} />
              View
            </Link>
            {topic.status === "published" ? (
              <>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void updateTopicVisibility(topic, "archive")}
                  className={actionClass}
                >
                  <Archive size={14} />
                  Archive
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void updateTopicVisibility(topic, "hide")}
                  className={actionClass}
                >
                  <EyeOff size={14} />
                  Hide
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() =>
                    void updateTopicPlacement(topic, {
                      mainFeedEnabled: !topic.mainFeedEnabled,
                      categoryFeedEnabled: topic.categoryFeedEnabled,
                      isFeaturedMain: !topic.mainFeedEnabled
                        ? topic.isFeaturedMain
                        : false,
                    })
                  }
                  className={actionClass}
                >
                  <Home size={14} />
                  {topic.mainFeedEnabled ? "Main off" : "Main on"}
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() =>
                    void updateTopicPlacement(topic, {
                      mainFeedEnabled: topic.mainFeedEnabled,
                      categoryFeedEnabled: !topic.categoryFeedEnabled,
                      isFeaturedMain: topic.isFeaturedMain,
                    })
                  }
                  className={actionClass}
                >
                  {topic.categoryFeedEnabled ? "Category off" : "Category on"}
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() =>
                    void updateTopicPlacement(topic, {
                      mainFeedEnabled: true,
                      categoryFeedEnabled: topic.categoryFeedEnabled,
                      isFeaturedMain: !topic.isFeaturedMain,
                    })
                  }
                  className={actionClass}
                >
                  {topic.isFeaturedMain ? <StarOff size={14} /> : <Star size={14} />}
                  {topic.isFeaturedMain ? "Unlead" : "Lead"}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => void updateTopicVisibility(topic, "hide")}
                className={actionClass}
              >
                <EyeOff size={14} />
                Hide
              </button>
            )}
          </>
        ) : topic.status === "review" ? (
          <p className="min-h-9 border border-[var(--rule)] px-3 py-2 font-mono text-[10px] uppercase text-[var(--copy)]">
            Review required
          </p>
        ) : (
          <>
            <button
              type="button"
              disabled={isMutating}
              onClick={() =>
                void updateTopicVisibility(topic, "publish", {
                  mainFeedEnabled: true,
                  categoryFeedEnabled: true,
                  isFeaturedMain: false,
                })
              }
              className={primaryActionClass}
            >
              <Send size={14} />
              Publish all
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() =>
                void updateTopicVisibility(topic, "publish", {
                  mainFeedEnabled: false,
                  categoryFeedEnabled: true,
                  isFeaturedMain: false,
                })
              }
              className={actionClass}
            >
              Category
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() =>
                void updateTopicVisibility(topic, "publish", {
                  mainFeedEnabled: true,
                  categoryFeedEnabled: false,
                  isFeaturedMain: false,
                })
              }
              className={actionClass}
            >
              Main
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() =>
                void updateTopicVisibility(topic, "publish", {
                  mainFeedEnabled: true,
                  categoryFeedEnabled: true,
                  isFeaturedMain: true,
                })
              }
              className={actionClass}
            >
              <Star size={14} />
              Lead
            </button>
          </>
        )}

        <button
          type="button"
          disabled={isMutating}
          onClick={() => setDeleteCandidate(topic)}
          className={dangerActionClass}
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
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
                              target="_blank"
                              rel="noreferrer"
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

      <section className="min-w-0 border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
              Story Management
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold italic text-[var(--heading)]">
              Story Table
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--copy)]">
              {filteredQueue.length} of {queue.length} Topics shown
              {activeFilterCount > 0 ? ` with ${activeFilterCount} active filters` : ""}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadQueue()}
              className="inline-flex min-h-10 items-center gap-2 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] hover:border-[var(--accent)]"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              type="button"
              disabled={activeFilterCount === 0}
              onClick={() => setStoryFilters(defaultStoryFilters)}
              className="inline-flex min-h-10 items-center gap-2 border border-[var(--rule)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={14} />
              Reset
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="block text-xs font-semibold text-[var(--heading)] xl:col-span-2">
            Search
            <span className="relative mt-2 block">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]"
              />
              <input
                value={storyFilters.search}
                onChange={(event) =>
                  setStoryFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Title, source, category"
                className="min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 pl-9 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
              />
            </span>
          </label>

          <label className="block text-xs font-semibold text-[var(--heading)]">
            Status
            <select
              value={storyFilters.status}
              onChange={(event) =>
                setStoryFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-[var(--heading)]">
            Category
            <select
              value={storyFilters.category}
              onChange={(event) =>
                setStoryFilters((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-[var(--heading)]">
            Placement
            <select
              value={storyFilters.placement}
              onChange={(event) =>
                setStoryFilters((current) => ({
                  ...current,
                  placement: event.target.value,
                }))
              }
              className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All placements</option>
              <option value="main">Main page</option>
              <option value="category">Category feed</option>
              <option value="featured">Lead story</option>
              <option value="unplaced">Unplaced</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-[var(--heading)]">
            Analysis
            <select
              value={storyFilters.analysis}
              onChange={(event) =>
                setStoryFilters((current) => ({
                  ...current,
                  analysis: event.target.value,
                }))
              }
              className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All analysis</option>
              <option value="none">No analysis</option>
              <option value="candidates">Has candidates</option>
              <option value="review">Needs review</option>
              <option value="approved">Approved</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-[var(--heading)]">
            Posted From
            <input
              type="date"
              value={storyFilters.postedFrom}
              onChange={(event) =>
                setStoryFilters((current) => ({
                  ...current,
                  postedFrom: event.target.value,
                }))
              }
              className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="block text-xs font-semibold text-[var(--heading)]">
            Posted To
            <input
              type="date"
              value={storyFilters.postedTo}
              onChange={(event) =>
                setStoryFilters((current) => ({
                  ...current,
                  postedTo: event.target.value,
                }))
              }
              className="mt-2 min-h-11 w-full border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>

        <div className="mt-5 overflow-x-auto border border-[var(--rule)]">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead className="bg-[var(--panel-strong)]">
              <tr className="font-mono text-[10px] uppercase text-[var(--subtle)]">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Story
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Posted
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Updated
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Placement
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Analysis
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {isLoadingQueue ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-[var(--copy)]">
                    Loading stories.
                  </td>
                </tr>
              ) : null}

              {!isLoadingQueue && filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-[var(--copy)]">
                    No Topics match the current filters.
                  </td>
                </tr>
              ) : null}

              {!isLoadingQueue
                ? filteredQueue.map((topic) => {
                    const badges = placementBadges(topic);

                    return (
                      <tr
                        key={topic.id}
                        className="align-top text-sm text-[var(--copy)]"
                      >
                        <td className="w-[360px] px-4 py-4">
                          <div className="font-mono text-[10px] uppercase text-[var(--subtle)]">
                            {topic.anchorArticleSource ?? "No source"}
                          </div>
                          <h3 className="mt-2 font-serif text-lg font-bold leading-tight text-[var(--heading)]">
                            {topic.title}
                          </h3>
                          {topic.centralDevelopment ? (
                            <p className="mt-2 line-clamp-2 text-xs leading-5">
                              {topic.centralDevelopment}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase text-[var(--muted)]">
                            <span>{topic.materialUpdateCount} updates</span>
                            <span>{topic.anchorImageUrl ? "image" : "no image"}</span>
                            {topic.anchorArticleUrl ? (
                              <Link
                                href={topic.anchorArticleUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--accent)] hover:text-[var(--heading)]"
                              >
                                <ExternalLink size={12} />
                                Source
                              </Link>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex border border-[var(--rule)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--heading)]">
                            {statusLabel(topic.status)}
                          </span>
                          <div className="mt-2 font-mono text-[10px] uppercase text-[var(--subtle)]">
                            {topic.category ?? "Uncategorized"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-[var(--heading)]">
                            {formatDate(topic.anchorArticlePublishedAt)}
                          </div>
                          <div className="mt-2 font-mono text-[10px] uppercase text-[var(--subtle)]">
                            Added {formatDate(topic.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium text-[var(--heading)]">
                          {formatDate(topic.updatedAt)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {badges.length > 0 ? (
                              badges.map((badge) => (
                                <span
                                  key={badge}
                                  className="border border-[var(--rule)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--heading)]"
                                >
                                  {badge}
                                </span>
                              ))
                            ) : (
                              <span className="border border-[var(--rule)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--subtle)]">
                                Unplaced
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-[var(--heading)]">
                            {analysisLabel(topic)}
                          </div>
                          {topic.candidatePostCount > 0 ? (
                            <div className="mt-2 font-mono text-[10px] uppercase text-[var(--subtle)]">
                              {topic.candidatePostCount} candidates /{" "}
                              {topic.verifiedPostCount} verified
                            </div>
                          ) : null}
                        </td>
                        <td className="w-[360px] px-4 py-4">
                          {renderStoryActions(topic)}
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {deleteCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-topic-title"
            className="w-full max-w-lg border border-[var(--sentiment-critical)] bg-[var(--surface)] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase text-[var(--sentiment-critical)]">
                  Delete Topic
                </p>
                <h2
                  id="delete-topic-title"
                  className="mt-2 font-serif text-2xl font-bold italic text-[var(--heading)]"
                >
                  {deleteCandidate.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="inline-flex h-9 w-9 items-center justify-center border border-[var(--rule)] text-[var(--heading)]"
                aria-label="Close delete confirmation"
              >
                <X size={15} />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--copy)]">
              This removes the Topic from active story management and all public
              placements. The database keeps related analysis and audit records.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[var(--rule)] pt-5">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="min-h-10 border border-[var(--rule)] px-4 font-mono text-[10px] uppercase text-[var(--heading)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutatingTopicId === deleteCandidate.id}
                onClick={() => void deleteSelectedTopic()}
                className="inline-flex min-h-10 items-center gap-2 border border-[var(--sentiment-critical)] px-4 font-mono text-[10px] uppercase text-[var(--sentiment-critical)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
