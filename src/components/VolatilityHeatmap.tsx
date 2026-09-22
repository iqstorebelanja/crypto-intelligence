import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import {
  Flame,
  Activity,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Layers,
  Zap,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { NormalizedCoinData } from '../types';

interface VolatilityHeatmapProps {
  coins: NormalizedCoinData[];
  onSelectCoin: (coin: NormalizedCoinData) => void;
  activeExchange?: string;
}

export interface VolatilityAssetData {
  symbol: string;
  rawSymbol: string;
  baseAsset: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  rangeUsd: number;
  rangePercent: number;
  positionPercent: number; // 0% = at low, 100% = at high
  quoteVolume: number;
  heatColor: string;
  regime: string;
  originalCoin: NormalizedCoinData;
}

const getVolatilityColor = (rangePercent: number): string => {
  if (rangePercent >= 12) return '#f43f5e'; // Rose-500 (Extreme)
  if (rangePercent >= 8) return '#f97316';  // Orange-500 (High)
  if (rangePercent >= 5) return '#eab308';  // Amber-500 (Moderate)
  if (rangePercent >= 3) return '#10b981';  // Emerald-500 (Active)
  return '#06b6d4';                         // Cyan-500 (Compressed)
};

const getVolatilityRegime = (rangePercent: number): string => {
  if (rangePercent >= 12) return 'Extreme Volatility';
  if (rangePercent >= 8) return 'High Expansion';
  if (rangePercent >= 5) return 'Moderate Volatility';
  if (rangePercent >= 3) return 'Normal Active';
  return 'Compressed Range';
};

const formatPrice = (val: number): string => {
  if (val == null || isNaN(val)) return '$0.00';
  if (val >= 1000) return `$${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val >= 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(8)}`;
};

const formatVolume = (val: number): string => {
  if (val == null || isNaN(val) || val === 0) return '$0';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
};

export const VolatilityHeatmap: React.FC<VolatilityHeatmapProps> = ({
  coins,
  onSelectCoin,
  activeExchange = 'BINANCE'
}) => {
  const [topCount, setTopCount] = useState<8 | 12 | 16>(12);
  const [sortBy, setSortBy] = useState<'volume' | 'volatility_desc' | 'volatility_asc'>('volume');
  const [metricMode, setMetricMode] = useState<'rangePercent' | 'positionPercent'>('rangePercent');
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Process and compute 24h range intensity metrics
  const processedData = useMemo<VolatilityAssetData[]>(() => {
    if (!coins || coins.length === 0) return [];

    // Deduplicate by symbol
    const seen = new Set<string>();
    const uniqueCoins: NormalizedCoinData[] = [];
    for (const c of coins) {
      const clean = c.symbol.replace(/[\/\-_]/g, '').toUpperCase();
      if (!seen.has(clean)) {
        seen.add(clean);
        uniqueCoins.push(c);
      }
    }

    const computed = uniqueCoins.map((coin) => {
      const price = coin.price || 0;
      let high = coin.high24h || 0;
      let low = coin.low24h || 0;

      // Fallback if high/low are missing or invalid
      if (high <= 0 || low <= 0 || high < low) {
        const absChange = Math.abs(coin.change24h || 0) / 100;
        high = price * (1 + Math.max(0.015, absChange * 0.8));
        low = price * (1 - Math.max(0.015, absChange * 0.8));
      }

      const rangeUsd = Math.max(0, high - low);
      const rangePercent = low > 0 ? (rangeUsd / low) * 100 : Math.abs(coin.change24h || 0);

      // Current spot position between 24h low (0%) and 24h high (100%)
      let positionPercent = 50;
      if (high > low) {
        positionPercent = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
      }

      const quoteVolume = coin.quoteVolume24h || (coin.volume24h ? coin.volume24h * price : 0);
      const heatColor = getVolatilityColor(rangePercent);
      const regime = getVolatilityRegime(rangePercent);

      return {
        symbol: coin.symbol,
        rawSymbol: coin.rawSymbol || coin.symbol.replace(/[\/\-_]/g, ''),
        baseAsset: coin.baseAsset || coin.symbol.split('/')[0] || coin.symbol,
        price,
        change24h: coin.change24h || 0,
        high24h: high,
        low24h: low,
        rangeUsd,
        rangePercent: Number(rangePercent.toFixed(2)),
        positionPercent: Number(positionPercent.toFixed(1)),
        quoteVolume,
        heatColor,
        regime,
        originalCoin: coin
      };
    });

    // Sorting
    let sorted = [...computed];
    if (sortBy === 'volume') {
      sorted.sort((a, b) => b.quoteVolume - a.quoteVolume);
    } else if (sortBy === 'volatility_desc') {
      sorted.sort((a, b) => b.rangePercent - a.rangePercent);
    } else if (sortBy === 'volatility_asc') {
      sorted.sort((a, b) => a.rangePercent - b.rangePercent);
    }

    return sorted.slice(0, topCount);
  }, [coins, topCount, sortBy]);

  // Macro Summary Metrics
  const { avgVolatility, maxVolatileAsset, minVolatileAsset } = useMemo(() => {
    if (processedData.length === 0) {
      return { avgVolatility: 0, maxVolatileAsset: null, minVolatileAsset: null };
    }
    const sum = processedData.reduce((acc, curr) => acc + curr.rangePercent, 0);
    const avg = Number((sum / processedData.length).toFixed(2));

    let maxAsset = processedData[0];
    let minAsset = processedData[0];

    for (const d of processedData) {
      if (d.rangePercent > maxAsset.rangePercent) maxAsset = d;
      if (d.rangePercent < minAsset.rangePercent) minAsset = d;
    }

    return {
      avgVolatility: avg,
      maxVolatileAsset: maxAsset,
      minVolatileAsset: minAsset
    };
  }, [processedData]);

  // Recharts Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: VolatilityAssetData = payload[0].payload;
    if (!data) return null;

    return (
      <div
        id={`tooltip-volatility-${data.rawSymbol}`}
        className="p-3 rounded-xl bg-[#090e17]/95 border shadow-2xl backdrop-blur-md text-xs font-mono max-w-[280px] transition-all"
        style={{ borderColor: data.heatColor }}
      >
        <div className="flex items-center justify-between border-b border-[#1b273d] pb-2 mb-2">
          <div className="flex items-center space-x-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: data.heatColor }}
            />
            <span className="font-bold text-white text-sm">{data.symbol}</span>
          </div>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
            style={{
              backgroundColor: `${data.heatColor}20`,
              color: data.heatColor,
              border: `1px solid ${data.heatColor}60`
            }}
          >
            {data.regime}
          </span>
        </div>

        {/* Spot Price & 24h Change */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-400">Spot Price:</span>
          <div className="flex items-center space-x-1">
            <span className="text-white font-bold">{formatPrice(data.price)}</span>
            <span
              className={`text-[11px] font-semibold flex items-center ${
                data.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {data.change24h >= 0 ? '+' : ''}
              {data.change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 24h Range Bounds */}
        <div className="p-2 rounded-lg bg-[#0c1422] border border-[#162238] space-y-1.5 mb-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">24h Low:</span>
            <span className="text-slate-300 font-semibold">{formatPrice(data.low24h)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">24h High:</span>
            <span className="text-slate-300 font-semibold">{formatPrice(data.high24h)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] border-t border-[#1a2842] pt-1">
            <span className="text-slate-300 font-bold">Range Intensity:</span>
            <span className="font-bold" style={{ color: data.heatColor }}>
              {data.rangePercent.toFixed(2)}% ({formatPrice(data.rangeUsd)})
            </span>
          </div>

          {/* Range Slider Pin (0% Low to 100% High) */}
          <div className="pt-1">
            <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
              <span>Low</span>
              <span className="text-cyan-300 font-bold">{data.positionPercent}% of Range</span>
              <span>High</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full relative overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${data.positionPercent}%`,
                  backgroundColor: data.heatColor
                }}
              />
            </div>
          </div>
        </div>

        {/* 24h Volume */}
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>24h Quote Volume:</span>
          <span className="text-slate-200 font-semibold">{formatVolume(data.quoteVolume)}</span>
        </div>

        <div className="mt-2 pt-1.5 border-t border-[#162238] text-[9px] text-center text-cyan-400 font-sans tracking-wide">
          Click bar to inspect {data.baseAsset} in detail ➔
        </div>
      </div>
    );
  };

  if (processedData.length === 0) {
    return null;
  }

  return (
    <div
      id="market-volatility-heatmap"
      className="bg-[#0c121e] border border-[#1e2a42] rounded-2xl p-4 shadow-xl relative overflow-hidden transition-all"
    >
      {/* 1. Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#172238] pb-3 mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/40 text-amber-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-sm text-white tracking-wider">
                24H VOLATILITY & RANGE HEATMAP
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                {activeExchange} SPOT
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 hidden sm:block">
              24h High-to-Low price range expansion and volatility intensity for top traded pairs
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Metric Mode Toggle */}
          <div className="flex items-center bg-[#080d16] border border-[#1a283f] rounded-lg p-0.5">
            <button
              onClick={() => setMetricMode('rangePercent')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                metricMode === 'rangePercent'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="View 24h high-to-low percentage swing intensity"
            >
              Range Volatility (%)
            </button>
            <button
              onClick={() => setMetricMode('positionPercent')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                metricMode === 'positionPercent'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="View current price position inside the 24h range (0%=Low, 100%=High)"
            >
              Range Position (%)
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center bg-[#080d16] border border-[#1a283f] rounded-lg px-2 py-1 space-x-1.5 text-[11px]">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 border-none outline-none text-[11px] cursor-pointer"
              aria-label="Sort Volatility Heatmap"
            >
              <option value="volume" className="bg-[#0c121e] text-white">
                Top Traded (Volume)
              </option>
              <option value="volatility_desc" className="bg-[#0c121e] text-white">
                Max Volatility (Highest)
              </option>
              <option value="volatility_asc" className="bg-[#0c121e] text-white">
                Compressed Range (Lowest)
              </option>
            </select>
          </div>

          {/* Top Asset Count Selector */}
          <div className="flex items-center bg-[#080d16] border border-[#1a283f] rounded-lg p-0.5 text-[10px]">
            {([8, 12, 16] as const).map((cnt) => (
              <button
                key={cnt}
                onClick={() => setTopCount(cnt)}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  topCount === cnt
                    ? 'bg-[#1b2a44] text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg bg-[#080d16] hover:bg-[#131e33] border border-[#1a283f] text-slate-400 hover:text-white transition-all"
            title={isCollapsed ? 'Expand Volatility Heatmap' : 'Collapse Volatility Heatmap'}
            aria-label="Toggle Volatility Heatmap Visibility"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* 2. Quick Stat Badges Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono mb-3.5">
            {/* Benchmark Average Volatility */}
            <div className="p-2 rounded-xl bg-[#080d16] border border-[#152033] flex flex-col justify-between">
              <span className="text-[10px] uppercase text-slate-400">Benchmark Avg Range</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-white">{avgVolatility}%</span>
                <span className="text-[10px] text-slate-400">24h swing</span>
              </div>
            </div>

            {/* Most Volatile Asset */}
            {maxVolatileAsset && (
              <div
                onClick={() => onSelectCoin(maxVolatileAsset.originalCoin)}
                className="p-2 rounded-xl bg-[#080d16] hover:bg-[#101827] border border-[#152033] hover:border-rose-500/50 flex flex-col justify-between cursor-pointer transition-all group"
                title={`Click to view ${maxVolatileAsset.symbol}`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="uppercase">Peak Volatility</span>
                  <Flame className="w-3 h-3 text-rose-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-sm font-bold text-white group-hover:text-rose-300">
                    {maxVolatileAsset.baseAsset}
                  </span>
                  <span className="text-xs font-bold text-rose-400">
                    +{maxVolatileAsset.rangePercent}%
                  </span>
                </div>
              </div>
            )}

            {/* Most Compressed Asset */}
            {minVolatileAsset && (
              <div
                onClick={() => onSelectCoin(minVolatileAsset.originalCoin)}
                className="p-2 rounded-xl bg-[#080d16] hover:bg-[#101827] border border-[#152033] hover:border-cyan-500/50 flex flex-col justify-between cursor-pointer transition-all group"
                title={`Click to view ${minVolatileAsset.symbol}`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="uppercase">Most Compressed</span>
                  <Activity className="w-3 h-3 text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-sm font-bold text-white group-hover:text-cyan-300">
                    {minVolatileAsset.baseAsset}
                  </span>
                  <span className="text-xs font-bold text-cyan-400">
                    {minVolatileAsset.rangePercent}%
                  </span>
                </div>
              </div>
            )}

            {/* Top Traded Total Volume */}
            <div className="p-2 rounded-xl bg-[#080d16] border border-[#152033] flex flex-col justify-between">
              <span className="text-[10px] uppercase text-slate-400">Sample Top Volume</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-cyan-300">
                  {formatVolume(processedData.reduce((acc, d) => acc + d.quoteVolume, 0))}
                </span>
                <span className="text-[10px] text-slate-400">Top {topCount}</span>
              </div>
            </div>
          </div>

          {/* 3. Recharts Heatmap Chart */}
          <div className="bg-[#080d16] border border-[#152033] rounded-xl p-3 pt-4 mb-3">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={processedData}
                  margin={{ top: 12, right: 12, left: -16, bottom: 20 }}
                  onClick={(state: any) => {
                    const payload = (state as any)?.activePayload;
                    if (payload && payload.length > 0) {
                      const data: VolatilityAssetData = payload[0].payload;
                      if (data?.originalCoin) {
                        onSelectCoin(data.originalCoin);
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="#162238" vertical={false} />
                  <XAxis
                    dataKey="baseAsset"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    stroke="#1e2a42"
                    tickLine={{ stroke: '#1e2a42' }}
                    dy={6}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    stroke="#1e2a42"
                    tickLine={{ stroke: '#1e2a42' }}
                    unit="%"
                    domain={metricMode === 'positionPercent' ? [0, 100] : [0, 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />

                  {/* Benchmark Average Reference Line */}
                  {metricMode === 'rangePercent' && avgVolatility > 0 && (
                    <ReferenceLine
                      y={avgVolatility}
                      stroke="#475569"
                      strokeDasharray="3 3"
                      label={{
                        value: `Avg: ${avgVolatility}%`,
                        fill: '#94a3b8',
                        fontSize: 10,
                        position: 'insideTopRight',
                        fontFamily: 'monospace'
                      }}
                    />
                  )}

                  {metricMode === 'positionPercent' && (
                    <ReferenceLine
                      y={50}
                      stroke="#475569"
                      strokeDasharray="3 3"
                      label={{
                        value: 'Mid-Range (50%)',
                        fill: '#94a3b8',
                        fontSize: 10,
                        position: 'insideTopRight',
                        fontFamily: 'monospace'
                      }}
                    />
                  )}

                  <Bar
                    dataKey={metricMode}
                    radius={[6, 6, 0, 0]}
                    animationDuration={600}
                  >
                    {processedData.map((entry) => {
                      const isHovered = hoveredSymbol === entry.symbol;
                      const fillColor =
                        metricMode === 'positionPercent'
                          ? entry.positionPercent >= 70
                            ? '#10b981'
                            : entry.positionPercent <= 30
                            ? '#f43f5e'
                            : '#06b6d4'
                          : entry.heatColor;

                      return (
                        <Cell
                          key={`bar-${entry.symbol}`}
                          fill={fillColor}
                          fillOpacity={isHovered ? 1 : 0.88}
                          stroke={isHovered ? '#ffffff' : fillColor}
                          strokeWidth={isHovered ? 2 : 1}
                          className="cursor-pointer transition-all duration-200"
                          onClick={() => onSelectCoin(entry.originalCoin)}
                          onMouseEnter={() => setHoveredSymbol(entry.symbol)}
                          onMouseLeave={() => setHoveredSymbol(null)}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Compact Heatmap Matrix Tiles (Quick visual range comparison) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 font-mono text-xs">
            {processedData.map((item) => (
              <div
                key={item.symbol}
                onClick={() => onSelectCoin(item.originalCoin)}
                onMouseEnter={() => setHoveredSymbol(item.symbol)}
                onMouseLeave={() => setHoveredSymbol(null)}
                className={`p-2 rounded-xl bg-[#080d16] hover:bg-[#111929] border transition-all cursor-pointer group flex flex-col justify-between ${
                  hoveredSymbol === item.symbol
                    ? 'border-cyan-400 shadow-md shadow-cyan-950/50'
                    : 'border-[#152033]'
                }`}
                title={`Click to inspect ${item.symbol}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white group-hover:text-cyan-300">
                    {item.baseAsset}
                  </span>
                  <span
                    className="text-[10px] px-1 py-0.2 rounded font-bold"
                    style={{
                      backgroundColor: `${item.heatColor}20`,
                      color: item.heatColor,
                      border: `1px solid ${item.heatColor}50`
                    }}
                  >
                    {item.rangePercent}%
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-slate-300 mb-1">
                  {formatPrice(item.price)}
                </div>

                {/* Mini Range Visual with Pin */}
                <div className="space-y-0.5">
                  <div className="h-1.5 w-full bg-slate-800 rounded-full relative overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.positionPercent}%`,
                        backgroundColor: item.heatColor
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-500">
                    <span className="truncate max-w-[45px]">{formatPrice(item.low24h)}</span>
                    <span className="truncate max-w-[45px] text-right">{formatPrice(item.high24h)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 5. Heatmap Legend & Methodology Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 mt-3 border-t border-[#141d2e] font-mono text-[10px] text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 uppercase tracking-wider font-semibold">
                Intensity Scale:
              </span>
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-sm bg-[#06b6d4]" />
                  <span>&lt;3% Compressed</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-sm bg-[#10b981]" />
                  <span>3-5% Normal</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-sm bg-[#eab308]" />
                  <span>5-8% Moderate</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-sm bg-[#f97316]" />
                  <span>8-12% High</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-sm bg-[#f43f5e]" />
                  <span>&gt;12% Extreme</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 text-slate-500">
              <Info className="w-3 h-3" />
              <span>Range % = (24h High - 24h Low) / 24h Low × 100</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
