import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp
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
}

export const ScannerTable: React.FC<ScannerTableProps> = ({
  coins,
  watchlistSymbols,
  onToggleWatchlist,
  onSelectCoin,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
        Fetching live multi-indicator stream from Binance...
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
              <th className="py-3 px-3 text-right">24h Vol</th>
              <th className="py-3 px-3 text-center">Vol Ratio</th>
              <th className="py-3 px-3 text-center">RSI (14)</th>
              <th className="py-3 px-3 text-center">MA Alignment</th>
              <th className="py-3 px-3 text-center">Bull Score</th>
              <th className="py-3 px-3 text-center">Downside Risk</th>
              <th className="py-3 px-3 text-center">Signal</th>
              <th className="py-3 px-3 text-right">Data Age</th>
              <th className="py-3 px-2 w-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#131d2e] tabular-nums">
            {coins.map((coin, index) => {
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

                  {/* 24h Volume */}
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {volDisplay}
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

                  {/* MA Alignment */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="inline-flex items-center space-x-1 text-[10px]">
                      <span
                        title="Price vs MA20"
                        className={`px-1 rounded ${coin.indicators.priceVsMa20 === 'above' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}
                      >
                        20
                      </span>
                      <span
                        title="Price vs MA50"
                        className={`px-1 rounded ${coin.indicators.priceVsMa50 === 'above' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}
                      >
                        50
                      </span>
                      <span
                        title="Price vs MA200"
                        className={`px-1 rounded ${coin.indicators.priceVsMa200 === 'above' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}
                      >
                        200
                      </span>
                    </div>
                  </td>

                  {/* Bull Score */}
                  <td className="py-2.5 px-3 text-center">
                    <ScoreBadge score={coin.scores.bullScore} classification={coin.scores.bullClassification} />
                  </td>

                  {/* Downside Risk */}
                  <td className="py-2.5 px-3 text-center">
                    <RiskBadge score={coin.scores.downsideRiskScore} classification={coin.scores.downsideRiskClassification} />
                  </td>

                  {/* Signal */}
                  <td className="py-2.5 px-3 text-center">
                    <SignalBadge signal={coin.scores.signal} />
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
        {coins.map((coin) => {
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
                  <ScoreBadge score={coin.scores.bullScore} compact />
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">Downside Risk</div>
                  <RiskBadge score={coin.scores.downsideRiskScore} compact />
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">Signal</div>
                  <SignalBadge signal={coin.scores.signal} />
                </div>
              </div>

              {/* Row 3: Quick metrics & freshness */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <div className="space-x-2">
                  <span>RSI: <strong className="text-white">{coin.indicators.rsi14}</strong></span>
                  <span>Vol: <strong className="text-cyan-400">{coin.indicators.volumeAnalysis.ratio}x</strong></span>
                </div>
                <DataFreshness seconds={coin.freshnessSeconds} status={coin.dataStatus} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
