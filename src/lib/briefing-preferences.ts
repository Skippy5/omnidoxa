import "server-only";

import { getDb } from "@/lib/db";
import { newsCategories } from "@/lib/topic-types";

const MAX_LOCATION_LENGTH = 120;
const MAX_STOCKS = 10;
const MAX_NEWS_CATEGORIES = 5;
const TICKER_PATTERN = /^[A-Z0-9.-]{1,12}$/;

export type BriefingPreferencesDto = {
  location: string;
  stockTickers: string[];
  newsCategories: string[];
  deliveryTime: string;
};

export const defaultBriefingPreferences: BriefingPreferencesDto = {
  location: "",
  stockTickers: [],
  newsCategories: ["Politics", "Business", "Tech & AI"],
  deliveryTime: "08:00",
};

function parseJsonArray(value: unknown) {
  if (typeof value !== "string" || !value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizeLocation(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_LOCATION_LENGTH)
    : "";
}

function normalizeStockTickers(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => TICKER_PATTERN.test(item)),
    ),
  ).slice(0, MAX_STOCKS);
}

function normalizeNewsCategories(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set(newsCategories);

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .filter((item) => allowed.has(item)),
    ),
  ).slice(0, MAX_NEWS_CATEGORIES);
}

function normalizeDeliveryTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return defaultBriefingPreferences.deliveryTime;
  }

  return value;
}

export function normalizeBriefingPreferences(
  value: Partial<BriefingPreferencesDto>,
): BriefingPreferencesDto {
  return {
    location: normalizeLocation(value.location),
    stockTickers: normalizeStockTickers(value.stockTickers),
    newsCategories: normalizeNewsCategories(value.newsCategories),
    deliveryTime: normalizeDeliveryTime(value.deliveryTime),
  };
}

export async function getBriefingPreferences(memberId: string) {
  const result = await getDb().execute({
    sql: `
      SELECT id, location, stock_tickers, news_categories, delivery_time
      FROM briefing_preferences
      WHERE member_id = ?
      ORDER BY created_at ASC
      LIMIT 1
    `,
    args: [memberId],
  });

  const row = result.rows[0];

  if (!row) {
    return defaultBriefingPreferences;
  }

  return normalizeBriefingPreferences({
    location: typeof row.location === "string" ? row.location : "",
    stockTickers: parseJsonArray(row.stock_tickers),
    newsCategories: parseJsonArray(row.news_categories),
    deliveryTime:
      typeof row.delivery_time === "string"
        ? row.delivery_time
        : defaultBriefingPreferences.deliveryTime,
  });
}

export async function saveBriefingPreferences(
  memberId: string,
  value: Partial<BriefingPreferencesDto>,
) {
  const preferences = normalizeBriefingPreferences(value);
  const existing = await getDb().execute({
    sql: `
      SELECT id
      FROM briefing_preferences
      WHERE member_id = ?
      ORDER BY created_at ASC
      LIMIT 1
    `,
    args: [memberId],
  });
  const existingId = existing.rows[0]?.id;

  if (typeof existingId === "string") {
    await getDb().execute({
      sql: `
        UPDATE briefing_preferences
        SET location = ?,
            stock_tickers = ?,
            news_categories = ?,
            delivery_time = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        preferences.location,
        JSON.stringify(preferences.stockTickers),
        JSON.stringify(preferences.newsCategories),
        preferences.deliveryTime,
        existingId,
      ],
    });
  } else {
    await getDb().execute({
      sql: `
        INSERT INTO briefing_preferences (
          id,
          member_id,
          location,
          stock_tickers,
          news_categories,
          delivery_time,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      args: [
        crypto.randomUUID(),
        memberId,
        preferences.location,
        JSON.stringify(preferences.stockTickers),
        JSON.stringify(preferences.newsCategories),
        preferences.deliveryTime,
      ],
    });
  }

  return preferences;
}
