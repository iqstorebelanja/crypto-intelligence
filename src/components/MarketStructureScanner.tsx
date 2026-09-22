import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  Layers,
  RefreshCw,
  Sliders,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useState } from 'react';
import { ExchangeId, NormalizedCoinData } from '../types';

interface MarketStructureScannerProps {
  coins: NormalizedCoinData[];
  onSelectCoin: (coin: NormalizedCoinData) => void;
  activeExchange: ExchangeId;
}

export const MarketStructureScanner: React.FC<MarketStructureScannerProps> = ({
  coins,
  onSelectCoin,
  activeExchange
}) => {
  const [filterState, setFilterState] = useState<'all' | 'uptrend' | 'downtrend' | 'range'>('all');
  const [filterEvent, setFilterEvent] = useState<'all' | 'breakout' | 'breakdown' | 'retest' | 'volume_confirmed'>('all');
  const [search, setSearch] = useState('');

  // Counts
  const uptrendCount = coins.filter(c => c.marketStructure.state.includes('Higher Highs') || c.marketStructure.state.includes('Higher High (HH)')).length;
  const downtrendCount = coins.filter(c => c.marketStructure.state.includes('Lower Lows') || c.marketStructure.state.includes('Lower Low (LL)')).length;
  const breakoutCount = coins.filter(c => c.marketStructure.event === 'Potential Breakout').length;
  const retestCount = coins.filter(c => c.marketStructure.event === 'Potential Retest Zone' || Boolean(c.marketStructure.retestZone)).length;

  const filteredCoins = coins.filter(c => {
    if (search.trim()) {
      const q = search.toUpperCase().trim();
      if (!c.symbol.includes(q) && !c.baseAsset.includes(q)) return false;
    }

    const st = c.marketStructure;
    if (filterState === 'uptrend' && !st.state.includes('Higher High')) return false;
    if (filterState === 'downtrend' && !st.state.includes('Lower Low')) return false;
    if (filterState === 'range' && !st.state.includes('Range')) return false;

    if (filterEvent === 'breakout' && st.event !== 'Potential Breakout') return false;
    if (filterEvent === 'breakdown' && st.event !== 'Potential Breakdown') return false;
    if (filterEvent === 'retest' && (!st.retestZone && st.event !== 'Potential Retest Zone')) return false;
    if (filterEvent === 'volume_confirmed' && !st.volumeConfirmed) return false;

    return true;
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 bg-[#0a0f1a] border border-[#1a263c] rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                <span>MARKET STRUCTURE & BREAKOUT RADAR</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-cyan-300">
                  {activeExchange}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Swing high/low tracking, key support/resistance zones, breakout confirmation, and retest detection
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-700/50 text-emerald-300">
              <span className="text-slate-400">HH/HL Trend: </span>
              <strong className="text-white">{uptrendCount}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-rose-950/50 border border-rose-700/50 text-rose-300">
              <span className="text-slate-400">LH/LL Trend: </span>
              <strong className="text-white">{downtrendCount}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-cyan-950/50 border border-cyan-700/50 text-cyan-300">
              <span className="text-slate-400">Breakouts: </span>
              <strong className="text-white">{breakoutCount}</strong>
            </div>
          </div>
        </div>

        {/* Structure Explanations strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#0c1322] border border-[#18253b] space-y-1">
            <div className="text-[10px] uppercase text-cyan-400 font-bold flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Volume-Confirmed Breakout</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Price closes through swing high while 20-period volume ratio exceeds 1.3x.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0c1322] border border-[#18253b] space-y-1">
            <div className="text-[10px] uppercase text-amber-400 font-bold flex items-center space-x-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retest Zone Dynamic</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Prior resistance tested as potential flipped support (or vice-versa) within 1.5% threshold.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0c1322] border border-[#18253b] space-y-1">
            <div className="text-[10px] uppercase text-rose-400 font-bold flex items-center space-x-1.5">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Breakdown Risk</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Loss of structural swing low. Downside risk factor elevated to defensive posture.
            </div>
          </div>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#080d16] p-3 rounded-2xl border border-[#152033] text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setFilterState('all'); setFilterEvent('all'); }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterState === 'all' && filterEvent === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            All Structures ({coins.length})
          </button>
          <button
            onClick={() => setFilterState('uptrend')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterState === 'uptrend'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Higher Highs (HH/HL)
          </button>
          <button
            onClick={() => setFilterEvent('breakout')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterEvent === 'breakout'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Breakouts ({breakoutCount})
          </button>
          <button
            onClick={() => setFilterEvent('retest')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterEvent === 'retest'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Retest Zones ({retestCount})
          </button>
          <button
            onClick={() => setFilterEvent('volume_confirmed')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterEvent === 'volume_confirmed'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Volume Confirmed
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pair..."
            className="w-full bg-[#0d1422] border border-[#1b263b] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Structure Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#172236] bg-[#090e18]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#0c1322] border-b border-[#18243a] text-[11px] text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Pair</th>
              <th className="py-3 px-3">Price</th>
              <th className="py-3 px-3">Structural State</th>
              <th className="py-3 px-3">Last Swing High</th>
              <th className="py-3 px-3">Last Swing Low</th>
              <th className="py-3 px-3">Key S/R Nearest</th>
              <th className="py-3 px-4">Event / Volume Confirmation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#131d2e]">
            {filteredCoins.map(coin => {
              const st = coin.marketStructure;
              const distHigh = (((coin.price - st.lastSwingHigh) / st.lastSwingHigh) * 100).toFixed(2);
              const distLow = (((coin.price - st.lastSwingLow) / st.lastSwingLow) * 100).toFixed(2);

              return (
                <tr
                  key={coin.id}
                  onClick={() => onSelectCoin(coin)}
                  className="hover:bg-[#0e1626] transition-colors cursor-pointer"
                >
                  {/* Symbol */}
                  <td className="py-3.5 px-4 font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{coin.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111928] text-slate-400">
                        {coin.exchange}
                      </span>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-white">
                      ${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-[10px] ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {coin.change24h >= 0 ? `+${coin.change24h.toFixed(2)}%` : `${coin.change24h.toFixed(2)}%`}
                    </div>
                  </td>

                  {/* Structural State */}
                  <td className="py-3.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        st.state.includes('Higher Highs')
                          ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                          : st.state.includes('Lower Lows')
                          ? 'bg-rose-950/60 border-rose-600/50 text-rose-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {st.state}
                    </span>
                  </td>

                  {/* Last Swing High */}
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-slate-200">
                      ${st.lastSwingHigh < 1 ? st.lastSwingHigh.toFixed(4) : st.lastSwingHigh.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {parseFloat(distHigh) >= 0 ? `+${distHigh}% above` : `${distHigh}% below`}
                    </div>
                  </td>

                  {/* Last Swing Low */}
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-slate-200">
                      ${st.lastSwingLow < 1 ? st.lastSwingLow.toFixed(4) : st.lastSwingLow.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {parseFloat(distLow) >= 0 ? `+${distLow}% above` : `${distLow}% below`}
                    </div>
                  </td>

                  {/* Nearest S/R */}
                  <td className="py-3.5 px-3">
                    <div className="space-y-0.5">
                      {st.nearestResistance && (
                        <div className="text-[11px] text-rose-400">
                          R: ${st.nearestResistance.price.toLocaleString()} ({st.nearestResistance.distancePercent?.toFixed(1)}%)
                        </div>
                      )}
                      {st.nearestSupport && (
                        <div className="text-[11px] text-emerald-400">
                          S: ${st.nearestSupport.price.toLocaleString()} ({st.nearestSupport.distancePercent?.toFixed(1)}%)
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Event & Volume */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          st.event === 'Potential Breakout'
                            ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                            : st.event === 'Potential Breakdown'
                            ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                            : st.event === 'Potential Retest Zone'
                            ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        {st.event}
                      </span>

                      {st.volumeConfirmed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-700/50 text-purple-300 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-purple-400" />
                          <span>Vol Confirmed</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      {st.description}
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
