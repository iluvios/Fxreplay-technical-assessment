import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const match = readFileSync('.env', 'utf8').match(/^DATABASE_URL=(.+)$/m);
const sql = neon(match[1].trim().replace(/^["']|["']$/g, ''));

const updates = [
  {
    variant_key: 'prop_fees',
    variant_name: 'Sunk cost — fees already burned',
    copy_payload: {
      eyebrow: '$0 TO FAIL HERE',
      headline: 'Every failed evaluation costs $300. This one costs nothing.',
      subheadline:
        'Most evaluations don’t die on strategy — they die on trailing drawdown, an unrealised equity spike at the NY open that never showed up on your daily chart. Run your exact rules bar-by-bar against real sessions until you know where your equity curve breaks, before $500 is on the line.',
      cta_text: 'Test Your Prop Rules Free',
      cta_subtext: 'Free forever plan. No credit card. Cheaper than one reset.',
      mechanism: 'sunk cost — names money already lost, not money to be made',
    },
  },
  {
    variant_key: 'prop_rules',
    variant_name: 'Diagnosis — trailing drawdown on unrealised equity',
    copy_payload: {
      eyebrow: 'DRAWDOWN RULES ENGINE',
      headline: 'Your strategy didn’t fail the challenge. Your trailing drawdown did.',
      subheadline:
        'Simulate strict trailing drawdown calculated tick-by-tick on unrealised equity. See where your risk breaks before paying another $300 reset fee.',
      cta_text: 'Test Your Risk Rules Free',
      cta_subtext: 'Free forever plan. No credit card. Cheaper than one reset.',
      mechanism: 'diagnosis — reframes failure as a fixable trailing drawdown risk-rule problem',
    },
  },
  {
    variant_key: 'prop_funded',
    variant_name: 'Earned confidence — $0 resets',
    copy_payload: {
      eyebrow: '$0 TO FAIL HERE',
      headline: 'Blow the account here first. Resets are free.',
      subheadline:
        'Run hundreds of simulated challenge days bar-by-bar under live rules. Discover where your drawdown threshold breaks while finding out costs nothing.',
      cta_text: 'Test Your Prop Rules Free',
      cta_subtext: 'Free forever plan. No credit card. Cheaper than one reset.',
      mechanism: 'earned confidence — preparation and evidence over fear',
    },
  },
  {
    variant_key: 'weekend_year',
    variant_name: 'Time compression — London opens compressed into Sunday',
    copy_payload: {
      eyebrow: 'THE LONDON OPEN, AT 9PM YOUR TIME',
      headline: 'A year of London opens, compressed into one Sunday.',
      subheadline:
        'Two setups a week means your thousandth rep lands sometime in 2036, assuming you never miss one. Replay any session at your own speed instead — the 3am London open runs perfectly well at 9pm on a Tuesday.',
      cta_text: 'Replay Your First Session Free',
      cta_subtext: 'Free forever plan. No credit card required. First replay starts in under a minute.',
      mechanism: 'time compression — the headline promise stated concretely',
    },
  },
  {
    variant_key: 'weekend_reps',
    variant_name: 'Repetitions — compress six-year education',
    copy_payload: {
      eyebrow: 'SKILL, NOT SCHEDULE',
      headline: 'Two setups a week is a six-year education. Compress it.',
      subheadline:
        'Competence comes from repetitions, not from elapsed years. Replay real historical markets and take a hundred considered trades in an evening — each one logged, reviewable, and yours to learn from.',
      cta_text: 'Get Your Reps In Free',
      cta_subtext: 'Free forever plan. No credit card required. First replay starts in under a minute.',
      mechanism: 'repetitions maths — makes the slow path feel concretely expensive',
    },
  },
  {
    variant_key: 'weekend_career',
    variant_name: 'Screen time — master without salary risk',
    copy_payload: {
      eyebrow: 'BUILT FOR BUSY PROFESSIONALS',
      headline: 'Build the screen time your day job keeps stealing from you.',
      subheadline:
        'Step through real historical sessions at your own pace without risking your salary. Master the market on evenings and weekends — before a single dollar of your own money is exposed.',
      cta_text: 'Start Trading Tonight — Free',
      cta_subtext: 'Free forever plan. No credit card required. First replay starts in under a minute.',
      mechanism: 'risk to existing income — learning without exposing the salary',
    },
  },
  {
    variant_key: 'tv_bias',
    variant_name: 'Invalidation — seen the next candle',
    copy_payload: {
      eyebrow: 'NO LOOKAHEAD. NO SKIPPED TICKS.',
      headline: 'Your replay engine has already seen the next candle.',
      subheadline:
        'Bar-replay tools skip the intrabar ticks, so every trade where price touched both your stop and your target gets scored by a coin flip. FX Replay runs tick-by-tick, which means your R:R expectancy reflects what actually happened — not which level the engine decided to pick.',
      cta_text: 'Check the Ticks Yourself — Free',
      cta_subtext: 'Free forever plan. No credit card. Replay any session and audit the fills yourself.',
      mechanism: 'invalidation — accuses the engine of already seeing future ticks',
    },
  },
  {
    variant_key: 'tv_precision',
    variant_name: 'Measurement — ambiguous wick fills (benchmark)',
    copy_payload: {
      eyebrow: 'SUB-SECOND TICK ACCURACY',
      headline: 'Stop guessing whether your stop or your target hit first.',
      subheadline:
        'An hourly candle hides the order of events inside it. FX Replay replays sub-second ticks with realistic spread and slippage, so your results reflect fills you would genuinely have received.',
      cta_text: 'Test Tick Precision Free',
      cta_subtext: 'Free forever plan. No credit card. Replay any session and audit the fills yourself.',
      mechanism: 'measurement precision — the ambiguous-wick problem they already know',
    },
  },
  {
    variant_key: 'tv_journal',
    variant_name: 'Integrity — no future candle leak',
    copy_payload: {
      eyebrow: 'ZERO LOOKAHEAD BIAS',
      headline: 'A backtest that saw the candle first isn’t a backtest.',
      subheadline:
        'Switch from the 4H to the 1m mid-session without a single future candle appearing. Synchronised multi-timeframe stepping guarantees mathematical integrity TradingView lacks.',
      cta_text: 'Rerun Your Last Backtest Free',
      cta_subtext: 'Free forever plan. No credit card. Replay any session and audit the fills yourself.',
      mechanism: 'invalidation / mathematical integrity against lookahead bias',
    },
  },
];

async function run() {
  for (const u of updates) {
    const res = await sql`
      UPDATE experiment_variants
      SET variant_name = ${u.variant_name},
          copy_payload = ${JSON.stringify(u.copy_payload)}::jsonb
      WHERE variant_key = ${u.variant_key}
      RETURNING id, variant_key, variant_name;
    `;
    console.log(`Updated ${u.variant_key}:`, res);
  }
}

run().catch(console.error);
