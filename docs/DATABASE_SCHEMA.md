# FX Replay Growth Engine: Database Architecture & Schema Specification
**Target Database:** Neon PostgreSQL (Serverless, Branching-ready)  
**Schema Version:** 1.0.0  
**Integration Surfaces:** `/freetrial?lp=X`, `/marketingengine`, `/api/users`, PostHog Webhooks

---

## 1. Architectural Decisions & Rationale

### A. Normalized Tables vs. Nested JSON: The Hybrid Approach
The question was asked: *Is it better to nest experiment variables or create separate tables?*

**The Decision:** **A Normalized Relational Hybrid.**
1. **`experiments` (Parent Table):** Stores test-level metadata (experiment name, hypothesis, status, target ICP, baseline CR, target CR).
2. **`experiment_variants` (Child Table):** Stores individual test treatments (`lp_param = '1'`, `is_control = true/false`).
3. **`copy_payload` as `JSONB` within Variants:** The specific copy elements (`headline`, `subheadline`, `primary_cta`, `pillars`) are stored in a structured JSONB object inside `experiment_variants`.

**Why this is superior to pure nesting:**
* **Clean Analytics Joins:** You can group and aggregate conversion data by `variant_id` directly in SQL without parsing nested JSON arrays (`SELECT variant_id, COUNT(*) FROM users GROUP BY variant_id`).
* **PostHog Feature Flag Parity:** Each variant row maps 1:1 to a PostHog variant key (`control`, `prop-firm`, `weekend-trader`).
* **Zero-Downtime Updates:** You can tweak a single variant's copy without locking or rewriting the entire experiment row.

---

## 2. Entity-Relationship Diagram (ERD)

```
┌────────────────────────┐
│         users          │
├────────────────────────┤
│ id (UUID, PK)          │
│ name (VARCHAR)         │
│ email (VARCHAR, UNIQUE)│
│ password (VARCHAR)     │
│ icp_focus (VARCHAR)    │
│ variant_id (UUID, FK)  │
│ created_at (TIMESTAMPTZ│
│ updated_at (TIMESTAMPTZ│
└────────────────────────┘
            ▲
            │ (attaches signup to variant)
┌────────────────────────┐         1:N         ┌────────────────────────┐
│          icps          │ ─────────────────── │      experiments       │
├────────────────────────┤                     ├────────────────────────┤
│ id (VARCHAR, PK)       │                     │ id (UUID, PK)          │
│ slug (VARCHAR, UNIQUE) │                     │ icp_id (VARCHAR, FK)   │
│ name (VARCHAR)         │                     │ name (VARCHAR)         │
│ traffic_weight (NUMERIC│                     │ hypothesis (TEXT)      │
│ target_keywords (TEXT[]│                     │ status (VARCHAR)       │
│ core_pains (JSONB)     │                     │ baseline_cr (NUMERIC)  │
│ core_desires (JSONB)   │                     │ target_cr (NUMERIC)    │
│ created_at (TIMESTAMPTZ│                     │ created_at (TIMESTAMPTZ│
└────────────────────────┘                     └───────────┬────────────┘
                                                           │ 1:N
                                                           ▼
                                               ┌────────────────────────┐
                                               │  experiment_variants   │
                                               ├────────────────────────┤
                                               │ id (UUID, PK)          │
                                               │ experiment_id (UUID, FK│
                                               │ lp_param (VARCHAR)     │
                                               │ variant_name (VARCHAR) │
                                               │ is_control (BOOLEAN)   │
                                               │ copy_payload (JSONB)   │
                                               │ active (BOOLEAN)       │
                                               │ created_at (TIMESTAMPTZ│
                                               └───────────┬────────────┘
                                                           │ 1:N
                                                           ▼
                                               ┌────────────────────────┐
                                               │  posthog_event_metrics │
                                               ├────────────────────────┤
                                               │ id (UUID, PK)          │
                                               │ experiment_id (UUID, FK│
                                               │ variant_id (UUID, FK)  │
                                               │ snapshot_date (DATE)   │
                                               │ impressions_count (INT)│
                                               │ modal_opens_count (INT)│
                                               │ signups_count (INT)    │
                                               │ conversion_rate (NUM)  │
                                               │ avg_dwell_time_sec (NUM│
                                               │ avg_scroll_depth (NUM) │
                                               │ p_value (NUMERIC)      │
                                               │ stat_sig_reached (BOOL)│
                                               │ synced_at (TIMESTAMPTZ)│
                                               └────────────────────────┘
```

---

## 3. Table Specifications & Column DDL

