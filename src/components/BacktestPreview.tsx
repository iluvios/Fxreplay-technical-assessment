import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, TrendingUp, BarChart2, Zap, Award } from 'lucide-react';
import { analytics } from '../lib/analytics';

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  type: 'bull' | 'bear';
}

const INITIAL_CANDLES: Candle[] = [
  { time: '09:30', open: 1.0820, high: 1.0835, low: 1.0815, close: 1.0832, type: 'bull' },
  { time: '09:35', open: 1.0832, high: 1.0848, low: 1.0828, close: 1.0845, type: 'bull' },
  { time: '09:40', open: 1.0845, high: 1.0850, low: 1.0836, close: 1.0839, type: 'bear' },
  { time: '09:45', open: 1.0839, high: 1.0842, low: 1.0822, close: 1.0825, type: 'bear' },
  { time: '09:50', open: 1.0825, high: 1.0838, low: 1.0820, close: 1.0836, type: 'bull' },
  { time: '09:55', open: 1.0836, high: 1.0858, low: 1.0834, close: 1.0855, type: 'bull' },
  { time: '10:00', open: 1.0855, high: 1.0872, low: 1.0850, close: 1.0868, type: 'bull' },
  { time: '10:05', open: 1.0868, high: 1.0870, low: 1.0854, close: 1.0858, type: 'bear' },
  { time: '10:10', open: 1.0858, high: 1.0885, low: 1.0855, close: 1.0882, type: 'bull' },
];

const EXTRA_CANDLES: Candle[] = [
  { time: '10:15', open: 1.0882, high: 1.0894, low: 1.0878, close: 1.0890, type: 'bull' },
  { time: '10:20', open: 1.0890, high: 1.0895, low: 1.0872, close: 1.0875, type: 'bear' },
  { time: '10:25', open: 1.0875, high: 1.0888, low: 1.0870, close: 1.0884, type: 'bull' },
  { time: '10:30', open: 1.0884, high: 1.0910, low: 1.0880, close: 1.0905, type: 'bull' },
  { time: '10:35', open: 1.0905, high: 1.0918, low: 1.0898, close: 1.0912, type: 'bull' },
];

