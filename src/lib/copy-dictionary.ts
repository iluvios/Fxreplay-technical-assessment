// Master Copy Dictionary — single source of truth for landing page experiments.
//
// Structure: one experiment per ICP, each with a shared control and three treatment arms.
//
//   lp=1  Prop Firm Challenge Hunter   prop_fees · prop_rules · prop_funded
//   lp=2  9-to-5 Weekend Warrior       weekend_year · weekend_reps · weekend_career
//   lp=3  Systematizer / TV Skeptic    tv_bias · tv_precision · tv_journal
//
// WHY THE ARMS SHARE A BASE
// Within one experiment, the arms differ ONLY in eyebrow, hero and signup copy. The
// feature tab, the four pillars and the testimonials are held constant per ICP.
//
// This is the single-template rule applied to the copy itself. If the headline, the
// pillars and the social proof all change between arms, a win tells you the bundle beat
// the other bundle — not which message did the work. Holding everything but the tested
// message constant is what makes the result mean something.
//
// Each arm tests ONE psychological mechanism. Stacking two into a single arm makes the
// result unattributable in exactly the same way.
//
// Resolved server-side in freetrial.astro / index.astro via the ?lp= param, so copy is
// serialised into the HTML before delivery (CLS = 0.00, no client-side text swap).

export interface HeroVariables {
  headline: string;
  subheadline: string;
  cta_text: string;
  cta_subtext: string;
  hero_image_type: 'standard_chart' | 'prop_firm_overlay' | 'time_compression' | 'multi_timeframe';
}

export interface ClientReview {
  name: string;
  role: string;
  credential: string;
  quote: string;
  verified: boolean;
}

export interface ExperimentVariantCopy {
  variant_id: string;
  lp_param: string;
  eyebrow: string;
  hero: HeroVariables;
  feature_tab: {
    title: string;
    description: string;
    cta_text: string;
  };
  pillars: Array<{
    title: string;
    description: string;
  }>;
  reviews: ClientReview[];
  /** Signup copy. Named `modal` to match the documented schema; rendered on the
   *  dedicated /signup?lp=X page — there is no popup modal (CLAUDE.md §2.1). */
  modal: {
    title: string;
    subtitle: string;
    cta_text: string;
  };
}

/** Everything held constant across the arms of one ICP's experiment. */
interface IcpBase {
  lp_param: string;
  hero_image_type: HeroVariables['hero_image_type'];
  feature_tab: ExperimentVariantCopy['feature_tab'];
  pillars: ExperimentVariantCopy['pillars'];
  reviews: ClientReview[];
}

/** The part that actually varies between arms — the message under test. */
interface ArmCopy {
  variant_id: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  cta_text: string;
  cta_subtext: string;
  modal: ExperimentVariantCopy['modal'];
}

