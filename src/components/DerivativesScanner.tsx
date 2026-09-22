import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Compass,
  DollarSign,
  HelpCircle,
  Layers,
  Percent,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useState } from 'react';
import { ExchangeId, NormalizedCoinData } from '../types';

interface DerivativesScannerProps {
  coins: NormalizedCoinData[];
  onSelectCoin: (coin: NormalizedCoinData) => void;
  activeExchange: ExchangeId;
}

export const DerivativesScanner: React.FC<DerivativesScannerProps> = ({
  coins,
  onSelectCoin,
  activeExchange
}) => {
  const [filterType, setFilterType] = useState<'all' | 'high_oi_growth' | 'high_funding' | 'negative_funding' | 'long_crowded' | 'short_crowded'>('all');
  const [search, setSearch] = useState('');

  // Filter coins with derivatives
  const coinsWithDerivatives = coins.filter(c => c.derivatives);

  // Top metrics
  const totalOpenInterestUsd = coinsWithDerivatives.reduce(
    (acc, c) => acc + (c.derivatives?.openInterestUsd || 0),
    0
  );

  const topOiGainers = [...coinsWithDerivatives]
    .sort((a, b) => (b.derivatives?.openInterestChange24h || 0) - (a.derivatives?.openInterestChange24h || 0))
    .slice(0, 4);

  const topFundingSpikes = [...coinsWithDerivatives]
    .sort((a, b) => Math.abs(b.derivatives?.fundingRate || 0) - Math.abs(a.derivatives?.fundingRate || 0))
    .slice(0, 4);

  // Filtered coins for table
  const filteredList = coinsWithDerivatives.filter(c => {
    if (search.trim()) {
      const q = search.toUpperCase().trim();
      if (!c.symbol.includes(q) && !c.baseAsset.includes(q)) return false;
    }

    const d = c.derivatives;
    if (!d) return false;

    if (filterType === 'high_oi_growth') {
      return (d.openInterestChange24h || 0) >= 3;
    }
    if (filterType === 'high_funding') {
      return (d.fundingRate || 0) >= 0.0002;
    }
    if (filterType === 'negative_funding') {
      return (d.fundingRate || 0) < 0;
    }
    if (filterType === 'long_crowded') {
      return (d.longShortRatio?.ratio || 1) >= 1.4;
    }
    if (filterType === 'short_crowded') {
      return (d.longShortRatio?.ratio || 1) <= 0.8;
    }
    return true;
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner & Analytical Context */}
      <div className="p-4 sm:p-5 bg-[#0a0f1a] border border-[#1a263c] rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                <span>DERIVATIVES & OPEN INTEREST INTELLIGENCE</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-cyan-300">
                  {activeExchange === 'BYBIT' ? 'BYBIT LINEAR v5' : 'BINANCE FUTURES'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Institutional positioning, contract open interest shifts, funding sentiment, and leverage concentration
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase text-slate-400">Aggregate Tracked OI</div>
            <div className="text-lg font-bold text-white">
              ${(totalOpenInterestUsd / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M
            </div>
          </div>
        </div>

        {/* 4 Macro Matrix Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Card 1: Price Up + OI Up */}
          <div className="p-3 rounded-xl bg-[#0d1424] border border-[#1a2842] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-400 font-bold uppercase">Aggressive Long Inflow</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-white font-bold">Price ▲ + Open Interest ▲</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              New aggressive capital entering to push price higher. Trend confirmation.
            </div>
          </div>

          {/* Card 2: Price Down + OI Up */}
          <div className="p-3 rounded-xl bg-[#0d1424] border border-[#1a2842] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-rose-400 font-bold uppercase">Aggressive Short Build-up</span>
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-white font-bold">Price ▼ + Open Interest ▲</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Shorts opening aggressively with expanding positioning. Downside continuation.
            </div>
          </div>

          {/* Card 3: Price Up + OI Down */}
          <div className="p-3 rounded-xl bg-[#0d1424] border border-[#1a2842] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400 font-bold uppercase">Short Squeeze / Covering</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-white font-bold">Price ▲ + Open Interest ▼</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Rally driven by short liquidations / position closing, rather than fresh organic demand.
            </div>
          </div>

          {/* Card 4: Price Down + OI Down */}
          <div className="p-3 rounded-xl bg-[#0d1424] border border-[#1a2842] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-400 font-bold uppercase">Long Liquidation / Flush</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-white font-bold">Price ▼ + Open Interest ▼</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Leveraged long capitulation. Open positions extinguishing. Potential exhaustion base.
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#080d16] p-3 rounded-2xl border border-[#152033] text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            All Derivatives ({coinsWithDerivatives.length})
          </button>
          <button
            onClick={() => setFilterType('high_oi_growth')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'high_oi_growth'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            OI Surge &gt;= +3%
          </button>
          <button
            onClick={() => setFilterType('high_funding')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'high_funding'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Crowded Longs (High Funding)
          </button>
          <button
            onClick={() => setFilterType('negative_funding')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'negative_funding'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Negative Funding (Short Heavy)
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pair or asset..."
            className="w-full bg-[#0d1422] border border-[#1b263b] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Main Derivatives Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#172236] bg-[#090e18]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#0c1322] border-b border-[#18243a] text-[11px] text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Asset / Pair</th>
              <th className="py-3 px-3">Price / 24h</th>
              <th className="py-3 px-3">Open Interest</th>
              <th className="py-3 px-3">OI Change (24h)</th>
              <th className="py-3 px-3">Funding Rate</th>
              <th className="py-3 px-3">L/S Accounts</th>
              <th className="py-3 px-4">OI & Price Dynamic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#131d2e]">
            {filteredList.map(coin => {
              const d = coin.derivatives;
              if (!d) return null;

              const isPositiveFunding = (d.fundingRate ?? 0) > 0;
              const fundingPercent = d.fundingRate != null ? (d.fundingRate * 100).toFixed(4) : '—';
              const oiChange = d.openInterestChange24h || 0;
              const lsRatio = d.longShortRatio?.ratio;

              return (
                <tr
                  key={coin.id}
                  onClick={() => onSelectCoin(coin)}
                  className="hover:bg-[#0e1626] transition-colors cursor-pointer"
                >
                  {/* Symbol & Source */}
                  <td className="py-3.5 px-4 font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{coin.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111928] text-slate-400 border border-slate-700/50">
                        {coin.exchange}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">{d.source}</div>
                  </td>

                  {/* Price / 24h */}
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-white">
                      ${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {coin.change24h >= 0 ? `+${coin.change24h.toFixed(2)}%` : `${coin.change24h.toFixed(2)}%`}
                    </div>
                  </td>

                  {/* Open Interest */}
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-slate-100">
                      {d.openInterestUsd != null ? `$${(d.openInterestUsd / 1_000_000).toFixed(2)}M` : '—'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {d.openInterest != null ? `${d.openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })} contracts` : '—'}
                    </div>
                  </td>

                  {/* OI Change 24h */}
                  <td className="py-3.5 px-3">
                    <div
                      className={`font-bold flex items-center space-x-1 ${
                        oiChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {oiChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{oiChange >= 0 ? `+${oiChange.toFixed(2)}%` : `${oiChange.toFixed(2)}%`}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">1h: {d.openInterestChange1h ? `${d.openInterestChange1h > 0 ? '+' : ''}${d.openInterestChange1h.toFixed(2)}%` : '—'}</div>
                  </td>

                  {/* Funding Rate */}
                  <td className="py-3.5 px-3">
                    <div
                      className={`font-bold ${
                        (d.fundingRate ?? 0) > 0.0003
                          ? 'text-amber-400'
                          : (d.fundingRate ?? 0) < 0
                          ? 'text-rose-400'
                          : 'text-cyan-300'
                      }`}
                    >
                      {fundingPercent}%
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Ann: {d.fundingRate != null ? `${(d.fundingRate * 3 * 365 * 100).toFixed(1)}%` : '—'} • {d.fundingTrend}
                    </div>
                  </td>

                  {/* Long/Short Ratio */}
                  <td className="py-3.5 px-3">
                    {lsRatio ? (
                      <div>
                        <div className="font-bold text-white flex items-center space-x-1.5">
                          <span>{lsRatio.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400">
                            ({((lsRatio / (lsRatio + 1)) * 100).toFixed(0)}% L)
                          </span>
                        </div>
                        {/* Mini ratio bar */}
                        <div className="w-20 h-1.5 rounded-full bg-rose-500/40 overflow-hidden flex mt-1">
                          <div
                            className="bg-emerald-400 h-full"
                            style={{ width: `${(lsRatio / (lsRatio + 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  {/* Price + OI Interpretation */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-1 rounded text-[11px] font-bold border inline-block ${
                        d.priceOiRelation === 'Price_Up_OI_Up'
                          ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                          : d.priceOiRelation === 'Price_Down_OI_Up'
                          ? 'bg-rose-950/60 border-rose-600/50 text-rose-300'
                          : d.priceOiRelation === 'Price_Up_OI_Down'
                          ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                          : 'bg-cyan-950/60 border-cyan-600/50 text-cyan-300'
                      }`}
                    >
                      {d.priceOiInterpretation.split(':')[0]}
                    </span>
                    <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {d.priceOiInterpretation.split(':')[1] || d.priceOiInterpretation}
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
