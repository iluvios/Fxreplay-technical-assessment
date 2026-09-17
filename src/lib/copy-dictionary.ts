// Master Copy Dictionary — Single Source of Truth for landing page experiments.
//
// Copy precedence (do not invent copy here):
//   1. docs/EXPERIMENT_VARIANTS_COPY.md  -> canonical schema + hero / feature_tab / pillars / reviews
//   2. docs/FRONTEND_BUILD_SPEC.md       -> eyebrow + signup ("modal") copy, the fields (1) does not define
//
// Resolved server-side in freetrial.astro / index.astro via Astro.url.searchParams.get('lp')
// so copy is serialized into the HTML before delivery (CLS = 0.00, no client-side text swap).

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

export const COPY_DICTIONARY: Record<string, ExperimentVariantCopy> = {
  // ─────────────────────────────────────────────────────────────────────────
  // CONTROL — Baseline fxreplay.com. Organic / direct / general trading queries.
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT 1 (lp=1) — Prop Firm Challenge Hunter. Emotion: Loss Aversion.
  // ─────────────────────────────────────────────────────────────────────────
  '1': {
    variant_id: 'prop_firm_hunter',
    lp_param: '1',
    eyebrow: 'PROP FIRM CHALLENGE ACCELERATOR',
    hero: {
      headline: 'Stop burning $300 challenge fees. Prove your edge first.',
      subheadline:
        'Simulate FTMO and Apex drawdown rules bar-by-bar. Stress-test your risk before you buy a real evaluation.',
      cta_text: 'Test Your Prop Strategy Free',
      cta_subtext: 'No credit card required. Practice prop rules 100% free.',
      hero_image_type: 'prop_firm_overlay',
    },
    feature_tab: {
      title: 'Train under real evaluation rules',
      description:
        'Master your Prop Firm challenge before it counts. Practice with real trailing drawdown rules, pass with confidence, and earn funded status.',
      cta_text: 'Start prop simulation',
    },
    pillars: [
      {
        title: 'Live Drawdown Guard',
        description:
          'Real-time calculation of max daily loss (5%) and overall drawdown limits on unrealized equity.',
      },
      {
        title: 'Challenge Reset Protection',
        description:
          'Save thousands in evaluation resets by proving statistical expectancy before risking challenge capital.',
      },
      {
        title: 'Audited Track Record',
        description:
          'Export verified equity curves and R:R ratios to prove consistency to funding sponsors.',
      },
      {
        title: 'News Event Simulation',
        description:
          'Backtest how high-impact CPI and NFP volatility spikes affect your strategy under prop slippage rules.',
      },
    ],
    reviews: [
      {
        name: 'Marcus K.',
        role: 'Funded Trader',
        credential: '$200k FTMO',
        quote:
          'I blew three $100k evaluations in a row because of the 5% daily drawdown rule. I spent 2 weeks in FX Replay practicing my lot sizing under their exact rules, and passed Phase 1 and 2 on my very next try.',
        verified: true,
      },
      {
        name: 'Sarah T.',
        role: 'Funded Futures Trader',
        credential: 'Apex',
        quote:
          'FX Replay is the only tool that calculates trailing drawdown the exact same way prop firms do. It saved me at least $1,200 in reset fees this year alone.',
        verified: true,
      },
      {
        name: 'Devon R.',
        role: 'Funded Trader',
        credential: 'Trustpilot Verified',
        quote:
          'Don’t buy a prop challenge until you can pass 3 consecutive simulated months on FX Replay. It turned trading from gambling into a predictable business.',
        verified: true,
      },
    ],
    modal: {
      title: 'Pass your next evaluation on the first try',
      subtitle: 'Start practicing under strict FTMO & Apex rules today—no credit card required.',
      cta_text: 'Launch Free Prop Challenge Simulator →',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT 2 (lp=2) — 9-to-5 Weekend Warrior. Emotion: Time Compression.
  // ─────────────────────────────────────────────────────────────────────────
  '2': {
    variant_id: 'weekend_warrior',
    lp_param: '2',
    eyebrow: 'TIME COMPRESSION REPLAY ENGINE',
    hero: {
      headline: 'Master 1 year of price action in a single weekend',
      subheadline:
        'Can’t trade live sessions during your 9-to-5? Replay 52 Monday-morning market opens this Sunday with zero lookahead bias.',
      cta_text: 'Start Weekend Replay Free',
      cta_subtext: 'No credit card required. Trade historical markets 24/7.',
      hero_image_type: 'time_compression',
    },
    feature_tab: {
      title: 'Compress 3 years of screen time into 30 days',
      description:
        'Skip the slow consolidation and execute high-probability trade setups at your own pace whenever your schedule allows.',
      cta_text: 'Start weekend session',
    },
    pillars: [
      {
        title: '24/7 Market Access',
        description:
          'Forex, Futures, and Indices never close on FX Replay. Practice on Saturday morning or Sunday evening.',
      },
      {
        title: 'Go-To Session Jumps',
        description:
          'Jump directly to London (03:00 EST) or New York (08:30 EST) market open in one click—no waiting around.',
      },
      {
        title: 'Automated Trade Logging',
        description:
          'Every trade you take is auto-logged with entry price, exit price, R:R, and P&L—zero manual spreadsheet entry.',
      },
      {
        title: 'Time-Based Edge Analytics',
        description:
          'Discover which specific hours of the day your strategy performs best so you only trade when it counts.',
      },
    ],
    reviews: [
      {
        name: 'David L.',
        role: 'Software Engineer & Swing Trader',
        credential: 'Trustpilot Verified',
        quote:
          'Between standups and sprint planning, I can’t look at live charts during New York open. FX Replay lets me trade 5 months of price action every Sunday afternoon. My learning curve jumped 10x.',
        verified: true,
      },
      {
        name: 'Elena M.',
        role: 'Management Consultant',
        credential: 'Trustpilot Verified',
        quote:
          'I work 50-hour weeks. Real market hours don’t fit my life. FX Replay gave me the reps I needed to become consistently profitable without quitting my career.',
        verified: true,
      },
      {
        name: 'Tom B.',
        role: 'Finance Manager',
        credential: 'Trustpilot Verified',
        quote:
          'Logging trades manually in Notion used to take hours. FX Replay logs the candle screenshot, the R:R, and the exact entry automatically while I test on weekends.',
        verified: true,
      },
    ],
    modal: {
      title: 'Practice trading on your own schedule',
      subtitle: 'Trade historical Forex and Indices this weekend—no credit card required.',
      cta_text: 'Start Weekend Replay Session →',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANT 3 (lp=3) — Systematizer / TradingView Skeptic. Emotion: Data Precision.
  // ─────────────────────────────────────────────────────────────────────────
  '3': {
    variant_id: 'tv_skeptic',
    lp_param: '3',
    eyebrow: 'PURPOSE-BUILT TRADING SIMULATOR',
    hero: {
      headline: 'TradingView was built for charts. FX Replay was built for edge.',
      subheadline:
        'True multi-timeframe stepping. No candle flash leaks. Sub-second tick data so you know whether Stop Loss or Take Profit hit first.',
      cta_text: 'Experience Pure Replay Free',
      cta_subtext: 'No credit card required. Zero lookahead bias guaranteed.',
      hero_image_type: 'multi_timeframe',
    },
    feature_tab: {
      title: 'Zero lookahead leaks. Sub-second tick accuracy.',
      description:
        'Switch from the Daily to the 1-minute chart without flashing future price action. Backtest with the mathematical integrity TradingView lacks.',
      cta_text: 'Test tick precision',
    },
    pillars: [
      {
        title: 'Zero Lookahead Guarantee',
        description:
          'Timeframe transitions are locked; future candles never flash or leak onto the canvas.',
      },
      {
        title: 'Synchronized Multi-Chart Replay',
        description:
          'Advance the 1-minute execution chart and watch the 1-hour and 4-hour candles develop simultaneously.',
      },
      {
        title: 'Sub-Second Tick Resolution',
        description:
          'Eliminates ambiguous candle wicks by simulating realistic order queue execution.',
      },
      {
        title: 'Realistic Execution Modeling',
        description:
          'Replay with realistic broker spreads, slippage, and limit order fill rules.',
      },
    ],
    reviews: [
      {
        name: 'Julian W.',
        role: 'Systematic Price Action Trader',
        credential: 'Trustpilot Verified',
        quote:
          'TradingView’s replay has a subtle flaw: when you switch timeframes, it flashes the next candle, corrupting your subconscious bias. FX Replay is the only web tool that guarantees 100% pure backtesting integrity.',
        verified: true,
      },
      {
        name: 'Patrick S.',
        role: 'Algorithmic & Discretionary Trader',
        credential: 'Trustpilot Verified',
        quote:
          'On TradingView, a 1-hour candle with wicks in both directions leaves you guessing whether your Stop Loss or Take Profit hit first. FX Replay’s seconds data gives you the exact tick order.',
        verified: true,
      },
      {
        name: 'Kenji M.',
        role: 'SMC Trader',
        credential: 'Trustpilot Verified',
        quote:
          'TradingView charts, but with the engine of a professional institutional simulator. The multi-timeframe synchronization alone makes it indispensable.',
        verified: true,
      },
    ],
    modal: {
      title: 'Experience true backtesting without lookahead bias',
      subtitle: 'Launch a high-fidelity replay session with sub-second tick data—no credit card required.',
      cta_text: 'Launch Precision Simulator Free →',
    },
  },
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
 * Resolve the ?lp= search param to a variant. Unknown or missing values fall
 * back to control, so malformed ad URLs always render a valid baseline page.
 */
export function getCopyForVariant(lp: string | null | undefined): ExperimentVariantCopy {
  if (lp && Object.prototype.hasOwnProperty.call(COPY_DICTIONARY, lp)) {
    return COPY_DICTIONARY[lp];
  }
  return COPY_DICTIONARY.control;
}

/** The `lp` value to propagate into CTA links (`/signup?lp=X`). */
export function getLpParam(lp: string | null | undefined): string {
  return getCopyForVariant(lp).lp_param;
}
