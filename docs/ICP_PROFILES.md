# FX Replay: Ideal Customer Profiles (ICPs) & Behavioral Intelligence Master Document
**Document Purpose:** Ground truth repository of target customer personas, behavioral profiles, psychological drivers, core assumptions, and seed experiment hypotheses.  
**Destination:** Feeding the dynamic `/freetrial?lp=X` experiment engine and the `/marketingengine` internal dashboard.

---

## Executive Overview: The Growth Thesis

Growth at FX Replay does not come from generic "feature-dump" landing pages. The retail trading audience is highly segmented by **intent, available capital, screen availability, and emotional pain**. 

A blanket value proposition like *"Master the markets with backtesting"* fails to trigger the intense emotional urgency required to drive instant, frictionless account signups. To maximize conversion velocity, our marketing engine dynamically aligns messaging with three distinct psychological profiles:

1. **The Prop Firm Challenge Hunter (60% Market Share):** High emotional urgency, intense loss aversion regarding evaluation fees, dreams of capital funding.
2. **The 9-to-5 Weekend Warrior (30% Market Share):** Severe time poverty, inability to trade live weekday sessions, craves extreme time compression.
3. **The Systematizer / TradingView Skeptic (10% Market Share):** Sophisticated, burned by TradingView's replay limitations, demands mathematical rigor and zero lookahead bias.

---

## ICP 1: The Prop Firm Challenge Hunter

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Archetype: "The Evaluation Grinder"                                     │
│ Target URL: fxreplay.com/freetrial?lp=1                                 │
│ Traffic Share: ~60% of Acquisition Funnel                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. Persona Summary & Background
The Prop Firm Hunter represents the hyper-growth epicenter of modern retail trading. Driven by the explosive rise of funding firms (FTMO, Apex Trader Funding, Topstep, FundedNext, Alpha Capital), this trader seeks to trade accounts ranging from $25,000 to $200,000 without putting up their own life savings. 

However, they are caught in a vicious cycle: retail prop challenge failure rates exceed **95%**. Most blow accounts within 5 to 10 trading days, primarily due to strict **4%–5% maximum daily trailing drawdown** and overnight equity rules. They repeatedly pay $150 to $600 per challenge attempt, burning thousands of dollars on "evaluations" that they treat as paid gambling.

### 2. Demographics & Context
* **Age:** 20 – 32 years old.
* **Gender:** 90%+ Male.
* **Occupations:** College students, gig workers, early-career professionals, junior analysts, blue-collar workers chasing financial independence.
* **Liquid Capital:** $500 – $2,500. They cannot afford to fund a $50k personal account, which is why prop firms are their only path to scale.
* **Geography:** Global (United States, United Kingdom, Canada, Nigeria, India, South Africa, Germany, Colombia, Brazil).
* **Primary Assets Traded:** High-volatility FX pairs (EURUSD, GBPUSD), Gold (XAUUSD), and Equity Index Futures/CFDs (NAS100, US30, S&P500).

### 3. Habits & Day-to-Day Behaviors
* **Content Consumption:** Consumes 3–5 hours daily of trading YouTube and TikTok (ICT / Inner Circle Trader, Smart Money Concepts, Photon Trading, Umar Ashraf, prop firm payout reviews).
* **Community Engagement:** Active in prop firm Discord servers, Reddit (`r/Forex`, `r/Daytrading`, `r/PropFirmTraders`), and Twitter/X.
* **Trading Tooling:** Charts on TradingView, enters orders on MetaTrader 4/5, cTrader, or DXtrade.
* **The Failure Loop:** They buy a $100K challenge $\to$ over-leverage to hit the 8%–10% profit target fast $\to$ hit the 5% daily drawdown limit on day 4 $\to$ experience rage and despair $\to$ buy a discounted reset code or new evaluation $\to$ repeat.

### 4. Psychological Drivers: Fears, Desires & Frustrations
* **Deepest Fear:** Being exposed as an imposter; burning their limited savings on evaluation fees without ever receiving a payout; having to explain to their spouse/parents why they lost another $300.
* **Ultimate Desire:** The "Payout Certificate" screenshot to post on Discord and Instagram; quitting their regular job to trade 2 hours a day from anywhere; earning $5,000–$15,000 in monthly profit splits.
* **Acute Frustration:** Prop firm rule complexity (trailing drawdown calculating on unrealized intraday equity peaks rather than balance, news trading restrictions).
* **The Rationalization:** *"I have a working strategy, I just have bad psychology under pressure."*