export const BacktestPreview: React.FC<{ onCtaClick: () => void }> = ({ onCtaClick }) => {
  const [candles, setCandles] = useState<Candle[]>(INITIAL_CANDLES);
  const [extraIndex, setExtraIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulatedPnL, setSimulatedPnL] = useState<number>(420.50);
  const [activeMarket, setActiveMarket] = useState('EUR/USD');
  const [activeTimeframe, setActiveTimeframe] = useState('5m');

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        advanceCandle();
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isPlaying, extraIndex]);

  const advanceCandle = () => {
    if (extraIndex < EXTRA_CANDLES.length) {
      const nextCandle = EXTRA_CANDLES[extraIndex];
      setCandles((prev) => [...prev, nextCandle]);
      setExtraIndex((prev) => prev + 1);
      setSimulatedPnL((prev) => +(prev + (nextCandle.type === 'bull' ? 142.50 : -65.20)).toFixed(2));
      analytics.track('backtest_preview_interacted', { action: 'step_forward', candle_count: candles.length + 1 });
    } else {
      setIsPlaying(false);
    }
  };

  const resetSimulation = () => {
    setCandles(INITIAL_CANDLES);
    setExtraIndex(0);
    setSimulatedPnL(420.50);
    setIsPlaying(false);
  };

  return (
    <div id="simulator" className="w-full rounded-2xl bg-fxr-card border border-fxr-border overflow-hidden shadow-2xl fxr-glow transition-all">
      {/* Top Bar: Controls & Market Selector */}
      <div className="flex flex-wrap items-center justify-between border-b border-fxr-border px-4 py-3 bg-fxr-bg/60 gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-fxr-card border border-fxr-border text-xs font-semibold text-fxr-text">
            <BarChart2 className="w-3.5 h-3.5 text-fxr-primary" />
            <span>{activeMarket}</span>
          </div>

          <div className="flex rounded-lg bg-fxr-card border border-fxr-border p-0.5 text-xs">
            {['1m', '5m', '15m', '1h'].map((tf) => (
              <button
                key={tf}
                onClick={() => {
                  setActiveTimeframe(tf);
                  analytics.track('backtest_preview_interacted', { timeframe: tf });
                }}
                className={`px-2 py-0.5 rounded-md font-mono transition-colors ${
                  activeTimeframe === tf
                    ? 'bg-fxr-primary text-white font-semibold'
                    : 'text-fxr-muted hover:text-fxr-text'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-fxr-muted px-2">
            <span className="w-2 h-2 rounded-full bg-fxr-accent animate-pulse"></span>
            Replay Session: <strong className="text-fxr-text font-mono">NY AM Session</strong>
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              analytics.track('backtest_preview_interacted', { is_playing: !isPlaying });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fxr-border hover:bg-fxr-borderLight text-xs font-medium text-fxr-text transition-all"
            title={isPlaying ? 'Pause Replay' : 'Play Historical Replay'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-yellow-400" /> : <Play className="w-3.5 h-3.5 text-fxr-accent fill-fxr-accent" />}
            <span>{isPlaying ? 'Pause' : 'Replay'}</span>
          </button>

          <button
            onClick={advanceCandle}
            disabled={extraIndex >= EXTRA_CANDLES.length}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-fxr-border hover:bg-fxr-borderLight text-xs font-medium text-fxr-text disabled:opacity-40 transition-all"
            title="Step 1 Candle Forward"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span className="hidden md:inline">+1 Bar</span>
          </button>

          <div className="pl-2 border-l border-fxr-border text-xs">
            <span className="text-fxr-subtle mr-1.5">Session P&L:</span>
            <span className={`font-mono font-bold ${simulatedPnL >= 0 ? 'text-fxr-accent' : 'text-fxr-danger'}`}>
              {simulatedPnL >= 0 ? `+$${simulatedPnL.toFixed(2)}` : `-$${Math.abs(simulatedPnL).toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Simulated Candlestick Replay Chart */}
      <div className="relative h-64 sm:h-72 w-full p-4 flex items-end justify-between bg-gradient-to-b from-[#080A0F] to-[#0D111A] overflow-hidden">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 grid grid-rows-4 grid-cols-6 pointer-events-none opacity-20">
          <div className="border-b border-fxr-border col-span-6"></div>
          <div className="border-b border-fxr-border col-span-6"></div>
          <div className="border-b border-fxr-border col-span-6"></div>
          <div className="border-b border-fxr-border col-span-6"></div>
        </div>

        {/* Candlestick Bars */}
        <div className="relative z-10 w-full h-full flex items-end justify-around gap-1.5 sm:gap-3 pt-6 pb-2">
          {candles.map((candle, idx) => {
            const isBull = candle.type === 'bull';
            const heightPercent = Math.min(Math.max((candle.close - 1.0810) * 8000, 20), 92);
            return (
              <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer animate-fadeIn">
                {/* Upper/Lower Wick */}
                <div 
                  className={`w-0.5 rounded-full ${isBull ? 'bg-fxr-accent' : 'bg-fxr-danger'} transition-all`}
                  style={{ height: `${Math.min(heightPercent + 14, 98)}%` }}
                ></div>
                {/* Candle Body */}
                <div
                  className={`w-full max-w-[14px] sm:max-w-[20px] rounded-sm -mt-24 transition-all duration-300 ${
                    isBull 
                      ? 'bg-fxr-accent border border-green-400 group-hover:bg-green-400 shadow-sm shadow-green-500/20' 
                      : 'bg-fxr-danger border border-red-400 group-hover:bg-red-400 shadow-sm shadow-red-500/20'
                  }`}
                  style={{ height: `${Math.max(heightPercent * 0.45, 14)}%` }}
                ></div>
                <span className="text-[9px] sm:text-[10px] text-fxr-subtle font-mono mt-2">
                  {candle.time}
                </span>
              </div>
            );
          })}
        </div>

        {/* Floating Trading Prompt Overlay */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 p-2 rounded-xl bg-fxr-card/90 border border-fxr-border backdrop-blur-md text-xs shadow-lg">
          <Award className="w-4 h-4 text-yellow-400" />
          <span className="text-fxr-text font-medium">Prop Firm Target: 82% Complete</span>
        </div>
      </div>

      {/* Simulator Bottom Banner / Replay CTA */}
      <div className="px-6 py-4 bg-fxr-card border-t border-fxr-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-fxr-muted">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-fxr-text font-semibold text-sm">Practice execution without risking capital</div>
            <div>Full tick-level historical data across Forex, Futures, and Crypto back to 2003.</div>
          </div>
        </div>

        <button
          onClick={onCtaClick}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-white bg-fxr-primary hover:bg-fxr-primaryHover active:scale-95 transition-all text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 shrink-0"
        >
          <span>Start Full Free Session</span>
          <TrendingUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
