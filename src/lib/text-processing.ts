import "server-only";

import { createHash } from "node:crypto";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

export function normalizeUrl(input: string) {
  const url = new URL(input.trim());

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  url.searchParams.sort();

  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function hashUrl(url: string) {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

export function normalizeTitle(title: string) {
  return title
    .replace(/\s+/g, " ")
    .replace(/\s+[-|]\s+[^-|]+$/g, "")
    .trim();
}

export function slugify(input: string) {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");

  return slug || "topic";
}

export function titleFingerprint(title: string) {
  return normalizeTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 12)
    .join(" ");
}

export function proposeCentralDevelopment(title: string, snippet?: string | null) {
  const normalizedTitle = normalizeTitle(title);
  const normalizedSnippet = snippet?.replace(/\s+/g, " ").trim();

  if (normalizedSnippet && normalizedSnippet.length >= 80) {
    return normalizedSnippet.slice(0, 260).replace(/\s+\S*$/, ".");
  }

  return normalizedTitle.endsWith(".")
    ? normalizedTitle
    : `${normalizedTitle}.`;
}
