import {
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Clock,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Lock,
  Info
} from 'lucide-react';
import React from 'react';
import { DataFreshness, RiskBadge, ScoreBadge, SignalBadge, WatchlistButton } from './Badges';
import { NormalizedCoinData } from '../types';

interface ScannerTableProps {
  coins: NormalizedCoinData[];
  watchlistSymbols: string[];
  onToggleWatchlist: (symbol: string) => void;
  onSelectCoin: (coin: NormalizedCoinData) => void;
  isLoading?: boolean;
  onOpenUpgrade?: (context?: string) => void;
  onOpenExplanation?: (coin: NormalizedCoinData) => void;
}

export const ScannerTable: React.FC<ScannerTableProps> = React.memo(({
  coins,
  watchlistSymbols,
  onToggleWatchlist,
  onSelectCoin,
  isLoading = false,
  onOpenUpgrade,
  onOpenExplanation
}) => {
  const [pageSize, setPageSize] = React.useState<number | 'ALL'>(50);
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [expandedMobileCoins, setExpandedMobileCoins] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedMobileCoins(prev => ({ ...prev, [id]: !prev[id] }));
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [coins.length]);

  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(coins.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const displayedCoins = React.useMemo(() => {
    if (pageSize === 'ALL') return coins;
    const start = (safePage - 1) * pageSize;
    return coins.slice(start, start + pageSize);
  }, [coins, pageSize, safePage]);

  if (isLoading) {
    return (
      <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
        Fetching live multi-indicator market stream...
      </div>
    );
  }

  if (coins.length === 0) {
    return (
      <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-12 text-center text-slate-400 font-mono text-xs space-y-2">
        <div className="text-slate-200 font-bold text-sm">No pairs match your current scanner filter</div>
        <p className="text-slate-500 text-xs">Try resetting or loosening filters to inspect more markets.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0c121e] border border-[#1d2940] rounded-2xl shadow-xl overflow-hidden">
      {/* Desktop High-Density Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-[#080d16] border-b border-[#182338] text-slate-400 uppercase text-[10px] tracking-wider select-none">
              <th className="py-3 px-3 w-8 text-center">★</th>
              <th className="py-3 px-3">Trading Pair</th>
              <th className="py-3 px-3 text-right">Price</th>
              <th className="py-3 px-3 text-right">24h Change</th>
              <th className="py-3 px-3 text-left">Signal</th>
              <th className="py-3 px-3 text-center">Strength</th>
              <th className="py-3 px-3 text-center">MTF</th>
              <th className="py-3 px-3 text-center">Vol Ratio</th>
              <th className="py-3 px-3 text-center">RSI</th>
              <th className="py-3 px-3 text-center">Bull Score</th>
              <th className="py-3 px-3 text-center">Downside Risk</th>
              <th className="py-3 px-3 text-right">Data Age</th>
              <th className="py-3 px-2 w-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#131d2e] tabular-nums">
            {displayedCoins.map((coin, index) => {
              const isSaved = watchlistSymbols.includes(coin.symbol);
              const changeIsPos = coin.change24h >= 0;
              const rsi = coin.indicators.rsi14;

              // RSI color
              let rsiColor = 'text-slate-300';
              if (rsi >= 70) rsiColor = 'text-amber-400 font-bold';
              else if (rsi <= 35) rsiColor = 'text-cyan-400 font-bold';
              else if (rsi >= 50 && rsi < 70) rsiColor = 'text-emerald-400';

              // Format price with appropriate decimals
              const formattedPrice =
                coin.price < 0.001
                  ? coin.price.toFixed(6)
                  : coin.price < 1
                  ? coin.price.toFixed(4)
                  : coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              const volDisplay =
                coin.quoteVolume24h >= 1e9
                  ? `$${(coin.quoteVolume24h / 1e9).toFixed(2)}B`
                  : coin.quoteVolume24h >= 1e6
                  ? `$${(coin.quoteVolume24h / 1e6).toFixed(1)}M`
                  : `$${(coin.quoteVolume24h / 1e3).toFixed(0)}K`;

              return (
                <tr
                  key={coin.id || coin.symbol}
                  onClick={() => onSelectCoin(coin)}
                  className="hover:bg-[#111928] cursor-pointer transition-colors group"
                >
                  {/* Star */}
                  <td className="py-2.5 px-3 text-center">
                    <WatchlistButton isSaved={isSaved} onToggle={() => onToggleWatchlist(coin.symbol)} />
                  </td>

                  {/* Pair */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {coin.symbol}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        coin.exchange === 'OKX'
                          ? 'bg-blue-950/80 text-blue-300 border border-blue-500/30'
                          : coin.exchange === 'PIONEX'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          : coin.exchange === 'BYBIT'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                          : 'bg-yellow-950/80 text-yellow-300 border border-yellow-500/30'
                      }`}>
                        {coin.exchange}
                      </span>
                      {coin.crossExchangeMarkets && coin.crossExchangeMarkets.length > 1 && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 font-semibold"
                          title={`Cross-Exchange Listed: ${coin.crossExchangeMarkets.map(m => m.exchange).join(', ')}`}
                        >
                          {coin.crossExchangeMarkets.length} EX
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    ${formattedPrice}
                  </td>

                  {/* 24h Change */}
                  <td className={`py-2.5 px-3 text-right font-bold ${changeIsPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {changeIsPos ? '+' : ''}
                    {coin.change24h.toFixed(2)}%
                  </td>

                  {/* Signal */}
                  <td className="py-2.5 px-3 text-left">
                    {coin.isLocked ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (onOpenUpgrade) onOpenUpgrade('Scanner PRO Intelligence');
                          else onSelectCoin(coin);
                        }}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-600/40 transition-all active:scale-95 cursor-pointer"
                        title="PRO Intelligence Locked. Click to upgrade."
                      >
                        <Lock className="w-2.5 h-2.5" />
                        <span>PRO INTELLIGENCE</span>
                      </button>
                    ) : coin.signal ? (
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            coin.signal.direction === 'BULLISH'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                              : coin.signal.direction === 'BEARISH'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-600/40'
                              : 'bg-slate-800 text-slate-300 border-slate-600/40'
                          }`}
                        >
                          {coin.signal.signalType.replace('_', ' ')}
                        </span>
                        {onOpenExplanation && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenExplanation(coin);
                            }}
                            className="p-1 rounded bg-[#131d2e] hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 border border-[#1e2a40] transition-colors"
                            title="Why This Signal? View mathematical evidence & provenance"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <SignalBadge signal={coin.scores.signal} />
                    )}
                  </td>

                  {/* Strength */}
                  <td className="py-2.5 px-3 text-center font-bold">
                    {coin.isLocked ? (
                      <span className="text-slate-500 font-mono tracking-widest text-xs">••</span>
                    ) : coin.signal ? (
                      <span
                        className={`text-xs ${
                          coin.signal.strength >= 70
                            ? 'text-emerald-400'
                            : coin.signal.strength >= 50
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {coin.signal.strength}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  {/* MTF Confluence */}
                  <td className="py-2.5 px-3 text-center">
                    {coin.isLocked ? (
                      <span className="text-slate-500 font-mono tracking-widest text-[10px]">••••••</span>
                    ) : coin.signal?.multiTimeframeSummary ? (
                      <div
                        className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#080d16] border border-[#1b263b] text-[10px]"
                        title={coin.signal.multiTimeframeSummary.summaryText}
                      >
                        {(['5m', '15m', '1h', '4h', '1D'] as const).map(tf => {
                          const tfBias =
                            coin.signal?.multiTimeframeSummary?.timeframes?.[tf]?.bias ||
                            coin.signal?.timeframeAnalysis?.[tf]?.bias ||
                            (coin.signal?.multiTimeframeSummary?.bullishTimeframes.includes(tf)
                              ? 'BULLISH'
                              : coin.signal?.multiTimeframeSummary?.bearishTimeframes.includes(tf)
                              ? 'BEARISH'
                              : 'NEUTRAL');
                          return (
                            <span
                              key={tf}
                              title={tf}
                              className={
                                tfBias === 'BULLISH'
                                  ? 'text-emerald-400'
                                  : tfBias === 'BEARISH'
                                  ? 'text-rose-400'
                                  : 'text-slate-500'
                              }
                            >
                              {tfBias === 'BULLISH' ? '↑' : tfBias === 'BEARISH' ? '↓' : '→'}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[10px]">--</span>
                    )}
                  </td>

                  {/* Vol Ratio vs 20MA */}
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] ${
                        coin.indicators.volumeAnalysis.ratio >= 2.0
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold'
                          : coin.indicators.volumeAnalysis.ratio >= 1.2
                          ? 'text-emerald-400 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {coin.indicators.volumeAnalysis.ratio.toFixed(2)}x
                    </span>
                  </td>

                  {/* RSI 14 */}
                  <td className={`py-2.5 px-3 text-center ${rsiColor}`}>
                    {rsi}
                  </td>

                  {/* Bull Score */}
                  <td className="py-2.5 px-3 text-center">
                    {coin.isLocked || coin.scores.bullScore < 0 ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (onOpenUpgrade) onOpenUpgrade('Scanner Bull Score');
                          else onSelectCoin(coin);
                        }}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#0c121e] hover:bg-amber-950/40 text-amber-400 border border-amber-500/40 transition-all active:scale-95 cursor-pointer"
                        title="PRO Bull Score Locked. Click to upgrade."
                      >
                        <Lock className="w-2.5 h-2.5" />
                        <span>PRO</span>
                      </button>
                    ) : (
                      <ScoreBadge score={coin.scores.bullScore} classification={coin.scores.bullClassification} />
                    )}
                  </td>

                  {/* Downside Risk */}
                  <td className="py-2.5 px-3 text-center">
                    {coin.isLocked || coin.scores.downsideRiskScore < 0 ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#0c121e] text-slate-400 border border-slate-700">
                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                        <span>PRO</span>
                      </span>
                    ) : (
                      <RiskBadge score={coin.scores.downsideRiskScore} classification={coin.scores.downsideRiskClassification} />
                    )}
                  </td>

                  {/* Freshness */}
                  <td className="py-2.5 px-3 text-right">
                    <DataFreshness seconds={coin.freshnessSeconds} status={coin.dataStatus} />
                  </td>

                  {/* Open arrow */}
                  <td className="py-2.5 px-2 text-slate-600 group-hover:text-cyan-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout (Fallback for screens < lg) */}
      <div className="block lg:hidden divide-y divide-[#162033] font-mono">
        {displayedCoins.map((coin) => {
          const isSaved = watchlistSymbols.includes(coin.symbol);
          const changeIsPos = coin.change24h >= 0;

          const formattedPrice =
            coin.price < 0.001
              ? coin.price.toFixed(6)
              : coin.price < 1
              ? coin.price.toFixed(4)
              : coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

          return (
            <div
              key={coin.id || coin.symbol}
              onClick={() => onSelectCoin(coin)}
              className="p-3.5 hover:bg-[#111928] cursor-pointer space-y-2.5 transition-colors"
            >
              {/* Row 1: Pair + Watchlist + Price & Change */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <WatchlistButton isSaved={isSaved} onToggle={() => onToggleWatchlist(coin.symbol)} />
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-white text-sm">{coin.symbol}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded font-bold uppercase bg-[#182338] text-cyan-300">
                        {coin.exchange}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {coin.exchange} • {coin.marketType}
                      {coin.crossExchangeMarkets && coin.crossExchangeMarkets.length > 1 && ` • ${coin.crossExchangeMarkets.length} Exchanges`}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-white text-sm">${formattedPrice}</div>
                  <div className={`text-xs font-semibold ${changeIsPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {changeIsPos ? '+' : ''}{coin.change24h.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Row 2: Scores & Signal */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#131d2e] items-center text-center">
                <div>
                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">Bull Score</div>
                  {coin.isLocked || coin.scores.bullScore < 0 ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (onOpenUpgrade) onOpenUpgrade('Scanner Bull Score');
                        else onSelectCoin(coin);
                      }}
                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0c121e] text-amber-400 border border-amber-500/40"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>PRO</span>
                    </button>
                  ) : (
                    <ScoreBadge score={coin.scores.bullScore} compact />
                  )}
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">Downside Risk</div>
                  {coin.isLocked || coin.scores.downsideRiskScore < 0 ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (onOpenUpgrade) onOpenUpgrade('Scanner Risk Intelligence');
                        else onSelectCoin(coin);
                      }}
                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0c121e] text-slate-400 border border-slate-700"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>PRO</span>
                    </button>
                  ) : (
                    <RiskBadge score={coin.scores.downsideRiskScore} compact />
                  )}
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">
                    {coin.isLocked ? 'Signal' : coin.signal ? `Signal (${coin.signal.strength})` : 'Signal'}
                  </div>
                  {coin.isLocked ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (onOpenUpgrade) onOpenUpgrade('Scanner PRO Intelligence');
                        else onSelectCoin(coin);
                      }}
                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0c121e] text-amber-400 border border-amber-500/40"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>PRO</span>
                    </button>
                  ) : coin.signal ? (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        coin.signal.direction === 'BULLISH'
                          ? 'bg-emerald-950 text-emerald-300'
                          : coin.signal.direction === 'BEARISH'
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {coin.signal.signalType.replace('_', ' ')}
                    </span>
                  ) : (
                    <SignalBadge signal={coin.scores.signal} />
                  )}
                </div>
              </div>

              {/* Row 3: Freshness & Collapsible Details Toggle (Phase 23 Section J) */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <DataFreshness seconds={coin.freshnessSeconds} status={coin.dataStatus} />
                <button
                  type="button"
                  onClick={e => toggleExpand(coin.id || coin.symbol, e)}
                  className="px-2 py-1 rounded bg-[#101726] hover:bg-[#182338] border border-[#1d2b42] text-[10px] text-cyan-400 font-bold flex items-center gap-1 transition-all"
                >
                  <span>{expandedMobileCoins[coin.id || coin.symbol] ? 'Less' : 'Details'}</span>
                  {expandedMobileCoins[coin.id || coin.symbol] ? (
                    <ChevronDown className="w-3 h-3 rotate-180 transition-transform" />
                  ) : (
                    <ChevronDown className="w-3 h-3 transition-transform" />
                  )}
                </button>
              </div>

              {/* Collapsed Secondary Metrics (Phase 23 Section J) */}
              {expandedMobileCoins[coin.id || coin.symbol] && (
                <div className="p-2.5 rounded-xl bg-[#090e18] border border-[#1a253a] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono animate-in fade-in duration-150">
                  <div className="flex justify-between items-center bg-[#0d1424] p-1.5 rounded">
                    <span className="text-slate-500">RSI 14</span>
                    <strong className="text-white">{coin.indicators.rsi14}</strong>
                  </div>
                  <div className="flex justify-between items-center bg-[#0d1424] p-1.5 rounded">
                    <span className="text-slate-500">Volume</span>
                    <strong className="text-cyan-400">{coin.indicators.volumeAnalysis.ratio.toFixed(2)}x</strong>
                  </div>
                  <div className="flex justify-between items-center bg-[#0d1424] p-1.5 rounded">
                    <span className="text-slate-500">Open Int</span>
                    <strong className="text-slate-300">
                      {coin.derivatives?.openInterestUsd
                        ? `$${(coin.derivatives.openInterestUsd / 1e6).toFixed(1)}M`
                        : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center bg-[#0d1424] p-1.5 rounded">
                    <span className="text-slate-500">Funding</span>
                    <strong className="text-slate-300">
                      {coin.derivatives?.fundingRate !== undefined && coin.derivatives?.fundingRate !== null
                        ? `${(coin.derivatives.fundingRate * 100).toFixed(4)}%`
                        : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center bg-[#0d1424] p-1.5 rounded">
                    <span className="text-slate-500">Structure</span>
                    <strong className="text-amber-400 truncate max-w-[80px]">
                      {coin.marketStructure?.state || 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center bg-[#0d1424] p-1.5 rounded">
                    <span className="text-slate-500">Whale Intel</span>
                    <strong className="text-cyan-300">
                      {coin.externalIntelligence?.whaleActivityScore !== undefined
                        ? `${coin.externalIntelligence.whaleActivityScore}/100`
                        : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center bg-[#0d1424] p-1.5 rounded col-span-2 sm:col-span-2">
                    <span className="text-slate-500">DEX Pressure</span>
                    <strong className="text-emerald-400">
                      {coin.externalIntelligence?.dexActivityScore !== undefined
                        ? `${coin.externalIntelligence.dexActivityScore}/100 (${coin.externalIntelligence.flowRegime?.replace('_', ' ') || 'ACTIVE'})`
                        : 'N/A'}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase 19: Scanner Pagination & Windowing Controls */}
      {coins.length > 25 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#080d16] border-t border-[#182338] text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <span>
              Showing {pageSize === 'ALL' ? `1–${coins.length}` : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, coins.length)}`} of {coins.length} pairs
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 text-[11px]">Rows:</span>
              {([25, 50, 100, 'ALL'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => { setPageSize(size); setCurrentPage(1); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    pageSize === size ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-[#101726] text-slate-400 hover:text-slate-200 border border-[#1b253b]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            {pageSize !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-2.5 py-1 rounded bg-[#101726] hover:bg-[#182338] disabled:opacity-40 disabled:pointer-events-none border border-[#1b253b] text-slate-300 font-mono text-xs cursor-pointer"
                >
                  Prev
                </button>
                <span className="px-2 text-slate-400 text-xs">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-2.5 py-1 rounded bg-[#101726] hover:bg-[#182338] disabled:opacity-40 disabled:pointer-events-none border border-[#1b253b] text-slate-300 font-mono text-xs cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

ScannerTable.displayName = 'ScannerTable';
