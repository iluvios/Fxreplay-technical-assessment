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

-- ─── Experiments ─────────────────────────────────────────────────────────────
-- One experiment per ICP. Each runs three competing messages against the same generic
-- control, so every test asks: does speaking to this audience specifically beat the
-- message they would otherwise have seen?
--
-- Three treatment arms find a winner in one cycle instead of three sequential tests,
-- which matters at ~1,240 visitors per arm. The cost is three chances to look
-- significant by luck; the evaluation agent pays for it with a Šidák correction on the
-- promote gate (src/lib/agent/decide.ts).
INSERT INTO experiments (id, icp_id, name, hypothesis, status, primary_metric, baseline_cr, target_cr, started_at)
VALUES
(
  '1',
  'icp_prop_hunter',
  'prop_firm_message_angle',
  'For prop-firm evaluation traders, a hero that names a specific cost they have already paid — failed evaluation fees, the daily drawdown rule, or the absence of a track record — converts better than the generic risk-free-backtesting baseline, because this audience has a quantified, recurring and recent monetary loss.',
  'running',
  'signup_completed',
  3.20,
  4.00,
  NOW()
),
(
  '2',
  'icp_weekend_warrior',
  'weekend_warrior_message_angle',
  'For time-poor professionals, a hero built on the scarcity of practice time — compressed market hours, accumulated repetitions, or learning without risking salary — converts better than the generic baseline, because their blocker is available hours rather than money or motivation.',
  'running',
  'signup_completed',
  3.20,
  4.00,
  NOW()
),
(
  '3',
  'icp_tv_skeptic',
  'precision_message_angle',
  'For technical traders already paying for a charting tool, a hero making a falsifiable claim about measurement fidelity — no lookahead bias, tick-level fills, or journalled expectancy — converts better than the generic baseline, because this audience distrusts marketing language and responds to specifics they can verify themselves.',
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

-- ─── Arms ────────────────────────────────────────────────────────────────────
-- `variant_key` joins to COPY_DICTIONARY in src/lib/copy-dictionary.ts, which stays the
-- canonical source for the words. `copy_payload` is a snapshot so the AI diagnosis layer
-- can read the actual wording without importing TypeScript.
--
-- Even 25/25/25/25 weights: equal allocation reaches significance fastest for a fixed
-- volume of traffic. Skewing is a deliberate later decision, editable per arm in
-- /marketingengine.
INSERT INTO experiment_variants (experiment_id, variant_key, variant_name, is_control, weight, copy_payload)
VALUES
-- Experiment 1 — Prop Firm Challenge Hunter
(
  '1', 'control', 'Control — generic baseline', TRUE, 25,
  '{
     "eyebrow": "THE PROFESSIONAL BACKTESTER",
     "headline": "Your strategy shouldn''t be tested with real money",
     "subheadline": "FX Replay is arguably the most effective way to backtest your strategies.",
     "cta_text": "Get started for free",
     "mechanism": "generic baseline"
   }'::jsonb
),
(
  '1', 'prop_fees', 'Sunk cost — fees already burned', FALSE, 25,
  '{
     "eyebrow": "$0 TO FAIL HERE",
     "headline": "Every failed evaluation costs $300. This one costs nothing.",
     "subheadline": "Most evaluations don''t die on strategy — they die on trailing drawdown, an unrealised equity spike at the NY open that never showed up on your daily chart. Run your exact rules bar-by-bar against real sessions until you know where your equity curve breaks, before $500 is on the line.",
     "cta_text": "Test Your Prop Rules Free",
     "mechanism": "sunk cost — names money already lost, not money to be made"
   }'::jsonb
),
(
  '1', 'prop_rules', 'Diagnosis — trailing drawdown on unrealised equity', FALSE, 25,
  '{
     "eyebrow": "DRAWDOWN RULES ENGINE",
     "headline": "Your strategy didn''t fail the challenge. Your trailing drawdown did.",
     "subheadline": "Simulate strict trailing drawdown calculated tick-by-tick on unrealised equity. See where your risk breaks before paying another $300 reset fee.",
     "cta_text": "Test Your Risk Rules Free",
     "mechanism": "diagnosis — reframes failure as a fixable trailing drawdown risk-rule problem"
   }'::jsonb
),
(
  '1', 'prop_funded', 'Earned confidence — $0 resets', FALSE, 25,
  '{
     "eyebrow": "$0 TO FAIL HERE",
     "headline": "Blow the account here first. Resets are free.",
     "subheadline": "Run hundreds of simulated challenge days bar-by-bar under live rules. Discover where your drawdown threshold breaks while finding out costs nothing.",
     "cta_text": "Test Your Prop Rules Free",
     "mechanism": "earned confidence — preparation and evidence over fear"
   }'::jsonb
),