### Table 1: `users` (Frictionless Account Data)
*No complex hashing or auth layers required for the assessment. Fast, structured storage.*

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Stored as provided for rapid assessment
    icp_focus VARCHAR(100) DEFAULT 'general', -- e.g., 'prop_firm', 'weekend', 'systematizer'
    variant_id UUID REFERENCES experiment_variants(id) ON DELETE SET NULL, -- Attribution tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_variant_id ON users(variant_id);
```

---

### Table 2: `icps` (Ideal Customer Profiles)
*Matches the `ICP_PROFILES.md` document on disk, making personas queryable by `/marketingengine`.*

```sql
CREATE TABLE IF NOT EXISTS icps (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'icp_prop_hunter'
    slug VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'prop-firm-hunter'
    name VARCHAR(255) NOT NULL,
    traffic_weight NUMERIC(3, 2) NOT NULL DEFAULT 0.33, -- e.g. 0.60
    primary_emotion VARCHAR(100) NOT NULL, -- e.g. 'Loss Aversion'
    target_channel VARCHAR(255) NOT NULL, -- e.g. 'Google Search / Meta Ads'
    target_keywords TEXT[] NOT NULL DEFAULT '{}',
    core_pains JSONB NOT NULL DEFAULT '[]'::jsonb,
    core_desires JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Table 3: `experiments` (Experiment Registry)
*Tracks overall test hypotheses, status, and baseline conversion metrics.*

```sql
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icp_id VARCHAR(50) REFERENCES icps(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    hypothesis TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'
    baseline_cr NUMERIC(5, 2) NOT NULL DEFAULT 3.20, -- Current baseline %
    target_cr NUMERIC(5, 2) NOT NULL DEFAULT 4.50,   -- Expected target %
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
```

---

### Table 4: `experiment_variants` (The Copy Variations)
*Stores the specific messaging configurations delivered to `/freetrial?lp=X`.*

```sql
CREATE TABLE IF NOT EXISTS experiment_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    lp_param VARCHAR(20) NOT NULL, -- 'control', '1', '2', '3'
    variant_name VARCHAR(100) NOT NULL,
    is_control BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    copy_payload JSONB NOT NULL, -- Structured headlines, subheads, CTAs, and pillars
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_exp_lp ON experiment_variants(experiment_id, lp_param);
```

#### The `copy_payload` JSON Structure:
```json
{
  "eyebrow": "PROP FIRM CHALLENGE ACCELERATOR",
  "hero_headline": "Stop burning $300 challenge fees. Prove your edge first.",
  "subheadline": "Simulate strict FTMO and Apex drawdown rules bar-by-bar. Discover your edge before you buy an evaluation.",
  "primary_cta": "Test Your Prop Strategy Free",
  "cta_microcopy": "No credit card required. Practice prop rules 100% free.",
  "pillar_1": {
    "title": "Built-in Prop Rules Engine",
    "description": "Live tracking of max daily loss and profit targets in real time."
  },
  "pillar_2": {
    "title": "Fail in Replay, Not on Evaluation",
    "description": "Save thousands in resets by stress-testing your strategy first."
  },
  "pillar_3": {
    "title": "Payout-Ready Analytics",
    "description": "Export verified trade logs and equity curves."
  }
}
```

---

### Table 5: `posthog_event_metrics` (Analytics & Telemetry Snapshots)
*Syncs aggregated data from PostHog into PostgreSQL for display in `/marketingengine`.*

```sql
CREATE TABLE IF NOT EXISTS posthog_event_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    impressions_count INT NOT NULL DEFAULT 0,
    modal_opens_count INT NOT NULL DEFAULT 0,
    signups_count INT NOT NULL DEFAULT 0,
    conversion_rate NUMERIC(5, 2) GENERATED ALWAYS AS (
        CASE WHEN impressions_count > 0 
        THEN ROUND((signups_count::numeric / impressions_count::numeric) * 100, 2) 
        ELSE 0 END
    ) STORED,
    avg_dwell_time_sec NUMERIC(6, 1) DEFAULT 0.0,
    avg_scroll_depth_pct NUMERIC(5, 2) DEFAULT 0.0,
    p_value NUMERIC(6, 4), -- Calculated against control
    stat_sig_reached BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_variant_snapshot_date UNIQUE (variant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_variant ON posthog_event_metrics(variant_id);
```

---

## 4. Complete Ready-to-Execute SQL Migration Script

The entire database setup can be executed in a single transaction directly on Neon:

```sql
BEGIN;

-- 1. ICPs
CREATE TABLE IF NOT EXISTS icps (
    id VARCHAR(50) PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    traffic_weight NUMERIC(3, 2) NOT NULL DEFAULT 0.33,
    primary_emotion VARCHAR(100) NOT NULL,
    target_channel VARCHAR(255) NOT NULL,
    target_keywords TEXT[] NOT NULL DEFAULT '{}',
    core_pains JSONB NOT NULL DEFAULT '[]'::jsonb,
    core_desires JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Experiments
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icp_id VARCHAR(50) REFERENCES icps(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    hypothesis TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    baseline_cr NUMERIC(5, 2) NOT NULL DEFAULT 3.20,
    target_cr NUMERIC(5, 2) NOT NULL DEFAULT 4.50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

-- 3. Variants
CREATE TABLE IF NOT EXISTS experiment_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    lp_param VARCHAR(20) NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    is_control BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    copy_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_exp_lp ON experiment_variants(experiment_id, lp_param);

-- 4. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    icp_focus VARCHAR(100) DEFAULT 'general',
    variant_id UUID REFERENCES experiment_variants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Metrics & PostHog Telemetry
CREATE TABLE IF NOT EXISTS posthog_event_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    impressions_count INT NOT NULL DEFAULT 0,
    modal_opens_count INT NOT NULL DEFAULT 0,
    signups_count INT NOT NULL DEFAULT 0,
    conversion_rate NUMERIC(5, 2) GENERATED ALWAYS AS (
        CASE WHEN impressions_count > 0 
        THEN ROUND((signups_count::numeric / impressions_count::numeric) * 100, 2) 
        ELSE 0 END
    ) STORED,
    avg_dwell_time_sec NUMERIC(6, 1) DEFAULT 0.0,
    avg_scroll_depth_pct NUMERIC(5, 2) DEFAULT 0.0,
    p_value NUMERIC(6, 4),
    stat_sig_reached BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_variant_snapshot_date UNIQUE (variant_id, snapshot_date)
);

COMMIT;
```

---

## 5. Seed Data Script (Instantly Populates the 3 ICPs & Active Test)

```sql
-- Seed ICPs
INSERT INTO icps (id, slug, name, traffic_weight, primary_emotion, target_channel, target_keywords, core_pains, core_desires)
VALUES 
(
  'icp_prop_hunter', 
  'prop-firm-hunter', 
  'Prop Firm Challenge Hunter', 
  0.60, 
  'Loss Aversion', 
  'Google Search (FTMO/Prop) & Meta Ads',
  ARRAY['pass ftmo challenge', 'prop firm simulator', 'apex drawdown rules', 'backtesting for prop firms'],
  '["Bleeding $300-$500 per failed evaluation", "Failing on the 5% max daily drawdown rule", "Emotional imposter syndrome"]'::jsonb,
  '["Get funded for $100k-$200k", "Receive consistent profit splits", "Verify mathematical edge first"]'::jsonb
),
(
  'icp_weekend_warrior', 
  'weekend-warrior', 
  '9-to-5 Weekend Warrior', 
  0.30, 
  'Time Compression', 
  'Meta Professionals, LinkedIn, Weekend Retargeting',
  ARRAY['how to practice trading on weekends', 'weekend forex backtesting', 'market replay closed markets'],
  '["Cannot watch live London/NY opens during corporate work", "Markets closed on weekends", "Slow 5-year learning curve"]'::jsonb,
  '["Trade 1 year of price action in a single weekend", "Build edge without quitting day job", "24/7 market access"]'::jsonb
),
(
  'icp_tv_skeptic', 
  'tradingview-skeptic', 
  'Systematizer / TradingView Skeptic', 
  0.10, 
  'Data Precision', 
  'TradingView Search & Technical Communities',
  ARRAY['tradingview bar replay alternatives', 'tradingview lookahead bias bug', 'multi-timeframe backtesting'],
  '["TradingView replay flashes future candles on TF switch", "Only steps one timeframe", "No sub-second tick precision"]'::jsonb,
  '["Zero lookahead bias", "True synchronized multi-timeframe stepping", "Sub-second tick accuracy"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
```

---

## 6. How the Application Interacts with this DB

1. **When a user loads `/freetrial?lp=1`:**
   Astro SSR runs:
   ```sql
   SELECT copy_payload, id FROM experiment_variants WHERE lp_param = '1' AND active = TRUE LIMIT 1;
   ```
   Renders the HTML directly.
2. **When a user submits the signup modal:**
   Astro API (`/api/users`) runs:
   ```sql
   INSERT INTO users (name, email, password, icp_focus, variant_id) 
   VALUES ($1, $2, $3, $4, $5) 
   RETURNING id, name, email, icp_focus, created_at;
   ```
3. **When an engineer opens `/marketingengine`:**
   Astro SSR runs a single query fetching active experiments alongside their variant conversion rates and PostHog metrics snapshot.