### 5. Core Assumptions
* **High Loss Aversion:** An angle emphasizing **saving $300-$500 in wasted evaluation fees** will convert at least 2x higher than an angle emphasizing "improving win rate."
* **Willingness to Pay:** A $35/month FX Replay subscription is instantly justified if positioned as an "Insurance Policy" against failing a single $300 evaluation.
* **Friction Sensitivity:** They are impatient. Any mandatory credit card collection upfront will trigger a 60%+ bounce rate. A frictionless "Try Free" session must give them immediate access to prop drawdown tracking.

### 6. Acquisition Channels & Target Keywords
* **Paid Search Keywords:** `pass ftmo challenge fast`, `best prop firm simulator`, `how to avoid max daily drawdown`, `ftmo phase 1 strategy`, `prop firm backtesting tool`.
* **Meta & TikTok Ad Angles:** Split-screen video showing a trader failing an FTMO challenge and screaming vs. a trader stress-testing their risk on FX Replay with the prop rules overlay before passing on day 1.
* **Organic SEO & YouTube:** "How to practice FTMO rules for free before buying an evaluation."

### 7. Seed Hypotheses for the Experiment Engine
* **Hypothesis 1.1 (Hero Loss Aversion):** Framing the headline around avoiding wasted challenge fees (*"Stop burning $300 challenge fees. Prove your edge first."*) will lift signup CR by $\ge 25\%$ compared to the generic practice baseline.
* **Hypothesis 1.2 (Feature Hierarchy):** Placing the **"Simulate FTMO, Apex & Topstep Rules"** interactive widget directly below the hero will increase modal conversion rates by $\ge 18\%$.

---

## ICP 2: The 9-to-5 Weekend Warrior

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Archetype: "The Time-Starved Professional"                              │
│ Target URL: fxreplay.com/freetrial?lp=2                                 │
│ Traffic Share: ~30% of Acquisition Funnel                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. Persona Summary & Background
The Weekend Warrior is an educated, hardworking career professional with a high-paying day job. They are drawn to trading not out of desperation, but to achieve long-term wealth compounding, autonomy, and an eventual escape from corporate burnout.

Their existential barrier is **time**. Between corporate meetings, client demands, commuting, and family obligations, they cannot sit in front of charts during the high-liquidity London (3:00 AM – 6:00 AM EST) or New York (8:00 AM – 11:30 AM EST) market opens. By the time they log off work, the markets are dead or entering low-volume Asian chop. When they finally have 5 uninterrupted hours on Saturday or Sunday, **the Forex and Futures markets are completely closed**.

### 2. Demographics & Context
* **Age:** 26 – 45 years old.
* **Gender:** 80% Male, 20% Female.
* **Occupations:** Software engineers, physicians, corporate managers, accountants, sales directors, high-income professionals.
* **Liquid Capital:** $10,000 – $75,000+. They have capital to trade, but lack the time to practice.
* **Geography:** Heavily concentrated in North America, Western Europe, Australia, Singapore.
* **Primary Assets Traded:** S&P 500 (ES/SPY), Nasdaq (NQ/QQQ), EURUSD, Swing Currency Pairs.

### 3. Habits & Day-to-Day Behaviors
* **Weekdays:** Checks phone charts under conference room tables; attempts to swing trade daily timeframes or sets limit orders that get stopped out during erratic news spikes; feels guilty about missing daytime setups.
* **Weekends:** Dedicates Saturday mornings or Sunday afternoons to "studying the markets." Opens TradingView, but gets bored or frustrated because the chart is static and the market is closed.
* **Learning Velocity:** They realize with despair that if they only see 1 or 2 live setups a week, **it will take them 4 to 6 years** to log the 1,000 trade repetitions needed for statistical mastery.

### 4. Psychological Drivers: Fears, Desires & Frustrations
* **Deepest Fear:** Wasting years of their prime career pretending to be a trader without ever getting traction; losing hard-earned salary money in live markets due to amateur execution mistakes.
* **Ultimate Desire:** **Time compression.** Racking up 100 high-quality trade executions in a 2-hour Sunday session; mastering their strategy on their own schedule without sacrificing their day job.
* **Acute Frustration:** Live markets being closed precisely when they have free time to learn.
* **The Rationalization:** *"If I just had uninterrupted screen time, I know I'm smart enough to figure this out."*

### 5. Core Assumptions
* **Time-to-Value Priority:** They do not care about a $35/month fee; they care about **wasted time**. Highlighting speed, efficiency, and automated trade journaling resonates far more than discounts.
* **Desktop & Dual-Monitor Users:** They trade and backtest on high-end laptops or desktop setups during the weekend.
* **Value Metric:** Every hour spent on FX Replay must feel like 20 hours of live market experience.