-- Experiment 2 — 9-to-5 Weekend Warrior
(
  '2', 'control', 'Control — generic baseline', TRUE, 25,
  '{
     "eyebrow": "THE PROFESSIONAL BACKTESTER",
     "headline": "Your strategy shouldn''t be tested with real money",
     "subheadline": "FX Replay is arguably the most effective way to backtest your strategies.",
     "cta_text": "Get started for free",
     "mechanism": "generic baseline"
   }'::jsonb
),
(
  '2', 'weekend_year', 'Time compression — London opens compressed into Sunday', FALSE, 25,
  '{
     "eyebrow": "THE LONDON OPEN, AT 9PM YOUR TIME",
     "headline": "A year of London opens, compressed into one Sunday.",
     "subheadline": "Two setups a week means your thousandth rep lands sometime in 2036, assuming you never miss one. Replay any session at your own speed instead — the 3am London open runs perfectly well at 9pm on a Tuesday.",
     "cta_text": "Replay Your First Session Free",
     "mechanism": "time compression — the headline promise stated concretely"
   }'::jsonb
),
(
  '2', 'weekend_reps', 'Repetitions — compress six-year education', FALSE, 25,
  '{
     "eyebrow": "SKILL, NOT SCHEDULE",
     "headline": "Two setups a week is a six-year education. Compress it.",
     "subheadline": "Competence comes from repetitions, not from elapsed years. Replay real historical markets and take a hundred considered trades in an evening — each one logged, reviewable, and yours to learn from.",
     "cta_text": "Get Your Reps In Free",
     "mechanism": "repetitions maths — makes the slow path feel concretely expensive"
   }'::jsonb
),
(
  '2', 'weekend_career', 'Screen time — master without salary risk', FALSE, 25,
  '{
     "eyebrow": "BUILT FOR BUSY PROFESSIONALS",
     "headline": "Build the screen time your day job keeps stealing from you.",
     "subheadline": "Step through real historical sessions at your own pace without risking your salary. Master the market on evenings and weekends — before a single dollar of your own money is exposed.",
     "cta_text": "Start Trading Tonight — Free",
     "mechanism": "risk to existing income — learning without exposing the salary"
   }'::jsonb
),

-- Experiment 3 — Systematizer / TradingView Skeptic
(
  '3', 'control', 'Control — generic baseline', TRUE, 25,
  '{
     "eyebrow": "THE PROFESSIONAL BACKTESTER",
     "headline": "Your strategy shouldn''t be tested with real money",
     "subheadline": "FX Replay is arguably the most effective way to backtest your strategies.",
     "cta_text": "Get started for free",
     "mechanism": "generic baseline"
   }'::jsonb
),
(
  '3', 'tv_bias', 'Invalidation — seen the next candle', FALSE, 25,
  '{
     "eyebrow": "NO LOOKAHEAD. NO SKIPPED TICKS.",
     "headline": "Your replay engine has already seen the next candle.",
     "subheadline": "Bar-replay tools skip the intrabar ticks, so every trade where price touched both your stop and your target gets scored by a coin flip. FX Replay runs tick-by-tick, which means your R:R expectancy reflects what actually happened — not which level the engine decided to pick.",
     "cta_text": "Check the Ticks Yourself — Free",
     "mechanism": "invalidation — accuses the engine of already seeing future ticks"
   }'::jsonb
),
(
  '3', 'tv_precision', 'Measurement — ambiguous wick fills (benchmark)', FALSE, 25,
  '{
     "eyebrow": "SUB-SECOND TICK ACCURACY",
     "headline": "Stop guessing whether your stop or your target hit first.",
     "subheadline": "An hourly candle hides the order of events inside it. FX Replay replays sub-second ticks with realistic spread and slippage, so your results reflect fills you would genuinely have received.",
     "cta_text": "Test Tick Precision Free",
     "mechanism": "measurement precision — the ambiguous-wick problem they already know"
   }'::jsonb
),
(
  '3', 'tv_journal', 'Integrity — no future candle leak', FALSE, 25,
  '{
     "eyebrow": "ZERO LOOKAHEAD BIAS",
     "headline": "A backtest that saw the candle first isn''t a backtest.",
     "subheadline": "Switch from the 4H to the 1m mid-session without a single future candle appearing. Synchronised multi-timeframe stepping guarantees mathematical integrity TradingView lacks.",
     "cta_text": "Rerun Your Last Backtest Free",
     "mechanism": "invalidation / mathematical integrity against lookahead bias"
   }'::jsonb
)
ON CONFLICT (experiment_id, variant_key) DO UPDATE SET
  variant_name = EXCLUDED.variant_name,
  is_control   = EXCLUDED.is_control,
  weight       = EXCLUDED.weight,
  copy_payload = EXCLUDED.copy_payload;

-- ─── Retire arms that no longer have copy ────────────────────────────────────
-- An arm whose `variant_key` has no COPY_DICTIONARY entry renders control copy while
-- still being recorded as a variant — the arm looks like it is running and its results
-- are meaningless. Deactivating rather than deleting keeps the historical attribution on
-- any users already assigned to it, and the row stays visible in /marketingengine.
--
-- Scoped to the three seeded experiments, so arms created by hand in the admin console
-- are never touched.
UPDATE experiment_variants
   SET active = FALSE, weight = 0
 WHERE experiment_id IN ('1', '2', '3')
   AND variant_key NOT IN (
     'control',
     'prop_fees', 'prop_rules', 'prop_funded',
     'weekend_year', 'weekend_reps', 'weekend_career',
     'tv_bias', 'tv_precision', 'tv_journal'
   );
