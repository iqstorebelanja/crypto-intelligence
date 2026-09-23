import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Compass,
  Filter,
  Layers,
  Minus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import {
  ExchangeId,
  MarketSignal,
  MultiTimeframeConfluenceSummary,
  NormalizedCoinData,
  SignalDirection,
  SignalLifecycleStatus,
  SignalType
} from '../types';
import { DataFreshness, WatchlistButton } from './Badges';

interface SignalIntelligencePanelProps {
  coins: NormalizedCoinData[];
  watchlistSymbols: string[];
  onToggleWatchlist: (symbol: string) => void;
  onSelectCoin: (coin: NormalizedCoinData) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

type SignalFilterType =
  | 'ALL'
  | 'BULLISH_ONLY'
  | 'BEARISH_ONLY'
  | 'CONFIRMED_ONLY'
  | 'ACTIVE_ONLY'
  | 'STRONG_CONFLUENCE_ONLY'
  | 'BREAKOUT_ONLY'
  | 'BREAKDOWN_ONLY'
  | 'REVERSAL_ONLY'
  | 'CONTINUATION_ONLY';

type SignalSortField =
  | 'strength'
  | 'bullScore'
  | 'downsideRisk'
  | 'mtfConfluence'
  | 'volume'
  | 'oiChange'
  | 'funding'
  | 'rsi'
  | 'change24h';

export const SignalIntelligencePanel: React.FC<SignalIntelligencePanelProps> = ({
  coins,
  watchlistSymbols,
  onToggleWatchlist,
  onSelectCoin,
  onRefresh,
  isRefreshing = false
}) => {
  const [selectedSignal, setSelectedSignal] = useState<MarketSignal | null>(null);
  const [filterType, setFilterType] = useState<SignalFilterType>('ALL');
  const [sortField, setSortField] = useState<SignalSortField>('strength');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExchange, setSelectedExchange] = useState<string>('ALL');