### 6. Acquisition Channels & Target Keywords
* **Paid Search Keywords:** `how to practice trading on weekends`, `backtesting software weekend forex`, `trade replay when markets are closed`, `forex market simulator for busy people`.
* **Meta & LinkedIn Ad Angles:** Ad creative targeting busy professionals: *"Can't trade the New York open because of work? Trade 52 Monday morning sessions this Sunday in 90 minutes."*
* **Organic SEO:** "The busy professional's guide to mastering price action on the weekend."

### 7. Seed Hypotheses for the Experiment Engine
* **Hypothesis 2.1 (Extreme Time Compression):** A hero message promising *"Master 1 year of price action in a single weekend"* will generate a $\ge 30\%$ lift in CTR from weekend ad traffic compared to general trading copy.
* **Hypothesis 2.2 (Schedule Alignment):** Dynamically adjusting the primary CTA subtext on Fridays, Saturdays, and Sundays to read *"Practice this weekend while markets are closed — 100% free"* will increase weekend account creation rates by $\ge 22\%$.

---

## ICP 3: The Systematizer / TradingView Skeptic

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Archetype: "The Strategy Architect"                                     │
│ Target URL: fxreplay.com/freetrial?lp=3                                 │
│ Traffic Share: ~10% of Acquisition Funnel                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. Persona Summary & Background
The Systematizer is an experienced, highly technical discretionary trader. They have been in the markets for 2+ years, have moved past basic indicator retail trading, and trade systematic price action (ICT order blocks, Wyckoff accumulation, liquidity sweeps, auction market theory, volume profile).

They already pay for a TradingView Pro or Premium account. However, they have hit the technical ceiling of TradingView's native **Bar Replay** tool and are deeply frustrated by its flaws. They know from painful experience that TradingView's replay feature fosters a **false sense of profitability** due to lookahead bias, single-timeframe stepping bugs, and lack of tick-level execution granularity.

### 2. Demographics & Context
* **Age:** 24 – 42 years old.
* **Gender:** 85% Male, 15% Female.
* **Occupations:** Data engineers, quantitative traders, experienced independent retail traders, algorithmic/semi-automated traders.
* **Liquid Capital:** $5,000 – $50,000+.
* **Geography:** Worldwide (US, UK, Germany, Singapore, Japan, Australia).
* **Primary Assets Traded:** Futures (NQ, ES), Forex Majors, Crypto (BTC/ETH).

### 3. Habits & Day-to-Day Behaviors
* **Spreadsheet Power User:** Keeps meticulous Google Sheets, Notion databases, or Obsidian notes tracking win rate, profit factor, risk-to-reward ratio (R:R), and maximum drawdown.
* **Multi-Timeframe Analysis:** Never trades on a single timeframe. They determine market structure on the 4H/1H, find fair value zones on the 15m, and execute on the 1m or 30-second chart.
* **The TradingView Pain Point:** When they use TradingView's Bar Replay, switching from the 4H to the 1m reveals future candles, destroys the validity of their backtest, and forces them to manually record every entry and exit into a spreadsheet.

### 4. Psychological Drivers: Fears, Desires & Frustrations
* **Deepest Fear:** Curve-fitting a strategy in backtesting that fails completely when deployed live because of lookahead bias or unseen spread/slippage.
* **Ultimate Desire:** Unassailable mathematical confidence in their strategy's statistical expectancy before allocating real risk capital.
* **Acute Frustration:** 
  1. *Lookahead Bias:* TradingView flashing future candles on timeframe switches.
  2. *Single Timeframe Stepping:* Having to manually advance multiple charts because TradingView doesn't synchronize multi-chart replay.
  3. *Inaccurate Order Fills:* Not knowing whether a wick hit their Stop Loss or Take Profit first inside a 1-hour bar.
* **The Objection:** *"I already pay \$30/month for TradingView. Why on earth should I pay for another charting tool?"*

### 5. Core Assumptions
* **Direct Comparison Sells:** Calling out TradingView's specific engineering flaws by name is the single fastest way to earn their respect and trust.
* **Feature Skepticism:** They despise marketing hype ("make money fast"). They only respond to technical specs: tick-level data, multi-timeframe synchronization, automated R:R calculation, zero lookahead guarantee.
* **High Retention:** Once a Systematizer imports their strategy into FX Replay and builds a verified 200-trade journal, their switching costs are massive. They become high-LTV annual subscribers.

### 6. Acquisition Channels & Target Keywords
* **Paid Search Keywords:** `tradingview bar replay alternatives`, `tradingview replay lookahead bias fix`, `multi timeframe backtesting software`, `tick by tick market replay browser`.
* **Meta & YouTube Angles:** Video side-by-side demonstrating the exact bug in TradingView (candle flash leak) vs. FX Replay's synchronized multi-timeframe stepping.
* **Reddit & Twitter Search Intent:** Answering threads complaining about TradingView's replay limitations.

