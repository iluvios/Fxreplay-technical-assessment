-- Seed data — idempotent, safe to re-run.
--
-- Sources:
--   icps                 <- docs/ICP_PROFILES.md
--   experiments/variants <- src/lib/experiments.ts (EXPERIMENTS registry)
--   copy_payload         <- src/lib/copy-dictionary.ts (COPY_DICTIONARY)
--
-- src/lib/experiments.ts and copy-dictionary.ts remain canonical. This seed keeps a
-- queryable snapshot in Postgres so the scheduled AI analysis can join personas and
-- copy against live conversion metrics.

-- ─── ICPs ────────────────────────────────────────────────────────────────────
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
ON CONFLICT (id) DO UPDATE SET
  slug            = EXCLUDED.slug,
  name            = EXCLUDED.name,
  traffic_weight  = EXCLUDED.traffic_weight,
  primary_emotion = EXCLUDED.primary_emotion,
  target_channel  = EXCLUDED.target_channel,
  target_keywords = EXCLUDED.target_keywords,
  core_pains      = EXCLUDED.core_pains,
  core_desires    = EXCLUDED.core_desires;

-- ─── Experiment 1 ────────────────────────────────────────────────────────────
-- Two arms only: a clean control-vs-variant comparison reaches significance sooner
-- and needs no multiple-comparison correction. Further ICP angles run sequentially.
INSERT INTO experiments (id, icp_id, name, hypothesis, status, primary_metric, baseline_cr, target_cr, started_at)
VALUES (
  '1',
  'icp_prop_hunter',
  'prop_firm_loss_aversion_headline',
  'Framing the hero around the sunk cost of failed prop-firm evaluations (loss aversion) converts better than the generic risk-free-backtesting baseline, because the prop-firm audience already has a quantified, recurring monetary loss.',
  'running',
  'signup_completed',
  3.20,
  4.00,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  icp_id         = EXCLUDED.icp_id,
  name           = EXCLUDED.name,
  hypothesis     = EXCLUDED.hypothesis,
  status         = EXCLUDED.status,
  primary_metric = EXCLUDED.primary_metric,
  baseline_cr    = EXCLUDED.baseline_cr,
  target_cr      = EXCLUDED.target_cr;

-- ─── Experiment 1 arms ───────────────────────────────────────────────────────
INSERT INTO experiment_variants (experiment_id, variant_key, variant_name, is_control, weight, copy_payload)
VALUES
(
  '1',
  'control',
  'Control — generic backtesting baseline',
  TRUE,
  50,
  '{
     "eyebrow": "THE PROFESSIONAL BACKTESTER",
     "headline": "Your strategy shouldn''t be tested with real money",
     "subheadline": "FX Replay is arguably the most effective way to backtest your strategies. Execute more confidently and accomplish your trading goals.",
     "cta_text": "Get started for free",
     "cta_subtext": "Start for free. No credit card required."
   }'::jsonb
),
(
  '1',
  '1',
  'Variant — prop firm loss aversion',
  FALSE,
  50,
  '{
     "eyebrow": "PROP FIRM CHALLENGE ACCELERATOR",
     "headline": "Stop burning $300 challenge fees. Prove your edge first.",
     "subheadline": "Simulate FTMO and Apex drawdown rules bar-by-bar. Stress-test your risk before you buy a real evaluation.",
     "cta_text": "Test Your Prop Strategy Free",
     "cta_subtext": "No credit card required. Practice prop rules 100% free."
   }'::jsonb
)
ON CONFLICT (experiment_id, variant_key) DO UPDATE SET
  variant_name = EXCLUDED.variant_name,
  is_control   = EXCLUDED.is_control,
  weight       = EXCLUDED.weight,
  copy_payload = EXCLUDED.copy_payload;
