CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  central_development TEXT,
  neutral_summary TEXT,
  discourse_summary TEXT,
  discourse_preview TEXT,
  category TEXT,
  status TEXT DEFAULT 'draft',
  main_feed_enabled INTEGER DEFAULT 1,
  category_feed_enabled INTEGER DEFAULT 1,
  is_featured_main INTEGER DEFAULT 0,
  featured_at TEXT,
  heat_score REAL DEFAULT 0,
  discovery_sources TEXT,
  first_seen_at TEXT NOT NULL,
  last_updated_at TEXT NOT NULL,
  last_sentiment_at TEXT,
  analysis_version INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topic_articles (
  id TEXT PRIMARY KEY,
  topic_id TEXT REFERENCES topics(id) ON DELETE CASCADE,
  article_role TEXT DEFAULT 'anchor',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  source_tier INTEGER DEFAULT 1,
  snippet TEXT,
  image_url TEXT,
  author TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  is_material_update INTEGER DEFAULT 0,
  narrative_bias_score REAL,
  narrative_bias_label TEXT,
  narrative_bias_reasoning TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topic_analysis_runs (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  analysis_version INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  raw_response_json TEXT NOT NULL,
  review_status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(topic_id, analysis_version)
);

CREATE TABLE IF NOT EXISTS topic_viewpoints (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  lean TEXT NOT NULL,
  label TEXT,
  summary TEXT NOT NULL,
  original_summary TEXT,
  sentiment_score REAL,
  analysis_version INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topic_social_posts (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  viewpoint_lean TEXT NOT NULL,
  author TEXT,
  author_handle TEXT,
  text TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT DEFAULT 'x',
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  review_status TEXT DEFAULT 'candidate',
  is_verified INTEGER DEFAULT 0,
  post_date TEXT,
  analysis_version INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topic_updates (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL,
  description TEXT,
  source TEXT,
  detected_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'free',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_grants (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TEXT DEFAULT (datetime('now')),
  revoked_at TEXT
);

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
);

CREATE TABLE IF NOT EXISTS briefing_preferences (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  location TEXT,
  stock_tickers TEXT,
  news_categories TEXT,
  delivery_time TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_main_feed ON topics(status, main_feed_enabled, is_featured_main);
CREATE INDEX IF NOT EXISTS idx_topics_category_feed ON topics(status, category, category_feed_enabled);
CREATE INDEX IF NOT EXISTS idx_topics_heat ON topics(heat_score DESC);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
CREATE INDEX IF NOT EXISTS idx_topics_last_sentiment ON topics(last_sentiment_at);
CREATE INDEX IF NOT EXISTS idx_articles_topic ON topic_articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_articles_url_hash ON topic_articles(url_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_topic_version ON topic_analysis_runs(topic_id, analysis_version);
CREATE INDEX IF NOT EXISTS idx_viewpoints_topic_version ON topic_viewpoints(topic_id, analysis_version);
CREATE INDEX IF NOT EXISTS idx_social_topic_version ON topic_social_posts(topic_id, analysis_version);
CREATE INDEX IF NOT EXISTS idx_social_review ON topic_social_posts(topic_id, analysis_version, review_status);
CREATE INDEX IF NOT EXISTS idx_updates_topic ON topic_updates(topic_id);
CREATE INDEX IF NOT EXISTS idx_members_clerk_user ON members(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_grants_member ON admin_grants(member_id);
CREATE INDEX IF NOT EXISTS idx_access_overrides_email ON access_overrides(email);
CREATE INDEX IF NOT EXISTS idx_access_overrides_active ON access_overrides(revoked_at);