function arm(base: IcpBase, copy: ArmCopy): ExperimentVariantCopy {
  return {
    variant_id: copy.variant_id,
    lp_param: base.lp_param,
    eyebrow: copy.eyebrow,
    hero: {
      headline: copy.headline,
      subheadline: copy.subheadline,
      cta_text: copy.cta_text,
      cta_subtext: copy.cta_subtext,
      hero_image_type: base.hero_image_type,
    },
    feature_tab: base.feature_tab,
    pillars: base.pillars,
    reviews: base.reviews,
    modal: copy.modal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ICP 1 — Prop Firm Challenge Hunter. Emotion: loss aversion.
// Pain: $150–$600 per failed evaluation, 95% failure rate, trailing drawdown on
// unrealised intraday equity. Sees a subscription as insurance against one failed fee.
// ─────────────────────────────────────────────────────────────────────────────
const PROP_BASE: IcpBase = {
  lp_param: '1',
  hero_image_type: 'prop_firm_overlay',
  feature_tab: {
    title: 'Practise under the rules that actually fail people',
    description:
      'Daily loss limits, trailing drawdown and profit targets tracked live while you trade, calculated the way evaluation firms calculate them. Learn where your risk breaks while it costs nothing.',
    cta_text: 'Try the rules engine free',
  },
  pillars: [
    {
      title: 'Live drawdown tracking',
      description:
        'Max daily loss and overall drawdown calculated on unrealised equity, updating on every tick — the same way an evaluation measures you.',
    },
    {
      title: 'Practise before you pay',
      description:
        'Run your strategy through hundreds of simulated challenge days on real historical data before spending anything on a real evaluation.',
    },
    {
      title: 'A record you can show',
      description:
        'Every session exports as a full trade log with equity curve, R:R and max drawdown — evidence of consistency, not a screenshot.',
    },
    {
      title: 'High-impact news days',
      description:
        'Replay CPI and NFP sessions with realistic spread widening, so volatility is something you have practised rather than something that surprises you.',
    },
  ],
  reviews: [
    {
      name: 'Marcus K.',
      role: 'Funded Trader',
      credential: '$200k account',
      quote:
        'I failed three evaluations in a row on the daily drawdown rule, not on my strategy. Two weeks practising position sizing under the same rules in FX Replay and I passed both phases on the next attempt.',
      verified: true,
    },
    {
      name: 'Sarah T.',
      role: 'Funded Futures Trader',
      credential: 'Trustpilot Verified',
      quote:
        'It calculates trailing drawdown the same way the firms do. That one detail is what I was getting wrong, and I had no way to see it until I could watch it move in real time.',
      verified: true,
    },
    {
      name: 'Devon R.',
      role: 'Trader',
      credential: 'Trustpilot Verified',
      quote:
        'My rule now is simple: three consecutive profitable simulated months before I buy another challenge. It turned evaluations from a gamble into something I prepare for.',
      verified: true,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ICP 2 — 9-to-5 Weekend Warrior. Emotion: time compression.
// Pain: cannot watch London/NY opens, markets closed at the weekend, 4–6 years to
// accumulate the repetitions that competence requires. Values time over money.
// ─────────────────────────────────────────────────────────────────────────────
const WEEKEND_BASE: IcpBase = {
  lp_param: '2',
  hero_image_type: 'time_compression',
  feature_tab: {
    title: 'The market opens when you do',
    description:
      'Jump straight to any London or New York session from the last decade and trade it bar by bar. Saturday morning, Sunday evening, 6am before work — the historical market is always there.',
    cta_text: 'Start a free session',
  },
  pillars: [
    {
      title: 'Always open',
      description:
        'Forex, futures and indices are replayable at any hour. Practise on a Sunday afternoon while live markets are closed.',
    },
    {
      title: 'Jump to any session',
      description:
        'Skip the dead hours. Go directly to the London or New York open and trade only the conditions you care about.',
    },
    {
      title: 'Journalled automatically',
      description:
        'Entry, exit, R:R and P&L captured on every trade. No spreadsheet to maintain, so your limited time goes on trading instead of admin.',
    },
    {
      title: 'Find your hours',
      description:
        'See which sessions and times your strategy actually performs in, so the few hours you can trade live are the right ones.',
    },
  ],
  reviews: [
    {
      name: 'David L.',
      role: 'Software Engineer',
      credential: 'Trustpilot Verified',
      quote:
        'I cannot look at live charts during the New York open — I am in standups. I trade five months of price action every Sunday afternoon instead. My progress went from crawling to obvious.',
      verified: true,
    },
    {
      name: 'Elena M.',
      role: 'Management Consultant',
      credential: 'Trustpilot Verified',
      quote:
        'I work fifty-hour weeks. Real market hours simply do not fit my life. This gave me the repetitions I needed without having to gamble my career on going full time.',
      verified: true,
    },
    {
      name: 'Tom B.',
      role: 'Finance Manager',
      credential: 'Trustpilot Verified',
      quote:
        'Logging trades by hand used to eat the little time I had. Now the screenshot, the R:R and the entry are captured automatically while I keep testing.',
      verified: true,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ICP 3 — Systematizer / TradingView Skeptic. Emotion: data precision.
// Pain: lookahead bias on timeframe switches, unsynchronised multi-chart stepping,
// ambiguous wick fills. Despises hype; responds only to verifiable technical claims.
// ─────────────────────────────────────────────────────────────────────────────
const PRECISION_BASE: IcpBase = {
  lp_param: '3',
  hero_image_type: 'multi_timeframe',
  feature_tab: {
    title: 'Built for testing, not for drawing',
    description:
      'Synchronised multi-timeframe stepping, no future candles on a timeframe switch, and sub-second tick data so fills reflect what would actually have happened. Verify every claim on your own setups.',
    cta_text: 'Check it against your data',
  },
  pillars: [
    {
      title: 'No future candles',
      description:
        'Move between the 4H and the 1m mid-replay without revealing what happens next. The test stays honest when you change perspective.',
    },
    {
      title: 'Charts step together',
      description:
        'Advance the execution chart and every higher timeframe develops with it, so structure and entry are read from the same moment in time.',
    },
    {
      title: 'Sub-second fills',
      description:
        'Tick-level replay resolves whether your stop or your target was reached first, instead of leaving it to an assumption inside an hourly bar.',
    },
    {
      title: 'Realistic execution',
      description:
        'Spread, slippage and limit-fill behaviour modelled during replay, so measured expectancy is closer to live results.',
    },
  ],
  reviews: [
    {
      name: 'Julian W.',
      role: 'Systematic Price Action Trader',
      credential: 'Trustpilot Verified',
      quote:
        'The moment a replay tool shows you the next candle when you switch timeframes, every result after that is contaminated. This is the first browser tool I have trusted for a serious backtest.',
      verified: true,
    },
    {
      name: 'Patrick S.',
      role: 'Algorithmic & Discretionary Trader',
      credential: 'Trustpilot Verified',
      quote:
        'An hourly candle with wicks both sides leaves you guessing whether your stop or target hit first. Seconds data gives the actual order of events, which changes the numbers more than people expect.',
      verified: true,
    },
    {
      name: 'Kenji M.',
      role: 'Futures Trader',
      credential: 'Trustpilot Verified',
      quote:
        'I still chart elsewhere. I test here. The synchronised multi-timeframe stepping alone is worth keeping both.',
      verified: true,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// The dictionary
// ─────────────────────────────────────────────────────────────────────────────

export const COPY_DICTIONARY: Record<string, ExperimentVariantCopy> = {
  // ── CONTROL ────────────────────────────────────────────────────────────────
  // The current fxreplay.com baseline. Shared control for all three experiments:
  // every test asks the same question — does speaking to this audience specifically
  // beat the generic message they would otherwise have seen?
  control: {
    variant_id: 'control',
    lp_param: 'control',
    eyebrow: 'THE PROFESSIONAL BACKTESTER',
    hero: {
      headline: 'Your strategy shouldn’t be tested with real money',
      subheadline:
        'FX Replay is arguably the most effective way to backtest your strategies. Execute more confidently and accomplish your trading goals.',
      cta_text: 'Get started for free',
      cta_subtext: 'Start for free. No credit card required.',
      hero_image_type: 'standard_chart',
    },
    feature_tab: {
      title: 'Track every move',
      description:
        'The insights and tools that help you increase results, boost trading outcomes, and trade your strategy with clarity before it ever goes live.',
      cta_text: 'Start now',
    },
    pillars: [
      {
        title: 'Live Journal',
        description:
          'Backtest using historical data and see how your setups perform with zero risk and no emotional bias.',
      },
      {
        title: 'Mentor AI',
        description:
          'Get AI-powered feedback on your trading behavior to identify patterns and improve performance.',
      },
      {
        title: 'Prop Firm Simulator',
        description:
          'Simulate prop firm challenges with real rules and conditions to prepare for funded accounts.',
      },
      {
        title: 'P&L Tracker',
        description:
          'Visualize your trading with our PnL Tracker, a dynamic graph that displays your profit and loss trends over time.',
      },
    ],
    reviews: [
      {
        name: 'Mack Grey',
        role: 'Trader',
        credential: 'Trustpilot Verified',
        quote:
          'FX Replay is hands down the best backtesting software in the game. I use it all the time, and I’m honestly a little jealous I didn’t have it earlier in my journey.',
        verified: true,
      },
      {
        name: 'Dylan Mitch',
        role: 'Trader',
        credential: 'Trustpilot Verified',
        quote:
          'FX Replay can help traders at every stage of their journey. Trading always pushes you to improve, and this is the kind of tool that helps you become a better trader.',
        verified: true,
      },
      {
        name: 'Ryan Condi',
        role: 'Trader',
        credential: 'Trustpilot Verified',
        quote:
          'Anyone can watch a YouTube video or take a course, but FX Replay lets you put what you’ve learned onto a real chart and see what actually works for you.',
        verified: true,
      },
    ],
    modal: {
      title: 'Start your free FX Replay trial',
      subtitle: 'Join over 70,000+ traders testing their edge risk-free.',
      cta_text: 'Create Free Account & Start Replay →',
    },
  },

  // ── EXPERIMENT 1 (lp=1) — Prop Firm Challenge Hunter ───────────────────────

  /** Mechanism: sunk cost. Names money the reader has already lost, not money to be made. */
  prop_fees: arm(PROP_BASE, {
    variant_id: 'prop_fees',
    eyebrow: '$0 TO FAIL HERE',
    headline: 'Every failed evaluation costs $300. This one costs nothing.',
    subheadline:
      'Most evaluations don’t die on strategy — they die on trailing drawdown, an unrealised equity spike at the NY open that never showed up on your daily chart. Run your exact rules bar-by-bar against real sessions until you know where your equity curve breaks, before $500 is on the line.',
    cta_text: 'Test Your Prop Rules Free',
    cta_subtext: 'Free forever plan. No credit card. Cheaper than one reset.',
    modal: {
      title: 'Your next reset costs nothing.',
      subtitle:
        'Set your drawdown limits, pick your instrument, and replay the sessions that keep stopping you out. Setup takes under a minute.',
      cta_text: 'Create free account →',
    },
  }),

  /** Mechanism: diagnosis. Reframes failure as a risk-rule problem, which is fixable. */
  prop_rules: arm(PROP_BASE, {
    variant_id: 'prop_rules',
    eyebrow: 'DRAWDOWN RULES ENGINE',
    headline: 'Your strategy didn’t fail the challenge. Your trailing drawdown did.',
    subheadline:
      'Simulate strict trailing drawdown calculated tick-by-tick on unrealised equity. See where your risk breaks before paying another $300 reset fee.',
    cta_text: 'Test Your Risk Rules Free',
    cta_subtext: 'Free forever plan. No credit card. Cheaper than one reset.',
    modal: {
      title: 'Find the rule that keeps ending your run',
      subtitle:
        'Free to start. Watch daily loss and trailing drawdown move in real time while you trade historical markets.',
      cta_text: 'Create free account →',
    },
  }),

  /** Mechanism: earned confidence. Preparation and evidence rather than fear of loss. */
  prop_funded: arm(PROP_BASE, {
    variant_id: 'prop_funded',
    eyebrow: '$0 TO FAIL HERE',
    headline: 'Blow the account here first. Resets are free.',
    subheadline:
      'Run hundreds of simulated challenge days bar-by-bar under live rules. Discover where your drawdown threshold breaks while finding out costs nothing.',
    cta_text: 'Test Your Prop Rules Free',
    cta_subtext: 'Free forever plan. No credit card. Cheaper than one reset.',
    modal: {
      title: 'Build the track record first',
      subtitle:
        'Free to start. Every simulated session logged with equity curve, R:R and max drawdown.',
      cta_text: 'Create free account →',
    },
  }),

  // ── EXPERIMENT 2 (lp=2) — 9-to-5 Weekend Warrior ───────────────────────────

  /** Mechanism: time compression. The headline promise, stated concretely. */
  weekend_year: arm(WEEKEND_BASE, {
    variant_id: 'weekend_year',
    eyebrow: 'THE LONDON OPEN, AT 9PM YOUR TIME',
    headline: 'A year of London opens, compressed into one Sunday.',
    subheadline:
      'Two setups a week means your thousandth rep lands sometime in 2036, assuming you never miss one. Replay any session at your own speed instead — the 3am London open runs perfectly well at 9pm on a Tuesday.',
    cta_text: 'Replay Your First Session Free',
    cta_subtext: 'Free forever plan. No credit card required. First replay starts in under a minute.',
    modal: {
      title: 'Your next 200 trades don’t have to take two years.',
      subtitle:
        'Create the account, load a session, and start taking setups tonight. No market hours, no live capital, no waiting for Monday.',
      cta_text: 'Create free account →',
    },
  }),

  /** Mechanism: the repetitions maths. Makes the slow path feel concretely expensive. */
  weekend_reps: arm(WEEKEND_BASE, {
    variant_id: 'weekend_reps',
    eyebrow: 'SKILL, NOT SCHEDULE',
    headline: 'Two setups a week is a six-year education. Compress it.',
    subheadline:
      'Competence comes from repetitions, not from elapsed years. Replay real historical markets and take a hundred considered trades in an evening — each one logged, reviewable, and yours to learn from.',
    cta_text: 'Get Your Reps In Free',
    cta_subtext: 'Free forever plan. No credit card required. First replay starts in under a minute.',
    modal: {
      title: 'Get the repetitions without the years',
      subtitle:
        'Free to start. Trade real historical markets at your own pace, with every execution journalled for review.',
      cta_text: 'Create free account →',
    },
  }),

  /** Mechanism: risk to an existing income. Learning without exposing the salary. */
  weekend_career: arm(WEEKEND_BASE, {
    variant_id: 'weekend_career',
    eyebrow: 'BUILT FOR BUSY PROFESSIONALS',
    headline: 'Build the screen time your day job keeps stealing from you.',
    subheadline:
      'Step through real historical sessions at your own pace without risking your salary. Master the market on evenings and weekends — before a single dollar of your own money is exposed.',
    cta_text: 'Start Trading Tonight — Free',
    cta_subtext: 'Free forever plan. No credit card required. First replay starts in under a minute.',
    modal: {
      title: 'Learn first. Risk later.',
      subtitle:
        'Free to start. Real historical markets and simulated capital, so the learning curve costs you time instead of savings.',
      cta_text: 'Create free account →',
    },
  }),

  // ── EXPERIMENT 3 (lp=3) — Systematizer / TradingView Skeptic ───────────────

  /** Mechanism: the engine already saw the candle. Fills scored by coin flip. */
  tv_bias: arm(PRECISION_BASE, {
    variant_id: 'tv_bias',
    eyebrow: 'NO LOOKAHEAD. NO SKIPPED TICKS.',
    headline: 'Your replay engine has already seen the next candle.',
    subheadline:
      'Bar-replay tools skip the intrabar ticks, so every trade where price touched both your stop and your target gets scored by a coin flip. FX Replay runs tick-by-tick, which means your R:R expectancy reflects what actually happened — not which level the engine decided to pick.',
    cta_text: 'Check the Ticks Yourself — Free',
    cta_subtext: 'Free forever plan. No credit card. Replay any session and audit the fills yourself.',
    modal: {
      title: 'Don’t take our word for the fill.',
      subtitle:
        'Make the account, load a session you’ve already backtested, and count how many fills change. One trade is usually enough to tell.',
      cta_text: 'Create free account →',
    },
  }),

  /** Mechanism: measurement precision. The ambiguous-wick problem they already know. (Control benchmark) */
  tv_precision: arm(PRECISION_BASE, {
    variant_id: 'tv_precision',
    eyebrow: 'SUB-SECOND TICK ACCURACY',
    headline: 'Stop guessing whether your stop or your target hit first.',
    subheadline:
      'An hourly candle hides the order of events inside it. FX Replay replays sub-second ticks with realistic spread and slippage, so your results reflect fills you would genuinely have received.',
    cta_text: 'Test Tick Precision Free',
    cta_subtext: 'Free forever plan. No credit card. Replay any session and audit the fills yourself.',
    modal: {
      title: 'Resolve the fills properly',
      subtitle:
        'Free to start. Tick-level replay with realistic spread and slippage on real historical data.',
      cta_text: 'Create free account →',
    },
  }),

  /** Mechanism: invalidation / mathematical integrity against lookahead bias. */
  tv_journal: arm(PRECISION_BASE, {
    variant_id: 'tv_journal',
    eyebrow: 'ZERO LOOKAHEAD BIAS',
    headline: 'A backtest that saw the candle first isn’t a backtest.',
    subheadline:
      'Switch from the 4H to the 1m mid-session without a single future candle appearing. Synchronised multi-timeframe stepping guarantees mathematical integrity TradingView lacks.',
    cta_text: 'Rerun Your Last Backtest Free',
    cta_subtext: 'Free forever plan. No credit card. Replay any session and audit the fills yourself.',
    modal: {
      title: 'Test it without the leak',
      subtitle:
        'Switch timeframes mid-replay without revealing future candles. Verify it on your own setups.',
      cta_text: 'Create free account →',
    },
  }),
};

/** Variant-specific product mockup (docs/IMAGE_ASSETS_CATALOG.md §3), keyed by hero_image_type. */
export const HERO_VISUAL_BY_TYPE: Record<HeroVariables['hero_image_type'], string> = {
  standard_chart:
    'https://cdn.prod.website-files.com/668852f921e36c3365b91d03/6984d95448fbb5a8d2732e42_replay%20mode-%20desktop.svg',
  prop_firm_overlay:
    'https://cdn.prod.website-files.com/668852f921e36c3365b91d03/6984d94bfd5c98e00ccfcddb_prop%20firm%20-%20desktop.svg',
  time_compression:
    'https://cdn.prod.website-files.com/668852f921e36c3365b91d03/6984d9c27d7b963658a0ca26_seconds%20timeframes%20-%20desktop.svg',
  multi_timeframe:
    'https://cdn.prod.website-files.com/668852f921e36c3365b91d03/6984d95cd36a1cdac3cd7f9a_multipair%20-%20desktop.svg',
};

/**
 * Resolve a COPY_DICTIONARY key to its copy. Unknown or missing keys fall back to
 * control, so a malformed ad URL always renders a valid baseline page.
 */
export function getCopyForVariant(key: string | null | undefined): ExperimentVariantCopy {
  if (key && Object.prototype.hasOwnProperty.call(COPY_DICTIONARY, key)) {
    return COPY_DICTIONARY[key];
  }
  return COPY_DICTIONARY.control;
}

/** The `lp` value to propagate into CTA links (`/signup?lp=X`). */
export function getLpParam(key: string | null | undefined): string {
  return getCopyForVariant(key).lp_param;
}