### 7. Seed Hypotheses for the Experiment Engine
* **Hypothesis 3.1 (Objection Crushing):** A dedicated objection-demolishing section (*"Why TradingView's Replay Fails Serious Traders"*) will increase click-to-signup conversion by $\ge 20\%$ for traffic coming from `tradingview alternative` search queries.
* **Hypothesis 3.2 (Precision Proof):** Highlighting **"Sub-Second Tick Accuracy (No Ambiguous Wicks)"** will yield a 35% higher feature engagement rate compared to standard chart descriptions.

---

## 4. ICP Synthesis & Comparative Reference Matrix

| Attribute | ICP 1: Prop Firm Hunter | ICP 2: Weekend Warrior | ICP 3: TradingView Skeptic |
| :--- | :--- | :--- | :--- |
| **Traffic Allocation** | **60%** | **30%** | **10%** |
| **Target URL** | `fxreplay.com/freetrial?lp=1` | `fxreplay.com/freetrial?lp=2` | `fxreplay.com/freetrial?lp=3` |
| **Primary Pain** | Burning \$300–\$500 on failed evaluations | Lack of time to trade live weekday sessions | TradingView replay bugs & lookahead bias |
| **Emotional Trigger** | **Loss Aversion & Financial Regret** | **Time Compression & Accelerated Competence** | **Intellectual Rigor & Data Fidelity** |
| **Hero Headline** | *Stop burning \$300 challenge fees. Prove your edge first.* | *Master 1 year of price action in a single weekend.* | *TradingView was built for charts. FX Replay was built for edge.* |
| **Hero Subhead** | *Simulate FTMO and Apex drawdown rules bar-by-bar before buying a challenge.* | *Trade 100 London and NY sessions this Sunday with zero lookahead bias.* | *True multi-timeframe stepping, zero candle leaks, and sub-second tick accuracy.* |
| **Primary CTA** | **Test Your Prop Strategy Free** | **Start Weekend Replay Free** | **Experience Pure Replay Free** |
| **Key Differentiator** | Live Prop Firm Rule Tracking Engine | 24/7 Market Access & Automated Journaling | Zero Lookahead Bias & Sub-Second Tick Precision |
| **Price Elasticity** | High (Views \$35/mo as an insurance policy) | Very High (High income, values time over money) | Moderate (Already pays for TradingView, needs proof) |
| **Primary Conversion Risk** | Hesitant to commit time if setup feels complex | Will bounce if onboarding takes >60 seconds | Highly skeptical of marketing claims; verifies every claim |

---

## 5. Experiment Engine Data Integration Contract

This document provides the exact seed parameters to be ingested into the `icps` table and referenced by `experiment_variants` in the `/marketingengine` system:

```json
[
  {
    "icp_id": "icp_prop_hunter",
    "name": "Prop Firm Challenge Hunter",
    "lp_param": "1",
    "traffic_weight": 0.60,
    "primary_emotion": "Loss Aversion",
    "target_channel": "Google Search (FTMO/Prop) & Meta Video Ads",
    "hero_copy": {
      "eyebrow": "PROP FIRM CHALLENGE ACCELERATOR",
      "headline": "Stop burning $300 challenge fees. Prove your edge first.",
      "subheadline": "Simulate strict FTMO, Apex, and Topstep drawdown rules bar-by-bar. Discover your statistical expectancy before you buy an evaluation.",
      "cta": "Test Your Prop Strategy Free"
    }
  },
  {
    "icp_id": "icp_weekend_warrior",
    "name": "9-to-5 Weekend Warrior",
    "lp_param": "2",
    "traffic_weight": 0.30,
    "primary_emotion": "Time Compression",
    "target_channel": "Meta Professionals, LinkedIn, Weekend Retargeting",
    "hero_copy": {
      "eyebrow": "TIME COMPRESSION REPLAY ENGINE",
      "headline": "Master 1 year of price action in a single weekend.",
      "subheadline": "Don't wait 3 years to see 500 trade setups. Step through London and New York sessions on a Sunday morning with zero lookahead bias.",
      "cta": "Start Weekend Replay Free"
    }
  },
  {
    "icp_id": "icp_tv_skeptic",
    "name": "Systematizer / TradingView Skeptic",
    "lp_param": "3",
    "traffic_weight": 0.10,
    "primary_emotion": "Data Precision",
    "target_channel": "TradingView Search & Technical Communities",
    "hero_copy": {
      "eyebrow": "PURPOSE-BUILT TRADING SIMULATOR",
      "headline": "TradingView replay was built for charts. FX Replay was built for edge.",
      "subheadline": "True multi-timeframe stepping. No candle flash leaks. Sub-second tick data. Everything you wish TradingView's replay button could do.",
      "cta": "Experience Pure Replay Free"
    }
  }
]
```
