import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from 'lightweight-charts';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { analytics } from '../lib/analytics';

// Base spec: docs/FRONTEND_BUILD_SPEC.md §5 (lightweight-charts v4 API).
// Extended so the replay controls actually advance the market — a static chart
// would not demonstrate the product's core mechanic.

/**
 * lightweight-charts paints to a canvas, so it needs literal values rather than
 * Tailwind classes. These mirror the design tokens in tailwind.config.mjs — keep
 * the two in sync if the palette changes.
 */
const CHART_THEME = {
  background: '#030303', // surface        (bg-primary  → dark-900)
  grid: '#1A1A1A', //       line           (border-primary → dark-700)
  axisText: '#888888', //   ink-subtle     (text-disabled  → neutral-400)
  crosshair: '#0260FD', //  brand          (border-brand   → blue-600)
  up: '#53B483', //         success
  down: '#CD3636', //       error
} as const;

const CANDLE_COUNT = 140;
const SEED_CANDLES = 40; // visible before the user presses play
const PLAYBACK_MS = 420;

/**
 * Deterministic pseudo-random walk. A fixed seed keeps the rendered candles
 * identical across reloads, so the demo never looks broken or wildly different.
 */
function generateCandles(count: number): CandlestickData<UTCTimestamp>[] {
  let seed = 20260101;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const candles: CandlestickData<UTCTimestamp>[] = [];
  // 1H candles ending at a fixed point in time.
  const startTime = Date.UTC(2026, 0, 5, 0, 0, 0) / 1000;
  let price = 1.085;

  for (let i = 0; i < count; i++) {
    const drift = (random() - 0.48) * 0.0016;
    const open = price;
    const close = open + drift;
    const wick = Math.abs(drift) + random() * 0.0009 + 0.0002;
    const high = Math.max(open, close) + wick * random();
    const low = Math.min(open, close) - wick * random();

    candles.push({
      time: (startTime + i * 3600) as UTCTimestamp,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
    });

    price = close;
  }

  return candles;
}

export default function ChartSimulator() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const candlesRef = useRef<CandlestickData<UTCTimestamp>[]>(generateCandles(CANDLE_COUNT));
  const hasTrackedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [visibleCount, setVisibleCount] = useState(SEED_CANDLES);

  const candles = candlesRef.current;
  const current = candles[Math.min(visibleCount, candles.length) - 1];
  const first = candles[0];
  const changePct = current ? ((current.close - first.open) / first.open) * 100 : 0;
  const isUp = changePct >= 0;

  // Fire once on first interaction — conversion-relevant engagement signal.
  const trackFirstInteraction = useCallback(() => {
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;
    analytics.track('backtest_preview_interacted');
  }, []);

  // Build the chart once.
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_THEME.background },
        textColor: CHART_THEME.axisText,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: CHART_THEME.grid },
        horzLines: { color: CHART_THEME.grid },
      },
      rightPriceScale: { borderColor: CHART_THEME.grid },
      timeScale: { borderColor: CHART_THEME.grid, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: CHART_THEME.crosshair },
        horzLine: { color: CHART_THEME.crosshair },
      },
      width: chartContainerRef.current.clientWidth,
      height: 420,
    });

    const series = chart.addCandlestickSeries({
      upColor: CHART_THEME.up,
      downColor: CHART_THEME.down,
      borderVisible: false,
      wickUpColor: CHART_THEME.up,
      wickDownColor: CHART_THEME.down,
    });

    series.setData(candlesRef.current.slice(0, SEED_CANDLES));
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Reveal candles as the replay advances.
  useEffect(() => {
    seriesRef.current?.setData(candlesRef.current.slice(0, visibleCount));
  }, [visibleCount]);

  // Playback loop.
  useEffect(() => {
    if (!isPlaying) return;

    const id = window.setInterval(() => {
      setVisibleCount((n) => {
        if (n >= CANDLE_COUNT) {
          setIsPlaying(false);
          return n;
        }
        return n + 1;
      });
    }, PLAYBACK_MS);

    return () => window.clearInterval(id);
  }, [isPlaying]);

  const togglePlay = () => {
    trackFirstInteraction();
    setIsPlaying((p) => (visibleCount >= CANDLE_COUNT ? false : !p));
  };

  const stepForward = () => {
    trackFirstInteraction();
    setIsPlaying(false);
    setVisibleCount((n) => Math.min(n + 1, CANDLE_COUNT));
  };

  const reset = () => {
    trackFirstInteraction();
    setIsPlaying(false);
    setVisibleCount(SEED_CANDLES);
  };

  const atEnd = visibleCount >= CANDLE_COUNT;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
      {/* Replay header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-raised px-4 py-2.5 text-xs text-ink-muted">
        <div className="flex items-center gap-3">
          <span className="font-display font-black tracking-wider text-ink">FX REPL▶Y</span>
          <span className="rounded bg-surface-inset px-2 py-0.5 font-mono text-ink">EURUSD • 1H</span>
          <span className={`font-mono ${isUp ? 'text-success' : 'text-error'}`}>
            {current ? current.close.toFixed(5) : '—'} ({isUp ? '+' : ''}
            {changePct.toFixed(2)}%)
          </span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded bg-surface-inset px-2.5 py-1 font-semibold text-ink">
            Session: London
          </span>
        </div>
      </div>

      {/* Chart canvas */}
      <div ref={chartContainerRef} className="w-full" style={{ height: 420 }} />

      {/* Floating replay controls */}
      <div className="absolute bottom-[4.5rem] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-surface-raised/90 px-4 py-2 shadow-xl backdrop-blur-md">
        <button
          onClick={reset}
          aria-label="Restart replay"
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={togglePlay}
          disabled={atEnd}
          aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
          className="rounded-full bg-brand p-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={stepForward}
          disabled={atEnd}
          aria-label="Step forward one candle"
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <span className="rounded bg-surface-inset px-2 py-1 font-mono text-xs text-ink">1m Step</span>
      </div>

      {/* Execution bar */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-raised px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <button className="rounded bg-success px-3 py-1.5 font-bold text-surface transition-colors hover:bg-success-dark hover:text-white">
            BUY
          </button>
          <button className="rounded bg-error px-3 py-1.5 font-bold text-white transition-colors hover:bg-error-dark">
            SELL
          </button>
          <span className="ml-2 hidden font-mono text-ink-muted sm:inline">Lots: 1.00</span>
        </div>
        <div className="font-mono text-ink-muted">
          Account Balance: <span className="font-medium text-ink">$50,000.00</span>
        </div>
      </div>
    </div>
  );
}
