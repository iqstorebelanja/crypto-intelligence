import React, { useState, useRef, useEffect, useId } from 'react';
import {
  Activity,
  ChevronDown,
  Compass,
  Flame,
  Info,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import { MarketOverview, MarketSentimentData, NormalizedCoinData } from '../types';

interface MarketSentimentIndexProps {
  sentiment?: MarketSentimentData | null;
  overview?: MarketOverview | null;
  coins?: NormalizedCoinData[];
  compact?: boolean;
}

export const MarketSentimentIndex: React.FC<MarketSentimentIndexProps> = ({
  sentiment: initialSentiment,
  overview,
  coins = [],
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const componentId = useId();

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Derive or fallback sentiment data if missing
  const sentiment: MarketSentimentData = React.useMemo(() => {
    if (initialSentiment) return initialSentiment;
    if (overview?.sentiment) return overview.sentiment;

    // Client-side computation fallback
    const validRsis = coins
      .map(c => c.indicators?.rsi14)
      .filter((r): r is number => typeof r === 'number' && !isNaN(r));

    const avgRsi = validRsis.length > 0
      ? validRsis.reduce((a, b) => a + b, 0) / validRsis.length
      : overview?.btcCondition?.rsi14 ?? 50;

    const oversoldCount = validRsis.filter(r => r < 30).length;
    const overboughtCount = validRsis.filter(r => r > 70).length;
    const neutralCount = validRsis.length - (oversoldCount + overboughtCount);
    const totalCount = validRsis.length || 1;

    const totalCoins = coins.length || 1;
    const advancingCoins = coins.filter(c => (c.change24h || 0) > 0);
    const decliningCoins = coins.filter(c => (c.change24h || 0) < 0);
    const advancingCount = advancingCoins.length;
    const decliningCount = decliningCoins.length;
    const advancingPercent = Math.round((advancingCount / totalCoins) * 100);

    const sumChange = coins.reduce((acc, c) => acc + (c.change24h || 0), 0);
    const averageChange24h = Number((sumChange / totalCoins).toFixed(2));

    const breadthScore = advancingPercent;
    const changeScore = Math.max(0, Math.min(100, 50 + (averageChange24h * 5)));
    const momentumValue = Math.round(breadthScore * 0.6 + changeScore * 0.4);

    // Fallback F&G estimate
    const btcRsi = overview?.btcCondition?.rsi14 ?? 50;
    const btcChange = overview?.btcCondition?.change24h ?? 0;
    const fngEstimate = Math.round(
      Math.max(10, Math.min(95, btcRsi * 0.7 + (btcChange > 0 ? Math.min(25, btcChange * 3) : Math.max(-25, btcChange * 3)) + 15))
    );

    const compositeIndex = Math.max(
      0,
      Math.min(100, Math.round(fngEstimate * 0.40 + avgRsi * 0.35 + momentumValue * 0.25))
    );

    let tier: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed' = 'Neutral';
    let color = '#eab308';
    if (compositeIndex < 25) {
      tier = 'Extreme Fear';
      color = '#f43f5e';
    } else if (compositeIndex < 45) {
      tier = 'Fear';
      color = '#f97316';
    } else if (compositeIndex <= 55) {
      tier = 'Neutral';
      color = '#eab308';
    } else if (compositeIndex <= 75) {
      tier = 'Greed';
      color = '#10b981';
    } else {
      tier = 'Extreme Greed';
      color = '#06b6d4';
    }

    return {
      index: compositeIndex,
      tier,
      color,
      globalRsi: {
        value: Number(avgRsi.toFixed(1)),
        oversoldPercent: Math.round((oversoldCount / totalCount) * 100),
        overboughtPercent: Math.round((overboughtCount / totalCount) * 100),
        neutralPercent: Math.round((neutralCount / totalCount) * 100),
        oversoldCount,
        overboughtCount,
        neutralCount,
        status: avgRsi < 30 ? 'Oversold' : avgRsi < 45 ? 'Bearish Momentum' : avgRsi <= 55 ? 'Neutral' : avgRsi <= 70 ? 'Bullish Momentum' : 'Overbought',
        weight: 0.35
      },
      fearAndGreed: {
        value: fngEstimate,
        classification: fngEstimate < 25 ? 'Extreme Fear' : fngEstimate < 45 ? 'Fear' : fngEstimate <= 55 ? 'Neutral' : fngEstimate <= 75 ? 'Greed' : 'Extreme Greed',
        source: 'Composite Market F&G Confluence',
        timestamp: Date.now(),
        weight: 0.40
      },
      marketMomentum24h: {
        value: momentumValue,
        advancingCount,
        decliningCount,
        totalCount: totalCoins,
        advancingPercent,
        averageChange24h,
        status: momentumValue < 45 ? 'Bearish Tilt' : momentumValue <= 55 ? 'Balanced Breadth' : 'Bullish Tilt',
        weight: 0.25
      },
      lastCalculatedAt: Date.now()
    };
  }, [initialSentiment, overview, coins]);

  // Color mappings
  const getTierBadgeStyle = (tier: string) => {
    switch (tier) {
      case 'Extreme Fear':
        return 'bg-rose-950/80 border-rose-600/60 text-rose-300 shadow-rose-950/50';
      case 'Fear':
        return 'bg-amber-950/80 border-amber-600/60 text-amber-300 shadow-amber-950/50';
      case 'Neutral':
        return 'bg-yellow-950/80 border-yellow-600/60 text-yellow-300 shadow-yellow-950/50';
      case 'Greed':
        return 'bg-emerald-950/80 border-emerald-600/60 text-emerald-300 shadow-emerald-950/50';
      case 'Extreme Greed':
        return 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 shadow-cyan-950/50';
      default:
        return 'bg-slate-900 border-slate-700 text-slate-300';
    }
  };

  // Semi-circle gauge geometry
  // Semicircle from left (-180 deg) to right (0 deg)
  const radius = 34;
  const strokeWidth = 5;
  const circumference = Math.PI * radius; // half circle perimeter
  const strokeDashoffset = circumference - (sentiment.index / 100) * circumference;

  // Needle angle: -180 deg (score 0) to 0 deg (score 100)
  const needleAngleDeg = -180 + (sentiment.index / 100) * 180;
  const needleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLength = radius - 4;
  const centerX = 44;
  const centerY = 40;
  const needleX = centerX + needleLength * Math.cos(needleRad);
  const needleY = centerY + needleLength * Math.sin(needleRad);

  return (
    <div id={`market-sentiment-${componentId}`} className="relative inline-flex items-center font-mono select-none">
      {/* Trigger Button / Header Widget */}
      <button
        ref={triggerRef}
        type="button"
        id="sentiment-gauge-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center bg-[#0a111e]/90 hover:bg-[#0e1728] border border-[#1b273d] hover:border-cyan-500/40 rounded-xl px-2.5 py-1 transition-all duration-200 shadow-sm cursor-pointer gap-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        title="Market Sentiment Index: Aggregating Global RSI, Fear & Greed, and 24h Momentum"
      >
        {/* Semicircular Mini Arc Gauge */}
        <div className="relative w-[56px] h-[34px] overflow-hidden flex items-end justify-center shrink-0">
          <svg className="w-[56px] h-[46px] -mb-1" viewBox="0 0 88 50">
            <defs>
              <linearGradient id={`gaugeGradient-${componentId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="35%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="70%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>

            {/* Background track */}
            <path
              d="M 10 40 A 34 34 0 0 1 78 40"
              fill="none"
              stroke="#142032"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Colored active fill arc */}
            <path
              d="M 10 40 A 34 34 0 0 1 78 40"
              fill="none"
              stroke={`url(#gaugeGradient-${componentId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />

            {/* Center Pivot Hub */}
            <circle cx={centerX} cy={centerY} r={3.5} fill="#0d1422" stroke="#38bdf8" strokeWidth={1.5} />

            {/* Needle */}
            <line
              x1={centerX}
              y1={centerY}
              x2={needleX}
              y2={needleY}
              stroke="#ffffff"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
        </div>

        {/* Numeric Score & Tier */}
        <div className="flex flex-col text-left leading-none">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold text-white tracking-tight">
              {sentiment.index}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getTierBadgeStyle(
                sentiment.tier
              )}`}
            >
              {sentiment.tier}
            </span>
          </div>

          <span className="text-[9.5px] text-slate-400 font-semibold tracking-wide flex items-center gap-1 mt-0.5">
            SENTIMENT INDEX
            <ChevronDown className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyan-400' : 'group-hover:text-slate-300'}`} />
          </span>
        </div>

        {/* Sub-Pillar Micro Chips (Desktop) */}
        {!compact && (
          <div className="hidden xl:flex items-center gap-2 pl-1.5 border-l border-[#1d2a40] text-[10px] text-slate-400">
            {/* Fear & Greed */}
            <div className="flex items-center gap-1" title={`Fear & Greed: ${sentiment.fearAndGreed.value} (${sentiment.fearAndGreed.classification})`}>
              <Flame className="w-3 h-3 text-amber-400 shrink-0" />
              <span>F&G <strong className="text-slate-200">{sentiment.fearAndGreed.value}</strong></span>
            </div>

            {/* Global RSI */}
            <div className="flex items-center gap-1" title={`Global Market RSI: ${sentiment.globalRsi.value} (${sentiment.globalRsi.status})`}>
              <Activity className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>RSI <strong className="text-slate-200">{sentiment.globalRsi.value}</strong></span>
            </div>

            {/* 24h Momentum */}
            <div className="flex items-center gap-1" title={`24h Market Momentum: ${sentiment.marketMomentum24h.averageChange24h >= 0 ? '+' : ''}${sentiment.marketMomentum24h.averageChange24h}% (${sentiment.marketMomentum24h.advancingPercent}% advancing)`}>
              {sentiment.marketMomentum24h.averageChange24h >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
              )}
              <span>MOM <strong className={sentiment.marketMomentum24h.averageChange24h >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {sentiment.marketMomentum24h.averageChange24h >= 0 ? '+' : ''}{sentiment.marketMomentum24h.averageChange24h}%
              </strong></span>
            </div>
          </div>
        )}
      </button>

      {/* Expanded Sentiment Breakdown Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          id="sentiment-breakdown-popover"
          className="absolute top-full left-0 mt-2 w-[340px] sm:w-[420px] bg-[#090f1b]/98 backdrop-blur-xl border border-[#1e2c45] rounded-2xl p-4 shadow-2xl z-50 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Popover Header */}
          <div className="flex items-start justify-between border-b border-[#182338] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white tracking-wide">
                  Market Sentiment Index
                </h4>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getTierBadgeStyle(sentiment.tier)}`}>
                  {sentiment.tier}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Confluence model aggregating sentiment, indicators, and breadth.
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-800/60 transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Composite Visual Gauge & Meter */}
          <div className="bg-[#0e1626] border border-[#1c293f] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px] font-semibold">
                COMPOSITE SCORE
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white" style={{ color: sentiment.color }}>
                  {sentiment.index}
                </span>
                <span className="text-slate-500 text-xs">/ 100</span>
              </div>
            </div>

            {/* Segmented Gradient Bar */}
            <div className="relative h-2 w-full bg-[#152033] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${sentiment.index}%`,
                  backgroundColor: sentiment.color,
                  boxShadow: `0 0 10px ${sentiment.color}80`
                }}
              />
            </div>

            {/* Spectrum Scale Labels */}
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span className="text-rose-400">0 Extreme Fear</span>
              <span className="text-amber-400">25 Fear</span>
              <span className="text-yellow-400">50 Neutral</span>
              <span className="text-emerald-400">75 Greed</span>
              <span className="text-cyan-400">100 Ext Greed</span>
            </div>
          </div>

          {/* The 3 Sub-Pillar Breakdowns */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider px-0.5">
              <span>Constituent Weighting</span>
              <span className="text-slate-500">Confluence Math</span>
            </div>

            {/* Pillar 1: Crypto Fear & Greed */}
            <div className="bg-[#0b1322] border border-[#19263c] rounded-xl p-3 space-y-2 hover:border-[#223554] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Flame className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200">1. Fear & Greed Data</span>
                    <span className="block text-[10px] text-slate-400">{sentiment.fearAndGreed.source}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-amber-300 text-sm">
                    {sentiment.fearAndGreed.value}
                  </div>
                  <span className="text-[10px] text-slate-400">Weight: 40%</span>
                </div>
              </div>

              <div className="w-full bg-[#131e30] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all"
                  style={{ width: `${sentiment.fearAndGreed.value}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                <span>Reading: <strong className="text-slate-300">{sentiment.fearAndGreed.classification}</strong></span>
                <span>Impact: <strong className="text-amber-300">+{(sentiment.fearAndGreed.value * 0.4).toFixed(1)} pts</strong></span>
              </div>
            </div>

            {/* Pillar 2: Global Market RSI */}
            <div className="bg-[#0b1322] border border-[#19263c] rounded-xl p-3 space-y-2 hover:border-[#223554] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200">2. Global Market RSI</span>
                    <span className="block text-[10px] text-slate-400">Mean 14-period across scanned basket</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-cyan-300 text-sm">
                    {sentiment.globalRsi.value}
                  </div>
                  <span className="text-[10px] text-slate-400">Weight: 35%</span>
                </div>
              </div>

              <div className="w-full bg-[#131e30] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, sentiment.globalRsi.value))}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                <span>Condition: <strong className="text-slate-300">{sentiment.globalRsi.status}</strong></span>
                <span className="space-x-2">
                  <span className="text-rose-400" title="Oversold assets">{sentiment.globalRsi.oversoldPercent}% &lt;30</span>
                  <span className="text-cyan-400" title="Overbought assets">{sentiment.globalRsi.overboughtPercent}% &gt;70</span>
                  <span className="text-slate-300 font-bold">Impact: +{(sentiment.globalRsi.value * 0.35).toFixed(1)} pts</span>
                </span>
              </div>
            </div>

            {/* Pillar 3: Dominant 24h Market Momentum */}
            <div className="bg-[#0b1322] border border-[#19263c] rounded-xl p-3 space-y-2 hover:border-[#223554] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200">3. Dominant 24h Momentum</span>
                    <span className="block text-[10px] text-slate-400">Market breadth & basket return</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-300 text-sm">
                    {sentiment.marketMomentum24h.value}
                  </div>
                  <span className="text-[10px] text-slate-400">Weight: 25%</span>
                </div>
              </div>

              <div className="w-full bg-[#131e30] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${sentiment.marketMomentum24h.value}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                <span>Advancers: <strong className="text-emerald-400">{sentiment.marketMomentum24h.advancingPercent}%</strong> ({sentiment.marketMomentum24h.advancingCount}/{sentiment.marketMomentum24h.totalCount})</span>
                <span>Avg 24h: <strong className={sentiment.marketMomentum24h.averageChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {sentiment.marketMomentum24h.averageChange24h >= 0 ? '+' : ''}{sentiment.marketMomentum24h.averageChange24h}%
                </strong></span>
              </div>
            </div>
          </div>

          {/* Mathematical Confluence Formula Footer */}
          <div className="bg-[#0a101c] border border-[#162134] rounded-xl p-2.5 text-[10px] text-slate-400 font-mono space-y-1">
            <div className="flex items-center gap-1 text-cyan-300 font-bold">
              <Info className="w-3 h-3 shrink-0" />
              <span>Confluence Formula:</span>
            </div>
            <div className="text-slate-300">
              Score = (0.40 × F&G) + (0.35 × RSI) + (0.25 × 24h MOM)
            </div>
            <div className="text-slate-500 text-[9.5px]">
              = ({sentiment.fearAndGreed.value} × 0.40) + ({sentiment.globalRsi.value} × 0.35) + ({sentiment.marketMomentum24h.value} × 0.25) = <strong className="text-white font-bold">{sentiment.index}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
