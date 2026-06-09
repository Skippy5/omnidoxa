import "server-only";

import { lookup } from "node:dns/promises";
import net from "node:net";
import { normalizeTitle, normalizeUrl } from "./text-processing";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 8_000;
const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export type ArticleMetadata = {
  title: string;
  url: string;
  normalizedUrl: string;
  source: string;
  sourceHost: string;
  snippet: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  fetchedAt: string;
};

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "0.0.0.0"
  );
}

function isBlockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  const [first, second] = parts;

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 192 && second === 0) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && parts[2] === 100) ||
    (first === 203 && second === 0 && parts[2] === 113) ||
    first >= 224 ||
    first === 255
  );
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];

  if (mappedIpv4) {
    return isBlockedIpv4(mappedIpv4);
  }

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8")
  );
}

async function assertSafePublicUrl(input: string) {
  const normalized = normalizeUrl(input);
  const url = new URL(normalized);

  if (url.username || url.password) {
    throw new Error("Article URLs must not include credentials.");
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new Error("Article URLs must use the default HTTP or HTTPS ports.");
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error("Local and private hostnames are not allowed.");
  }

  const directIpVersion = net.isIP(url.hostname);

  if (directIpVersion === 4 && isBlockedIpv4(url.hostname)) {
    throw new Error("Private and reserved IP addresses are not allowed.");
  }

  if (directIpVersion === 6 && isBlockedIpv6(url.hostname)) {
    throw new Error("Private and reserved IP addresses are not allowed.");
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new Error("The article hostname could not be resolved.");
  }

  for (const address of addresses) {
    if (
      address.family === 4 && isBlockedIpv4(address.address) ||
      address.family === 6 && isBlockedIpv6(address.address)
    ) {
      throw new Error("Private and reserved network addresses are not allowed.");
    }
  }

  return normalized;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function matchMeta(html: string, keys: string[]) {
  for (const key of keys) {
    const propertyPattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    );
    const propertyFirst = html.match(propertyPattern);

    if (propertyFirst?.[1]) {
      return decodeHtml(propertyFirst[1]);
    }

    const contentPattern = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      "i",
    );
    const contentFirst = html.match(contentPattern);

    if (contentFirst?.[1]) {
      return decodeHtml(contentFirst[1]);
    }
  }

  return null;
}

function matchTitle(html: string) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

  return title ? decodeHtml(title) : null;
}

function resolveOptionalUrl(value: string | null, baseUrl: string) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, baseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

async function resolveSafeOptionalUrl(value: string | null, baseUrl: string) {
  const resolvedUrl = resolveOptionalUrl(value, baseUrl);

  if (!resolvedUrl) {
    return null;
  }

  try {
    return await assertSafePublicUrl(resolvedUrl);
  } catch {
    return null;
  }
}

function sourceFromHost(hostname: string) {
  return hostname.replace(/^www\./, "");
}

async function readLimitedText(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let remaining = MAX_BYTES;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (remaining <= 0) {
      await reader.cancel();
      break;
    }

    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, remaining));
      await reader.cancel();
      break;
    }

    chunks.push(value);
    remaining -= value.byteLength;
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function fetchHtmlWithSafeRedirects(input: string) {
  let currentUrl = await assertSafePublicUrl(input);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        },
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.has("location")
      ) {
        const location = response.headers.get("location");
        currentUrl = await assertSafePublicUrl(new URL(location!, currentUrl).toString());
        continue;
      }

      if (!response.ok) {
        throw new Error(`Article fetch failed with status ${response.status}.`);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

      if (
        contentType &&
        !HTML_CONTENT_TYPES.some((allowedType) => contentType.includes(allowedType))
      ) {
        throw new Error("The URL did not return an HTML article page.");
      }

      return {
        html: await readLimitedText(response),
        finalUrl: currentUrl,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Article URL redirected too many times.");
}

export async function fetchArticleMetadata(input: string): Promise<ArticleMetadata> {
  const { html, finalUrl } = await fetchHtmlWithSafeRedirects(input);
  const final = new URL(finalUrl);
  const title = normalizeTitle(
    matchMeta(html, ["og:title", "twitter:title"]) ?? matchTitle(html) ?? "",
  );

  if (!title) {
    throw new Error("Could not find a title for this article.");
  }

  const snippet = matchMeta(html, [
    "description",
    "og:description",
    "twitter:description",
  ]);
  const imageUrl = await resolveSafeOptionalUrl(
    matchMeta(html, ["og:image", "twitter:image"]),
    finalUrl,
  );
  const author = matchMeta(html, ["author", "article:author"]);
  const publishedAt = matchMeta(html, [
    "article:published_time",
    "date",
    "pubdate",
    "publishdate",
  ]);

  return {
    title,
    url: finalUrl,
    normalizedUrl: normalizeUrl(finalUrl),
    source: sourceFromHost(final.hostname),
    sourceHost: final.hostname,
    snippet,
    imageUrl,
    author,
    publishedAt,
    fetchedAt: new Date().toISOString(),
  };
}