  // Filter & Sort Logic based on real backend data
  const filteredCoins = useMemo(() => {
    let result = coins.filter(c => Boolean(c.signal));

    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase().trim();
      result = result.filter(c => c.symbol.includes(q) || c.baseAsset.includes(q));
    }

    if (selectedExchange !== 'ALL') {
      result = result.filter(c => c.exchange === selectedExchange);
    }

    // Apply Filter Criteria
    switch (filterType) {
      case 'BULLISH_ONLY':
        result = result.filter(c => c.signal?.direction === 'BULLISH');
        break;
      case 'BEARISH_ONLY':
        result = result.filter(c => c.signal?.direction === 'BEARISH');
        break;
      case 'CONFIRMED_ONLY':
        result = result.filter(c => c.signal?.status === 'CONFIRMED');
        break;
      case 'ACTIVE_ONLY':
        result = result.filter(
          c => c.signal?.status === 'ACTIVE' || c.signal?.status === 'CONFIRMED'
        );
        break;
      case 'STRONG_CONFLUENCE_ONLY':
        result = result.filter(
          c =>
            (c.signal?.multiTimeframeSummary?.isConfluent ?? false) ||
            (c.signal?.multiTimeframeSummary?.alignmentScore ?? 0) >= 65
        );
        break;
      case 'BREAKOUT_ONLY':
        result = result.filter(
          c =>
            c.signal?.signalType === 'BULLISH_BREAKOUT' ||
            c.signal?.breakoutContext?.state === 'BREAKOUT CONFIRMED'
        );
        break;
      case 'BREAKDOWN_ONLY':
        result = result.filter(c => c.signal?.signalType === 'BEARISH_BREAKDOWN');
        break;
      case 'REVERSAL_ONLY':
        result = result.filter(
          c =>
            c.signal?.signalType === 'BULLISH_REVERSAL' ||
            c.signal?.signalType === 'BEARISH_REVERSAL'
        );
        break;
      case 'CONTINUATION_ONLY':
        result = result.filter(
          c =>
            c.signal?.signalType === 'BULLISH_CONTINUATION' ||
            c.signal?.signalType === 'BEARISH_CONTINUATION'
        );
        break;
    }

    // Sort order
    const mult = sortOrder === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const sigA = a.signal;
      const sigB = b.signal;

      if (sortField === 'strength') {
        return ((sigA?.strength ?? 0) - (sigB?.strength ?? 0)) * mult;
      }
      if (sortField === 'bullScore') {
        return (a.scores.bullScore - b.scores.bullScore) * mult;
      }
      if (sortField === 'downsideRisk') {
        return (a.scores.downsideRiskScore - b.scores.downsideRiskScore) * mult;
      }
      if (sortField === 'mtfConfluence') {
        return (
          ((sigA?.multiTimeframeSummary?.alignmentScore ?? 0) -
            (sigB?.multiTimeframeSummary?.alignmentScore ?? 0)) *
          mult
        );
      }
      if (sortField === 'volume') {
        return (a.indicators.volumeAnalysis.ratio - b.indicators.volumeAnalysis.ratio) * mult;
      }
      if (sortField === 'oiChange') {
        const oiA = a.derivatives?.openInterestChange24h ?? 0;
        const oiB = b.derivatives?.openInterestChange24h ?? 0;
        return (oiA - oiB) * mult;
      }
      if (sortField === 'funding') {
        const fA = a.derivatives?.fundingRate ?? 0;
        const fB = b.derivatives?.fundingRate ?? 0;
        return (fA - fB) * mult;
      }
      if (sortField === 'rsi') {
        return (a.indicators.rsi14 - b.indicators.rsi14) * mult;
      }
      if (sortField === 'change24h') {
        return (a.change24h - b.change24h) * mult;
      }
      return ((sigA?.strength ?? 0) - (sigB?.strength ?? 0)) * mult;
    });

    return result;
  }, [coins, searchQuery, selectedExchange, filterType, sortField, sortOrder]);

  // MTF Arrow helper
  const renderMtfIndicator = (bias: string | undefined) => {
    const b = (bias || '').toUpperCase();
    if (b.includes('BULL')) {
      return <span className="text-emerald-400 font-bold inline-flex items-center">↑</span>;
    }
    if (b.includes('BEAR')) {
      return <span className="text-rose-400 font-bold inline-flex items-center">↓</span>;
    }
    return <span className="text-slate-500 font-bold inline-flex items-center">→</span>;
  };

  const getSignalBadgeColor = (type: SignalType, dir: SignalDirection) => {
    if (dir === 'BULLISH') {
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50';
    }
    if (dir === 'BEARISH') {
      return 'bg-rose-950/80 text-rose-300 border-rose-600/50';
    }
    return 'bg-slate-800/80 text-slate-300 border-slate-600/50';
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Overview & Filter Bar */}
      <div className="bg-[#0b121f] border border-[#1d2940] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h1 className="text-base font-bold text-white tracking-wider">
                SIGNAL INTELLIGENCE ENGINE
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/50 font-bold">
                MULTI-TIMEFRAME CONFLUENCE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic, exchange-isolated market signals evaluated with strict non-lookahead bias.
            </p>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-lg bg-[#141e33] hover:bg-[#1a2845] text-slate-300 border border-[#233352] text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>REFRESH</span>
            </button>
          )}
        </div>

        {/* Filter Pills & Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#182338]">
          <div className="relative w-44 flex-shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search pair..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 bg-[#101726] border border-[#22314d] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Exchange Filter */}
          <select
            value={selectedExchange}
            onChange={e => setSelectedExchange(e.target.value)}
            className="px-2.5 py-1.5 bg-[#101726] border border-[#22314d] rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Exchanges</option>
            <option value="BINANCE">Binance</option>
            <option value="BYBIT">Bybit</option>
            <option value="OKX">OKX</option>
            <option value="PIONEX">Pionex</option>
          </select>

          {/* Quick Filter Buttons */}
          {(
            [
              ['ALL', 'All Signals'],
              ['BULLISH_ONLY', 'Bullish Only'],
              ['BEARISH_ONLY', 'Bearish Only'],
              ['CONFIRMED_ONLY', 'Confirmed Only'],
              ['STRONG_CONFLUENCE_ONLY', 'Strong Confluence'],
              ['BREAKOUT_ONLY', 'Breakouts'],
              ['BREAKDOWN_ONLY', 'Breakdowns'],
              ['REVERSAL_ONLY', 'Reversals'],
              ['CONTINUATION_ONLY', 'Continuations']
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterType(val)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === val
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-[#101726] text-slate-400 hover:text-slate-200 border border-[#22314d]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort Controls */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
          <div className="flex items-center space-x-2">
            <span>Sort by:</span>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value as SignalSortField)}
              className="px-2 py-1 bg-[#101726] border border-[#22314d] rounded text-slate-200 focus:outline-none"
            >
              <option value="strength">Signal Strength</option>
              <option value="bullScore">Bull Score</option>
              <option value="downsideRisk">Downside Risk</option>
              <option value="mtfConfluence">Multi-Timeframe Confluence</option>
              <option value="volume">Volume Surge (Ratio)</option>
              <option value="oiChange">Open Interest Change</option>
              <option value="funding">Funding Rate</option>
              <option value="rsi">RSI Momentum</option>
              <option value="change24h">24H Price Change</option>
            </select>

            <button
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              className="px-2 py-1 bg-[#101726] border border-[#22314d] rounded text-slate-200 hover:text-white"
            >
              {sortOrder === 'desc' ? 'High → Low ↓' : 'Low → High ↑'}
            </button>
          </div>

          <div>
            Showing <strong className="text-white">{filteredCoins.length}</strong> of{' '}
            <strong className="text-slate-300">{coins.length}</strong> evaluated market signals
          </div>
        </div>
      </div>

      {/* Main Signal Table (Section 31) */}
      <div className="bg-[#0c121e] border border-[#1d2940] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#080d16] border-b border-[#182338] text-slate-400 uppercase text-[10px] tracking-wider select-none">
                <th className="py-3 px-3 w-8 text-center">★</th>
                <th className="py-3 px-3">Symbol</th>
                <th className="py-3 px-3">Exchange</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">24H %</th>
                <th className="py-3 px-3 text-left">Signal</th>
                <th className="py-3 px-3 text-center">Strength</th>
                <th className="py-3 px-3 text-center">MTF Confluence</th>
                <th className="py-3 px-3 text-center">Structure</th>
                <th className="py-3 px-3 text-center">Volume</th>
                <th className="py-3 px-3 text-center">OI</th>
                <th className="py-3 px-3 text-center">Funding</th>
                <th className="py-3 px-3 text-center">Risk</th>
                <th className="py-3 px-3 text-right">Updated</th>
                <th className="py-3 px-2 w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131d2e] tabular-nums">
              {filteredCoins.map(coin => {
                const isSaved = watchlistSymbols.includes(coin.symbol);
                const sig = coin.signal;
                const changeIsPos = coin.change24h >= 0;
                const mtf = sig?.multiTimeframeSummary;
                const struct = coin.marketStructure;
                const deriv = coin.derivatives;

                const formattedPrice =
                  coin.price < 0.001
                    ? coin.price.toFixed(6)
                    : coin.price < 1
                    ? coin.price.toFixed(4)
                    : coin.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      });

                return (
                  <tr
                    key={coin.id || coin.symbol}
                    onClick={() => {
                      if (sig) setSelectedSignal(sig);
                      else onSelectCoin(coin);
                    }}
                    className="hover:bg-[#111928] cursor-pointer transition-colors group"
                  >
                    {/* Watchlist */}
                    <td
                      className="py-2.5 px-3 text-center"
                      onClick={e => {
                        e.stopPropagation();
                        onToggleWatchlist(coin.symbol);
                      }}
                    >
                      <WatchlistButton
                        isSaved={isSaved}
                        onToggle={() => onToggleWatchlist(coin.symbol)}
                      />
                    </td>

                    {/* Symbol */}
                    <td className="py-2.5 px-3 font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {coin.symbol}
                    </td>

                    {/* Exchange */}
                    <td className="py-2.5 px-3">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-[#141e33] text-cyan-300 border border-[#22314d]">
                        {coin.exchange}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      ${formattedPrice}
                    </td>

                    {/* 24H % */}
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        changeIsPos ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {changeIsPos ? '+' : ''}
                      {coin.change24h.toFixed(2)}%
                    </td>

                    {/* Signal */}
                    <td className="py-2.5 px-3 text-left">
                      {sig ? (
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSignalBadgeColor(
                              sig.signalType,
                              sig.direction
                            )}`}
                          >
                            {sig.signalType.replace('_', ' ')}
                          </span>
                          {sig.status === 'CONFIRMED' && (
                            <span className="text-[9px] text-cyan-400 font-bold" title="Candle Close Confirmed">
                              ●
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">NEUTRAL</span>
                      )}
                    </td>

                    {/* Strength */}
                    <td className="py-2.5 px-3 text-center font-bold">
                      {sig ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            sig.strength >= 75
                              ? 'text-emerald-400 font-bold'
                              : sig.strength >= 60
                              ? 'text-cyan-400 font-bold'
                              : sig.strength >= 45
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {sig.strength}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* MTF Confluence (5m ↑ 15m ↑ 1h ↑ 4h ↑ 1D →) */}
                    <td className="py-2.5 px-3 text-center">
                      {mtf ? (
                        <div
                          className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#080d16] border border-[#1b263b] text-[10px]"
                          title={mtf.summaryText}
                        >
                          {(['5m', '15m', '1h', '4h', '1D'] as const).map(tf => {
                            const b =
                              mtf.timeframes?.[tf]?.bias ||
                              (mtf.bullishTimeframes.includes(tf)
                                ? 'Bullish'
                                : mtf.bearishTimeframes.includes(tf)
                                ? 'Bearish'
                                : 'Neutral');
                            return (
                              <span key={tf} title={tf}>
                                {renderMtfIndicator(b)}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">--</span>
                      )}
                    </td>

                    {/* Structure */}
                    <td className="py-2.5 px-3 text-center text-[10px]">
                      <span className="text-slate-300">
                        {struct?.state || 'Consolidation'}
                      </span>
                    </td>

                    {/* Volume */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-[11px] ${
                          coin.indicators.volumeAnalysis.ratio >= 2.0
                            ? 'text-cyan-300 font-bold'
                            : coin.indicators.volumeAnalysis.ratio >= 1.2
                            ? 'text-emerald-400 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {coin.indicators.volumeAnalysis.ratio.toFixed(1)}x
                      </span>
                    </td>

                    {/* OI */}
                    <td className="py-2.5 px-3 text-center text-[11px]">
                      {deriv && deriv.openInterestChange24h !== null ? (
                        <span
                          className={
                            deriv.openInterestChange24h > 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }
                        >
                          {deriv.openInterestChange24h > 0 ? '+' : ''}
                          {deriv.openInterestChange24h.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">N/A</span>
                      )}
                    </td>

                    {/* Funding */}
                    <td className="py-2.5 px-3 text-center text-[11px]">
                      {deriv && deriv.fundingRate !== null ? (
                        <span
                          className={
                            deriv.fundingRate > 0.0003
                              ? 'text-amber-400'
                              : deriv.fundingRate < 0
                              ? 'text-cyan-400'
                              : 'text-slate-300'
                          }
                        >
                          {(deriv.fundingRate * 100).toFixed(4)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">N/A</span>
                      )}
                    </td>

                    {/* Risk */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-xs font-bold ${
                          coin.scores.downsideRiskScore >= 70
                            ? 'text-rose-400'
                            : coin.scores.downsideRiskScore >= 50
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {coin.scores.downsideRiskScore}
                      </span>
                    </td>

                    {/* Updated Age */}
                    <td className="py-2.5 px-3 text-right">
                      <DataFreshness
                        seconds={coin.freshnessSeconds}
                        status={coin.dataStatus}
                      />
                    </td>

                    {/* Arrow */}
                    <td className="py-2.5 px-2 text-slate-600 group-hover:text-cyan-400 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                );
              })}
              {filteredCoins.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No signals match the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signal Detail Modal / Drawer (Section 32) */}
      {selectedSignal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b121f] border border-[#1f2c45] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto font-mono text-xs shadow-2xl space-y-4 p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1c2a42] pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-white">
                    {selectedSignal.symbol}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#162238] text-cyan-300 font-bold">
                    {selectedSignal.exchange}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSignalBadgeColor(
                      selectedSignal.signalType,
                      selectedSignal.direction
                    )}`}
                  >
                    {selectedSignal.signalType}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Lifecycle Status: <strong className="text-white">{selectedSignal.status}</strong> •
                  Confidence: <strong className="text-amber-400">{selectedSignal.confidence}/100</strong> •
                  Engine {selectedSignal.modelVersion || selectedSignal.engineVersion || 'v1.0.0'}
                </div>
              </div>

              <button
                onClick={() => setSelectedSignal(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Strength & Invalidation Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-[#080d16] border border-[#172236] rounded-xl space-y-1">
                <div className="text-[10px] uppercase text-slate-400">Signal Strength</div>
                <div className="text-xl font-bold text-emerald-400">
                  {selectedSignal.strength} <span className="text-xs text-slate-400">/ 100</span>
                </div>
              </div>

              <div className="p-3 bg-[#080d16] border border-[#172236] rounded-xl space-y-1">
                <div className="text-[10px] uppercase text-slate-400">Trigger Price</div>
                <div className="text-xl font-bold text-white">
                  ${(selectedSignal.triggerPrice ?? 0).toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-[#080d16] border border-[#172236] rounded-xl space-y-1">
                <div className="text-[10px] uppercase text-slate-400">Invalidation Price</div>
                <div className="text-xl font-bold text-rose-400">
                  {selectedSignal.invalidationPrice
                    ? `$${selectedSignal.invalidationPrice.toLocaleString()}`
                    : 'Dynamic'}
                </div>
              </div>

              <div className="p-3 bg-[#080d16] border border-[#172236] rounded-xl space-y-1">
                <div className="text-[10px] uppercase text-slate-400">Downside Risk</div>
                <div className="text-xl font-bold text-amber-400">
                  {selectedSignal.downsideRiskStrength} <span className="text-xs text-slate-400">/ 100</span>
                </div>
              </div>
            </div>

            {/* Invalidation Reason */}
            {selectedSignal.invalidationReason && (
              <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-[11px] flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-rose-200">Invalidation Condition:</strong>{' '}
                  {selectedSignal.invalidationReason}
                </div>
              </div>
            )}

            {/* Multi-Timeframe Alignment */}
            <div className="p-4 bg-[#080d16] border border-[#172236] rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-white">
                <span className="flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>MULTI-TIMEFRAME ALIGNMENT</span>
                </span>
                <span className="text-purple-300">
                  Alignment Score: {selectedSignal.multiTimeframeSummary.alignmentScore}/100
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2 text-center text-[11px] pt-1">
                {(['5m', '15m', '1h', '4h', '1D'] as const).map(tf => {
                  const data =
                    selectedSignal.multiTimeframeSummary.timeframes?.[tf] ||
                    selectedSignal.timeframeAnalysis?.[tf];
                  const bias =
                    data?.bias ||
                    (selectedSignal.multiTimeframeSummary.bullishTimeframes.includes(tf)
                      ? 'BULLISH'
                      : selectedSignal.multiTimeframeSummary.bearishTimeframes.includes(tf)
                      ? 'BEARISH'
                      : 'NEUTRAL');
                  return (
                    <div
                      key={tf}
                      className="p-2 rounded-lg bg-[#0e1626] border border-[#1d2b45] space-y-1"
                    >
                      <div className="font-bold text-white">{tf}</div>
                      <div className="text-sm">{renderMtfIndicator(bias)}</div>
                      <div
                        className={`text-[9px] font-semibold ${
                          (bias || '').toUpperCase().includes('BULL')
                            ? 'text-emerald-400'
                            : (bias || '').toUpperCase().includes('BEAR')
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {bias}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-400 pt-1">
                {selectedSignal.multiTimeframeSummary.summaryText}
              </div>
            </div>

            {/* Supporting & Conflicting Evidence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supporting Factors */}
              <div className="p-4 bg-[#080d16] border border-emerald-900/40 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-emerald-400 uppercase flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Supporting Evidence</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300">
                  {selectedSignal.supportingFactors.map((f, i) => (
                    <div key={i} className="flex items-start space-x-1.5">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                  {selectedSignal.supportingFactors.length === 0 && (
                    <div className="text-slate-500">No strong bullish factors identified.</div>
                  )}
                </div>
              </div>

              {/* Conflicting Factors */}
              <div className="p-4 bg-[#080d16] border border-amber-900/40 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-amber-400 uppercase flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Conflicting Evidence / Risks</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-400">
                  {selectedSignal.conflictingFactors.map((c, i) => (
                    <div key={i} className="flex items-start space-x-1.5">
                      <span className="text-amber-400 font-bold">⚠</span>
                      <span>{c}</span>
                    </div>
                  ))}
                  {selectedSignal.conflictingFactors.length === 0 && (
                    <div className="text-slate-500">No major conflicting signals detected.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Macro Bitcoin Context & Derivatives Footer */}
            <div className="p-3 bg-[#080d16] border border-[#172236] rounded-xl flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
              <div>
                BTC Macro Context:{' '}
                <strong
                  className={
                    selectedSignal.btcContext?.contextEffect === 'SUPPORTIVE'
                      ? 'text-emerald-400'
                      : selectedSignal.btcContext?.contextEffect === 'HEADWIND'
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }
                >
                  {selectedSignal.btcContext?.contextEffect || 'NEUTRAL'}
                </strong>{' '}
                ({selectedSignal.btcContext?.description || 'Aligned market regime'})
              </div>
              <div>
                Exchange Feed:{' '}
                <strong className="text-white">
                  {selectedSignal.exchange} ({selectedSignal.marketType})
                </strong>{' '}
                • Updated {Math.max(1, Math.round((Date.now() - selectedSignal.timestamp) / 1000))}s ago
              </div>
            </div>

            {/* Action button */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setSelectedSignal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const targetCoin = coins.find(
                    c => c.symbol === selectedSignal.symbol && c.exchange === selectedSignal.exchange
                  );
                  if (targetCoin) {
                    onSelectCoin(targetCoin);
                  }
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold flex items-center space-x-1.5 shadow-lg shadow-cyan-900/30"
              >
                <span>OPEN COIN CHART</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
