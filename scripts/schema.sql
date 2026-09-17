-- FX Replay growth schema — Neon PostgreSQL
-- Spec: docs/DATABASE_SCHEMA.md
--
-- Every statement is idempotent (IF NOT EXISTS / ON CONFLICT), so `npm run db:migrate`
-- is safe to re-run. Order matters: referenced tables are created before their
-- dependents.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. icps — Ideal Customer Profiles.
--    Mirrors docs/ICP_PROFILES.md so the scheduled AI analysis can query personas
--    (pains, desires, emotion) alongside live conversion data instead of parsing
--    markdown.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS icps (
    id              VARCHAR(50) PRIMARY KEY,
    slug            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    traffic_weight  NUMERIC(3, 2) NOT NULL DEFAULT 0.33,
    primary_emotion VARCHAR(100) NOT NULL,
    target_channel  VARCHAR(255) NOT NULL,
    target_keywords TEXT[] NOT NULL DEFAULT '{}',
    core_pains      JSONB NOT NULL DEFAULT '[]'::jsonb,
    core_desires    JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. experiments — experiment registry.
--    `id` is the value carried in ?experimentId=, so it stays human-readable
--    rather than a UUID.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS experiments (
    id             VARCHAR(50) PRIMARY KEY,
    icp_id         VARCHAR(50) REFERENCES icps(id) ON DELETE SET NULL,
    name           VARCHAR(255) UNIQUE NOT NULL,
    hypothesis     TEXT NOT NULL,
    status         VARCHAR(50) NOT NULL DEFAULT 'draft',
    primary_metric VARCHAR(100) NOT NULL DEFAULT 'signup_completed',
    baseline_cr    NUMERIC(5, 2),
    target_cr      NUMERIC(5, 2),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at     TIMESTAMPTZ,
    ended_at       TIMESTAMPTZ
);

-- Additive migrations for databases created before these columns existed.
--   winning_variant_id  set by the evaluation agent when it auto-promotes an arm.
--   evaluated_at        last time the agent scored this experiment, so the admin can
--                       see at a glance whether a decision is stale.
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS winning_variant_id UUID;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

-- The agent introduces two terminal states beyond the original four, so the check is
-- rebuilt rather than created once. Dropping first keeps this re-runnable.
ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_status_check;
ALTER TABLE experiments ADD CONSTRAINT experiments_status_check
    CHECK (status IN ('draft', 'running', 'paused', 'completed', 'winner_promoted', 'killed'));

CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. experiment_variants — the arms of each experiment.
--    `variant_key` is the authoritative join back to COPY_DICTIONARY in
--    src/lib/copy-dictionary.ts, which remains the single source of truth for copy
--    (type-safe, code-reviewed, no DB round-trip during SSR).
--    `copy_payload` is a synced snapshot so the AI analysis can reason about the
--    actual wording without importing TypeScript.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS experiment_variants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id VARCHAR(50) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_key   VARCHAR(50) NOT NULL,
    variant_name  VARCHAR(100) NOT NULL,
    is_control    BOOLEAN NOT NULL DEFAULT FALSE,
    weight        INTEGER NOT NULL DEFAULT 50,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    copy_payload  JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_experiment_key
    ON experiment_variants(experiment_id, variant_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. users — signups.
--    Extends docs/DATABASE_SCHEMA.md with `visitor_id` and `experiment_id`:
--    without them a conversion cannot be attributed back to the arm the visitor
--    was bucketed into, which is the whole point of the experiment.
--
--    NOTE: `password` is stored as provided. This is a simulated signup flow for
--    the assessment; a production system would store only an Argon2id/bcrypt hash
--    and never the plaintext.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password      VARCHAR(255) NOT NULL,
    icp_focus     VARCHAR(100) NOT NULL DEFAULT 'general',
    visitor_id    UUID,
    experiment_id VARCHAR(50) REFERENCES experiments(id) ON DELETE SET NULL,
    variant_id    UUID REFERENCES experiment_variants(id) ON DELETE SET NULL,
    -- First-touch marketing attribution (see src/lib/attribution.ts).
    utm_source    VARCHAR(255),
    utm_medium    VARCHAR(255),
    utm_campaign  VARCHAR(255),
    utm_content   VARCHAR(255),
    utm_term      VARCHAR(255),
    click_id      VARCHAR(255),
    referrer      VARCHAR(500),
    channel       VARCHAR(50),
    landing_path  VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive migrations for databases created before these columns existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium   VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_content  VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_term     VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS click_id     VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer     VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS channel      VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS landing_path VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_variant_id ON users(variant_id);
CREATE INDEX IF NOT EXISTS idx_users_visitor_id ON users(visitor_id);
CREATE INDEX IF NOT EXISTS idx_users_channel ON users(channel);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. posthog_event_metrics — daily aggregate snapshots pulled from the PostHog
--    API by the scheduled evaluation job, so experiment results survive
--    independently of PostHog retention.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posthog_event_metrics (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id        VARCHAR(50) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id           UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    snapshot_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    impressions_count    INTEGER NOT NULL DEFAULT 0,
    cta_clicks_count     INTEGER NOT NULL DEFAULT 0,
    signup_starts_count  INTEGER NOT NULL DEFAULT 0,
    signups_count        INTEGER NOT NULL DEFAULT 0,
    conversion_rate      NUMERIC(5, 2) GENERATED ALWAYS AS (
        CASE WHEN impressions_count > 0
             THEN ROUND((signups_count::numeric / impressions_count::numeric) * 100, 2)
             ELSE 0 END
    ) STORED,
    avg_dwell_time_sec   NUMERIC(6, 1) DEFAULT 0.0,
    avg_scroll_depth_pct NUMERIC(5, 2) DEFAULT 0.0,
    p_value              NUMERIC(6, 4),
    stat_sig_reached     BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_variant_snapshot_date UNIQUE (variant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_experiment ON posthog_event_metrics(experiment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. experiment_decisions — audit log of the autonomous evaluation agent.
--
--    Every run writes a row, including the runs that decide to do nothing. An
--    automated system that can pause traffic or rewrite the default experience
--    has to be reconstructable after the fact: which numbers were on the table,
--    which rule fired, what the AI said, and whether the action was actually
--    executed. Without that, "the agent killed my test" is unfalsifiable.
--
--    The statistics are stored alongside the decision rather than recomputed on
--    read, because the underlying counts keep moving — a rationale has to be
--    judged against the data that produced it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS experiment_decisions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id     VARCHAR(50) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id        UUID REFERENCES experiment_variants(id) ON DELETE SET NULL,
    -- PROMOTE | KILL | HUMAN_REVIEW | CONTINUE
    decision          VARCHAR(30) NOT NULL,
    -- cron | manual | human
    trigger_source    VARCHAR(20) NOT NULL DEFAULT 'cron',
    -- Data source the counts came from: posthog | database
    metrics_source    VARCHAR(20) NOT NULL DEFAULT 'database',

    control_visitors  INTEGER NOT NULL DEFAULT 0,
    control_signups   INTEGER NOT NULL DEFAULT 0,
    variant_visitors  INTEGER NOT NULL DEFAULT 0,
    variant_signups   INTEGER NOT NULL DEFAULT 0,
    control_cr        NUMERIC(7, 3),
    variant_cr        NUMERIC(7, 3),
    relative_lift_pct NUMERIC(8, 2),
    z_score           NUMERIC(8, 4),
    p_value           NUMERIC(7, 5),
    confidence_pct    NUMERIC(6, 3),
    sample_target     INTEGER,
    is_significant    BOOLEAN NOT NULL DEFAULT FALSE,
    is_underpowered   BOOLEAN NOT NULL DEFAULT TRUE,

    -- Deterministic explanation of which rule fired, written in code.
    rationale         TEXT NOT NULL,
    -- Qualitative narrative from the LLM layer; null when no model was reachable.
    ai_diagnosis      TEXT,
    ai_model          VARCHAR(80),
    -- What the system actually changed, or why it changed nothing.
    action_taken      TEXT,
    executed          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_experiment
    ON experiment_decisions(experiment_id, created_at DESC);
