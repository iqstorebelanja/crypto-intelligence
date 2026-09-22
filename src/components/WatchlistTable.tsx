import {
  Bell,
  Compass,
  Layers,
  Sparkles,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { RiskBadge, ScoreBadge, SignalBadge, WatchlistButton } from './Badges';
import { NormalizedCoinData } from '../types';

interface WatchlistTableProps {
  coins: NormalizedCoinData[];
  watchlistSymbols: string[];
  onToggleWatchlist: (symbol: string) => void;
  onSelectCoin: (coin: NormalizedCoinData) => void;
  onSetAlertForCoin?: (symbol: string) => void;
  isLoading?: boolean;
}

const CATEGORY_MAP: Record<string, string[]> = {
  'Layer 1': ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ADA/USDT', 'AVAX/USDT', 'NEAR/USDT', 'SUI/USDT', 'APT/USDT'],
  'DeFi': ['UNI/USDT', 'AAVE/USDT', 'LINK/USDT', 'MKR/USDT', 'CRV/USDT', 'LDO/USDT'],
  'AI Coins': ['NEAR/USDT', 'RENDER/USDT', 'FET/USDT', 'TAO/USDT', 'GRT/USDT'],
  'Memes': ['DOGE/USDT', 'SHIB/USDT', 'PEPE/USDT', 'BONK/USDT', 'WIF/USDT', 'FLOKI/USDT']
};

export const WatchlistTable: React.FC<WatchlistTableProps> = ({
  coins,
  watchlistSymbols,
  onToggleWatchlist,
  onSelectCoin,
  onSetAlertForCoin,
  isLoading = false
}) => {
  const [activeGroup, setActiveGroup] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'technical' | 'derivatives' | 'structure'>('technical');

  const watchlistCoins = coins.filter(c => watchlistSymbols.includes(c.symbol));

  const filteredCoins = watchlistCoins.filter(c => {
    if (activeGroup === 'All') return true;
    const catSymbols = CATEGORY_MAP[activeGroup] || [];
    return catSymbols.includes(c.symbol);
  });

  if (watchlistCoins.length === 0) {
    return (
      <div className="bg-[#0c121e] border border-[#1d2940] rounded-2xl p-12 text-center text-slate-400 font-mono text-xs space-y-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-950/40 border border-amber-600/30 flex items-center justify-center mx-auto text-amber-400">
          <Star className="w-5 h-5 fill-amber-400/20" />
        </div>
        <div className="text-white font-bold text-sm">Your Watchlist is Empty</div>
        <p className="text-slate-400 max-w-sm mx-auto">
          Click the ★ star icon next to any trading pair in the SCORE, CRASH RISK, or DERIVATIVES scanner to monitor it here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono">
      {/* Header & Group Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0f1a] p-3.5 rounded-2xl border border-[#19243a]">
        <div className="flex items-center space-x-2">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="font-bold text-white text-sm">ADVANCED WATCHLIST RADAR</span>
          <span className="text-[11px] text-slate-500">({watchlistCoins.length} tracked pairs)</span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center space-x-1.5 text-xs">
          <button
            onClick={() => setViewMode('technical')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              viewMode === 'technical'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Technical View
          </button>
          <button
            onClick={() => setViewMode('derivatives')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              viewMode === 'derivatives'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Derivatives View
          </button>
          <button
            onClick={() => setViewMode('structure')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              viewMode === 'structure'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Structure View
          </button>
        </div>
      </div>

      {/* Grouping Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-500 text-[11px] pr-1">Sector Groups:</span>
        {['All', 'Layer 1', 'DeFi', 'AI Coins', 'Memes'].map(grp => (
          <button
            key={grp}
            onClick={() => setActiveGroup(grp)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors ${
              activeGroup === grp
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 font-bold'
                : 'bg-[#0d1422] border-[#18253b] text-slate-400 hover:text-slate-200'
            }`}
          >
            {grp}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#172236] bg-[#090e18]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#0c1322] border-b border-[#18243a] text-[11px] text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-3 w-10">★</th>
              <th className="py-3 px-3">Trading Pair</th>
              <th className="py-3 px-3">Price / 24h</th>

              {viewMode === 'technical' && (
                <>
                  <th className="py-3 px-3">Bull Score</th>
                  <th className="py-3 px-3">Downside Risk</th>
                  <th className="py-3 px-3">RSI (14)</th>
                  <th className="py-3 px-3">vs MA20 / MA50 / MA200</th>
                  <th className="py-3 px-3">Volume Ratio</th>
                </>
              )}

              {viewMode === 'derivatives' && (
                <>
                  <th className="py-3 px-3">Open Interest</th>
                  <th className="py-3 px-3">24h OI Change</th>
                  <th className="py-3 px-3">Funding Rate</th>
                  <th className="py-3 px-3">L/S Ratio</th>
                  <th className="py-3 px-3">Price + OI Dynamic</th>
                </>
              )}

              {viewMode === 'structure' && (
                <>
                  <th className="py-3 px-3">Structural State</th>
                  <th className="py-3 px-3">Swing High</th>
                  <th className="py-3 px-3">Swing Low</th>
                  <th className="py-3 px-3">Nearest S/R</th>
                  <th className="py-3 px-3">Event Detection</th>
                </>
              )}

              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#131d2e]">
            {filteredCoins.map(coin => {
              const d = coin.derivatives;
              const st = coin.marketStructure;
              const ind = coin.indicators;

              return (
                <tr
                  key={coin.id}
                  className="hover:bg-[#0e1626] transition-colors"
                >
                  {/* Star */}
                  <td className="py-3.5 px-3">
                    <WatchlistButton
                      isSaved={true}
                      onClick={() => onToggleWatchlist(coin.symbol)}
                    />
                  </td>

                  {/* Pair */}
                  <td
                    className="py-3.5 px-3 cursor-pointer"
                    onClick={() => onSelectCoin(coin)}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm hover:text-cyan-400">
                        {coin.symbol}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#111928] text-slate-400">
                        {coin.exchange}
                      </span>
                    </div>
                  </td>

                  {/* Price / 24h */}
                  <td
                    className="py-3.5 px-3 cursor-pointer"
                    onClick={() => onSelectCoin(coin)}
                  >
                    <div className="font-bold text-white">
                      ${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-[10px] font-semibold ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {coin.change24h >= 0 ? `+${coin.change24h.toFixed(2)}%` : `${coin.change24h.toFixed(2)}%`}
                    </div>
                  </td>

                  {/* TECHNICAL VIEW COLS */}
                  {viewMode === 'technical' && (
                    <>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <ScoreBadge score={coin.scores.bullScore} />
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <RiskBadge score={coin.scores.downsideRiskScore} />
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <span className="font-bold text-white">{ind.rsi14}</span>
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <div className="flex items-center space-x-1.5 text-[10px] font-mono">
                          <span className={ind.priceVsMa20 === 'above' ? 'text-emerald-400' : 'text-rose-400'}>
                            M20:{ind.priceVsMa20 === 'above' ? '▲' : '▼'}
                          </span>
                          <span className={ind.priceVsMa50 === 'above' ? 'text-emerald-400' : 'text-rose-400'}>
                            M50:{ind.priceVsMa50 === 'above' ? '▲' : '▼'}
                          </span>
                          <span className={ind.priceVsMa200 === 'above' ? 'text-emerald-400' : 'text-rose-400'}>
                            M200:{ind.priceVsMa200 === 'above' ? '▲' : '▼'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <span className="font-bold text-cyan-300">{ind.volumeAnalysis.ratio}x</span>
                      </td>
                    </>
                  )}

                  {/* DERIVATIVES VIEW COLS */}
                  {viewMode === 'derivatives' && (
                    <>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <div className="font-bold text-slate-100">
                          {d?.openInterestUsd != null ? `$${(d.openInterestUsd / 1_000_000).toFixed(2)}M` : '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        {d?.openInterestChange24h != null ? (
                          <span className={`font-bold ${d.openInterestChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {d.openInterestChange24h >= 0 ? `+${d.openInterestChange24h.toFixed(2)}%` : `${d.openInterestChange24h.toFixed(2)}%`}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        {d?.fundingRate != null ? (
                          <span className={d.fundingRate > 0.0003 ? 'text-amber-400' : d.fundingRate < 0 ? 'text-rose-400' : 'text-cyan-300'}>
                            {(d.fundingRate * 100).toFixed(4)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        {d?.longShortRatio?.ratio != null ? `${d.longShortRatio.ratio.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        {d ? (
                          <span className="text-[11px] text-slate-300">
                            {d.priceOiInterpretation.split(':')[0]}
                          </span>
                        ) : '—'}
                      </td>
                    </>
                  )}

                  {/* STRUCTURE VIEW COLS */}
                  {viewMode === 'structure' && (
                    <>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <span className="text-[11px] text-slate-300">{st.state}</span>
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        ${st.lastSwingHigh.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        ${st.lastSwingLow.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <div className="text-[10px]">
                          {st.nearestSupport && <span className="text-emerald-400 block">S: ${st.nearestSupport.toLocaleString()}</span>}
                          {st.nearestResistance && <span className="text-rose-400 block">R: ${st.nearestResistance.toLocaleString()}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-3" onClick={() => onSelectCoin(coin)}>
                        <span className="text-[11px] font-bold text-cyan-300">{st.event}</span>
                      </td>
                    </>
                  )}

                  {/* Actions: Alert + Details */}
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {onSetAlertForCoin && (
                        <button
                          onClick={() => onSetAlertForCoin(coin.symbol)}
                          className="p-1.5 rounded-lg bg-[#101726] border border-[#1c2940] text-slate-400 hover:text-cyan-300"
                          title="Set Alert"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onSelectCoin(coin)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-cyan-300 text-[11px] hover:bg-cyan-900/60"
                      >
                        Detail
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
