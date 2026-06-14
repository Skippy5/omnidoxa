"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  Clock3,
  Eye,
  Mail,
  Newspaper,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import type { BriefingPreferencesDto } from "@/lib/briefing-preferences";

type BriefingConfigurationProps = {
  authConfigured: boolean;
  isMember: boolean;
  email: string | null;
  membershipLabel: string;
  initialPreferences: BriefingPreferencesDto;
  availableCategories: string[];
};

type ToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
};

function Toggle({ checked, disabled, label, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onChange}
      className="relative h-7 w-12 rounded-full border border-[var(--rule)] bg-[var(--metric-track)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[checked=true]:border-[var(--accent)] data-[checked=true]:bg-[var(--accent)]"
      data-checked={checked}
    >
      <span
        className="absolute left-1 top-1 h-5 w-5 rounded-full bg-[var(--heading)] transition-transform data-[checked=true]:translate-x-5"
        data-checked={checked}
      />
    </button>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
  toggle,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  toggle?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <section
      className="rounded-md border border-[var(--rule)] bg-[var(--surface)] p-5 shadow-[var(--shell-shadow)] sm:p-6"
      data-disabled={disabled}
    >
      <div className="flex items-start justify-between gap-5">
        <div className={disabled ? "opacity-55" : undefined}>
          <div className="flex items-center gap-2 text-[var(--heading)]">
            <span className="text-[var(--accent)]">{icon}</span>
            <h2 className="font-serif text-xl font-bold italic leading-tight">
              {title}
            </h2>
          </div>
          {subtitle ? (
            <p className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {toggle}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="min-h-9 rounded border border-[var(--rule)] bg-[var(--page)] px-3 font-mono text-[10px] uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)]"
    >
      {label}
    </button>
  );
}

export function BriefingConfiguration({
  authConfigured,
  isMember,
  email,
  membershipLabel,
  initialPreferences,
  availableCategories,
}: BriefingConfigurationProps) {
  const [location, setLocation] = useState(initialPreferences.location);
  const [stockInput, setStockInput] = useState("");
  const [stockTickers, setStockTickers] = useState(
    initialPreferences.stockTickers,
  );
  const [newsInput, setNewsInput] = useState(availableCategories[0] ?? "");
  const [newsTopics, setNewsTopics] = useState(
    initialPreferences.newsCategories,
  );
  const [deliveryTime, setDeliveryTime] = useState(
    initialPreferences.deliveryTime,
  );
  const [weatherEnabled, setWeatherEnabled] = useState(Boolean(location));
  const [marketEnabled, setMarketEnabled] = useState(true);
  const [stocksEnabled, setStocksEnabled] = useState(stockTickers.length > 0);
  const [newsEnabled, setNewsEnabled] = useState(newsTopics.length > 0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedNewsOptions = useMemo(
    () => new Set(newsTopics),
    [newsTopics],
  );

  async function savePreferences() {
    setError(null);
    setMessage(null);

    if (!isMember) {
      setError("Sign in before saving a Daily Briefing.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/briefing/preferences", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          location: weatherEnabled ? location : "",
          stockTickers: stocksEnabled ? stockTickers : [],
          newsCategories: newsEnabled ? newsTopics : [],
          deliveryTime,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        preferences?: BriefingPreferencesDto;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not save briefing preferences.");
      }

      if (data.preferences) {
        setLocation(data.preferences.location);
        setStockTickers(data.preferences.stockTickers);
        setNewsTopics(data.preferences.newsCategories);
        setDeliveryTime(data.preferences.deliveryTime);
      }

      setMessage("Briefing configuration saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save briefing preferences.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function resetDefaults() {
    setLocation("");
    setStockInput("");
    setStockTickers([]);
    setNewsTopics(["Politics", "Business", "Tech & AI"]);
    setDeliveryTime("08:00");
    setWeatherEnabled(false);
    setMarketEnabled(true);
    setStocksEnabled(false);
    setNewsEnabled(true);
    setPreviewOpen(false);
    setMessage("Defaults restored.");
    setError(null);
  }

  function addStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ticker = stockInput.trim().toUpperCase();

    if (!ticker || stockTickers.includes(ticker) || stockTickers.length >= 10) {
      return;
    }

    setStockTickers((current) => [...current, ticker]);
    setStockInput("");
    setStocksEnabled(true);
  }

  function addNewsTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newsInput || selectedNewsOptions.has(newsInput) || newsTopics.length >= 5) {
      return;
    }

    setNewsTopics((current) => [...current, newsInput]);
    setNewsEnabled(true);
  }

  return (
    <main className="min-h-dvh bg-[var(--page)] text-foreground">
      <header className="border-b border-[var(--rule)] bg-[var(--footer)]">
        <div className="mx-auto flex min-h-20 w-full max-w-6xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link
              href="/"
              className="font-serif text-2xl font-bold text-[var(--heading)]"
            >
              OmniDoxa
            </Link>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-normal text-[var(--subtle)]">
              Daily Briefing Configuration
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded border border-[var(--rule)] px-4 font-mono text-xs uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)]"
          >
            <ArrowLeft size={15} />
            Back to News
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="font-mono text-xs font-semibold uppercase text-[var(--accent)]">
            Phase 6 Basic Briefing
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold italic leading-tight text-[var(--heading)] sm:text-5xl">
            Build your morning intelligence brief.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--copy)]">
            Choose the daily modules OmniDoxa should prepare around your account.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void savePreferences()}
            disabled={isSaving || !isMember}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-[var(--button-bg)] px-5 font-mono text-xs uppercase text-[var(--button-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Save size={16} />
            {isSaving ? "Saving" : "Save Configuration"}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen((current) => !current)}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-[var(--rule)] px-5 font-mono text-xs uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)]"
          >
            <Eye size={16} />
            Preview Briefing
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-[var(--rule)] px-5 font-mono text-xs uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)]"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          {!isMember && authConfigured ? (
            <>
              <SignInButton mode="modal">
                <button className="inline-flex min-h-11 items-center gap-2 rounded border border-[var(--rule-strong)] px-5 font-mono text-xs uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)]">
                  <User size={16} />
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="inline-flex min-h-11 items-center gap-2 rounded border border-[var(--rule)] px-5 font-mono text-xs uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)]">
                  <Mail size={16} />
                  Join
                </button>
              </SignUpButton>
            </>
          ) : null}
        </div>

        {message ? (
          <p className="mt-5 rounded border border-[var(--rule-strong)] bg-[var(--panel)] p-4 text-sm text-[var(--heading)]">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-5 rounded border border-[var(--sentiment-critical)] bg-[var(--panel)] p-4 text-sm text-[var(--heading)]">
            {error}
          </p>
        ) : null}

        <div className="mt-7 grid gap-5">
          <Section icon={<User size={20} />} title="Personal Info">
            <div className="grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-[var(--heading)]">
                Name
                <input
                  value={isMember ? "OmniDoxa Member" : "Guest"}
                  readOnly
                  className="min-h-11 rounded border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--muted)] outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--heading)]">
                Email
                <input
                  value={email ?? "Sign in to connect an email"}
                  readOnly
                  className="min-h-11 rounded border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--muted)] outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--heading)]">
                Membership Level
                <input
                  value={membershipLabel}
                  readOnly
                  className="min-h-11 rounded border border-[var(--rule)] bg-[var(--panel)] px-3 text-sm font-normal text-[var(--heading)] outline-none"
                />
              </label>
            </div>
          </Section>

          <Section
            icon={<Sparkles size={20} />}
            title="Weather"
            toggle={
              <Toggle
                label="Toggle weather"
                checked={weatherEnabled}
                onChange={() => setWeatherEnabled((current) => !current)}
              />
            }
          >
            <label className="grid gap-2 text-sm font-semibold text-[var(--heading)]">
              Location
              <input
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setWeatherEnabled(Boolean(event.target.value.trim()));
                }}
                placeholder="Woodstock, GA"
                className="min-h-11 rounded border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--heading)] outline-none focus:border-[var(--accent)]"
              />
            </label>
          </Section>

          <Section
            icon={<BarChart3 size={20} />}
            title="Market Overview"
            subtitle="S&P 500, Dow, Nasdaq, Futures"
            toggle={
              <Toggle
                label="Toggle markets"
                checked={marketEnabled}
                onChange={() => setMarketEnabled((current) => !current)}
              />
            }
          />

          <Section
            icon={<TrendingUp size={20} />}
            title="Stock Watchlist"
            toggle={
              <Toggle
                label="Toggle stock watchlist"
                checked={stocksEnabled}
                onChange={() => setStocksEnabled((current) => !current)}
              />
            }
          >
            <form onSubmit={addStock} className="flex flex-col gap-3 sm:flex-row">
              <input
                value={stockInput}
                onChange={(event) => setStockInput(event.target.value)}
                placeholder="AAPL"
                className="min-h-11 flex-1 rounded border border-[var(--rule)] bg-[var(--page)] px-3 text-sm text-[var(--heading)] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                disabled={stockTickers.length >= 10}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[var(--rule)] px-4 font-mono text-xs uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Plus size={15} />
                Add Stock ({stockTickers.length}/10)
              </button>
            </form>
            {stockTickers.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {stockTickers.map((ticker) => (
                  <Chip
                    key={ticker}
                    label={ticker}
                    onRemove={() =>
                      setStockTickers((current) =>
                        current.filter((item) => item !== ticker),
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </Section>

          <Section
            icon={<Newspaper size={20} />}
            title="News Topics"
            toggle={
              <Toggle
                label="Toggle news topics"
                checked={newsEnabled}
                onChange={() => setNewsEnabled((current) => !current)}
              />
            }
          >
            <form onSubmit={addNewsTopic} className="flex flex-col gap-3 sm:flex-row">
              <select
                value={newsInput}
                onChange={(event) => setNewsInput(event.target.value)}
                className="min-h-11 flex-1 rounded border border-[var(--rule)] bg-[var(--page)] px-3 text-sm text-[var(--heading)] outline-none focus:border-[var(--accent)]"
              >
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={newsTopics.length >= 5}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[var(--rule)] px-4 font-mono text-xs uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Plus size={15} />
                Add Topic ({newsTopics.length}/5)
              </button>
            </form>
            {newsTopics.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {newsTopics.map((topic) => (
                  <Chip
                    key={topic}
                    label={topic}
                    onRemove={() =>
                      setNewsTopics((current) =>
                        current.filter((item) => item !== topic),
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </Section>

          <Section
            icon={<Brain size={20} />}
            title="Smart Briefing"
            subtitle="Premium"
            disabled
            toggle={
              <Toggle
                label="Smart briefing locked"
                checked={false}
                disabled
                onChange={() => undefined}
              />
            }
          />

          <Section
            icon={<Clock3 size={20} />}
            title="Delivery Schedule"
            subtitle="Coming soon"
            disabled
            toggle={
              <Toggle
                label="Delivery schedule unavailable"
                checked={false}
                disabled
                onChange={() => undefined}
              />
            }
          >
            <label className="grid gap-2 text-sm font-semibold text-[var(--heading)] opacity-60">
              Delivery Time
              <input
                type="time"
                value={deliveryTime}
                onChange={(event) => setDeliveryTime(event.target.value)}
                disabled
                className="min-h-11 rounded border border-[var(--rule)] bg-[var(--page)] px-3 text-sm font-normal text-[var(--muted)] outline-none"
              />
            </label>
          </Section>
        </div>

        {previewOpen ? (
          <section className="mt-7 rounded-md border border-[var(--rule-strong)] bg-[var(--panel-strong)] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[var(--heading)]">
              <Shield size={18} className="text-[var(--accent)]" />
              <h2 className="font-serif text-xl font-bold italic">
                Briefing Preview
              </h2>
            </div>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--copy)] sm:grid-cols-2">
              <p>Weather: {weatherEnabled && location ? location : "Off"}</p>
              <p>Markets: {marketEnabled ? "Overview on" : "Off"}</p>
              <p>
                Stocks:{" "}
                {stocksEnabled && stockTickers.length
                  ? stockTickers.join(", ")
                  : "Off"}
              </p>
              <p>
                Topics:{" "}
                {newsEnabled && newsTopics.length ? newsTopics.join(", ") : "Off"}
              </p>
            </div>
          </section>
        ) : null}

        <div className="flex justify-center py-8">
          <button
            type="button"
            onClick={() => void savePreferences()}
            disabled={isSaving || !isMember}
            className="inline-flex min-h-12 items-center gap-2 rounded bg-[var(--button-bg)] px-8 font-mono text-xs uppercase text-[var(--button-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Save size={16} />
            Save Configuration
          </button>
        </div>
      </div>
    </main>
  );
}
