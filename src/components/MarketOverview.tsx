import {
  Activity,
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  Flame,
  Globe,
  Radio,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { RiskBadge, ScoreBadge, SignalBadge } from './Badges';
import { MarketOverview as MarketOverviewType, NormalizedCoinData } from '../types';
import { VolatilityHeatmap } from './VolatilityHeatmap';

interface MarketOverviewProps {
  overview: MarketOverviewType | null;
  onSelectCoin: (coin: NormalizedCoinData) => void;
  activeQuickSection?: 'all' | 'bulls' | 'risk' | 'volume' | 'momentum';
  onQuickSectionChange?: (sec: 'all' | 'bulls' | 'risk' | 'volume' | 'momentum') => void;
  filteredCoins?: NormalizedCoinData[];
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  overview,
  onSelectCoin,
  activeQuickSection = 'all',
  onQuickSectionChange,
  filteredCoins
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Aggregated unique coins for Volatility Heatmap analysis
  const allAvailableCoins = useMemo(() => {
    if (!overview) return [];
    const map = new Map<string, NormalizedCoinData>();
    if (filteredCoins && filteredCoins.length > 0) {
      filteredCoins.forEach((c) => map.set(c.symbol, c));
    }
    (overview.topBullCoins || []).forEach((c) => map.set(c.symbol, c));
    (overview.volumeSpikeCoins || []).forEach((c) => map.set(c.symbol, c));
    (overview.momentumCoins || []).forEach((c) => map.set(c.symbol, c));
    (overview.topRiskCoins || []).forEach((c) => map.set(c.symbol, c));
    return Array.from(map.values());
  }, [filteredCoins, overview]);

  if (!overview) {
    return (
      <div className="animate-pulse bg-[#0d1424] border border-[#1b253b] rounded-2xl p-6 h-48 flex items-center justify-center text-slate-500 font-mono text-xs">
        Loading live Binance market conditions...
      </div>
    );
  }

  const { btcCondition } = overview;
  const coinsToExport = filteredCoins && filteredCoins.length > 0
    ? filteredCoins
    : overview.topBullCoins || [];

  const handleDownloadReport = () => {
    setIsExporting(true);

    try {
      const escapeCsv = (str: string | number | null | undefined): string => {
        if (str === null || str === undefined) return '';
        const val = String(str);
        if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const rows: string[] = [];

      // 1. Metadata Header
      rows.push('CRYPTO INTELLIGENCE AI - FILTERED COIN SCANNER RESULTS');
      rows.push(`Generated At,${escapeCsv(new Date().toISOString())}`);
      rows.push(`Active Exchange,${escapeCsv(overview.activeExchange || 'BINANCE')}`);
      rows.push(`Total Scanned Coins,${overview.totalPairsScanned}`);
      rows.push(`Exported Filtered Coins,${coinsToExport.length}`);
      rows.push('');

      // 2. Macro Market Indicators & Context
      rows.push('--- MACRO MARKET METRICS ---');
      rows.push('Asset,Price (USD),24h Change (%),RSI (14),MA20 (USD),MA50 (USD),MA200 (USD),Price vs MA20,Price vs MA50,Price vs MA200,Bull Score,Downside Risk,Analytical Signal,Freshness (sec),Data Status');

      rows.push([
        'BTC',
        btcCondition.price,
        `${btcCondition.change24h}%`,
        btcCondition.rsi14,
        btcCondition.ma20,
        btcCondition.ma50,
        btcCondition.ma200,
        btcCondition.priceVsMa20,
        btcCondition.priceVsMa50,
        btcCondition.priceVsMa200,
        btcCondition.bullScore,
        btcCondition.downsideRiskScore,
        escapeCsv(btcCondition.signal),
        btcCondition.freshnessSeconds,
        btcCondition.dataStatus
      ].join(','));

      rows.push([
        'ETH',
        overview.ethPrice,
        `${overview.ethChange24h}%`,
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'LIVE'
      ].join(','));

      rows.push('');

      // 3. Market Sentiment Index (if present)
      if (overview.sentiment) {
        const s = overview.sentiment;
        rows.push('--- MARKET SENTIMENT INDEX ---');
        rows.push('Metric,Value,Classification / Status,Weight,Source / Details');
        rows.push(`Composite Sentiment Index,${s.index} / 100,${escapeCsv(s.tier)},100%,Weighted Confluence`);
        rows.push(`Crypto Fear & Greed,${s.fearAndGreed.value} / 100,${escapeCsv(s.fearAndGreed.classification)},40%,${escapeCsv(s.fearAndGreed.source)}`);
        rows.push(`Global Market RSI,${s.globalRsi.value},${escapeCsv(s.globalRsi.status)} (${s.globalRsi.oversoldPercent}% oversold / ${s.globalRsi.overboughtPercent}% overbought),35%,Mean 14-period across scanned basket`);
        rows.push(`24h Market Momentum,${s.marketMomentum24h.value} / 100,${escapeCsv(s.marketMomentum24h.status)} (${s.marketMomentum24h.advancingPercent}% advancers / avg ${s.marketMomentum24h.averageChange24h}%),25%,Market breadth & basket return`);
        rows.push('');
      }

      // 4. Filtered Coins Table
      rows.push('--- FILTERED ASSET LIST ---');
      const headers = [
        'Rank',
        'Symbol',
        'Base Asset',
        'Exchange',
        'Price (USD)',
        '24h Change (%)',
        '24h Volume (Quote)',
        'Bull Score (0-100)',
        'Downside Risk (0-100)',
        'Analytical Signal',
        'RSI 14',
        'RSI 6',
        'MA20 (USD)',
        'MA50 (USD)',
        'MA200 (USD)',
        'Price vs MA20',
        'Price vs MA50',
        'Price vs MA200',
        'MA Trend',
        'MA Alignment',
        'BB Upper',
        'BB Middle',
        'BB Lower',
        'BB Width (%)',
        'BB %B',
        'Volume Ratio (20MA)',
        'Volume Spike',
        'Structure State',
        'Open Interest (USD)',
        'Funding Rate (%)',
        'Freshness (sec)',
        'Data Status'
      ];
      rows.push(headers.join(','));

      coinsToExport.forEach((coin, idx) => {
        const ind = coin.indicators || {};
        const bb = ind.bb || {};
        const vol = ind.volumeAnalysis || {};
        const der = coin.derivatives;
        const struct = coin.marketStructure;

        const row = [
          idx + 1,
          escapeCsv(coin.symbol),
          escapeCsv(coin.baseAsset),
          escapeCsv(coin.exchange),
          coin.price,
          `${coin.change24h}%`,
          coin.volume24h,
          coin.scores?.bullScore ?? 'N/A',
          coin.scores?.downsideRiskScore ?? 'N/A',
          escapeCsv(coin.scores?.signal ?? 'N/A'),
          ind.rsi14 ?? 'N/A',
          ind.rsi6 ?? 'N/A',
          ind.ma20 ?? 'N/A',
          ind.ma50 ?? 'N/A',
          ind.ma200 ?? 'N/A',
          ind.priceVsMa20 ?? 'N/A',
          ind.priceVsMa50 ?? 'N/A',
          ind.priceVsMa200 ?? 'N/A',
          escapeCsv(ind.maTrend ?? 'N/A'),
          escapeCsv(ind.maCross ?? 'N/A'),
          bb.upper ?? 'N/A',
          bb.middle ?? 'N/A',
          bb.lower ?? 'N/A',
          bb.width ?? 'N/A',
          bb.percentB ?? 'N/A',
          vol.ratio ?? 'N/A',
          vol.isSpike ? 'YES' : 'NO',
          escapeCsv(struct?.state ?? 'N/A'),
          der?.openInterestUsd ?? 'N/A',
          der?.fundingRate ? `${(der.fundingRate * 100).toFixed(4)}%` : 'N/A',
          coin.freshnessSeconds ?? 0,
          coin.dataStatus ?? 'LIVE'
        ];
        rows.push(row.join(','));
      });

      const csvContent = '\uFEFF' + rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '');
      link.href = url;
      link.download = `crypto_filtered_coins_export_${dateStr}_${timeStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export CSV report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: BTC Market Condition (Prominent) + ETH + Scanned Count */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* BTC Market Condition Card (Takes 2 columns on lg) */}
        <div className="lg:col-span-2 bg-[#0c121e] border border-[#1e2a42] rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#172238] pb-2.5 mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-mono font-bold text-sm text-white tracking-wider">
                BTC MARKET CONDITION
              </span>
              <span className="text-[11px] font-mono text-slate-400">Contextual Macro Anchor</span>
            </div>

            <div className="flex items-center space-x-2">
              <SignalBadge signal={btcCondition.signal} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            {/* Price & Change */}
            <div className="p-2.5 rounded-xl bg-[#080d16] border border-[#152033]">
              <div className="text-[10px] uppercase text-slate-400">Spot Price</div>
              <div className="text-base sm:text-lg font-bold text-white mt-0.5">
                ${btcCondition.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              <div className={`text-xs font-semibold mt-0.5 flex items-center space-x-1 ${btcCondition.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {btcCondition.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{btcCondition.change24h >= 0 ? '+' : ''}{btcCondition.change24h.toFixed(2)}%</span>
              </div>
            </div>

            {/* RSI & Moving Averages */}
            <div className="p-2.5 rounded-xl bg-[#080d16] border border-[#152033]">
              <div className="text-[10px] uppercase text-slate-400">RSI (14)</div>
              <div className="text-base sm:text-lg font-bold text-cyan-300 mt-0.5">
                {btcCondition.rsi14}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                MA20: ${btcCondition.ma20 > 1000 ? `${(btcCondition.ma20 / 1000).toFixed(1)}k` : btcCondition.ma20} ({btcCondition.priceVsMa20})
              </div>
            </div>

            {/* Bull Potential Score */}
            <div className="p-2.5 rounded-xl bg-[#080d16] border border-[#152033]">
              <div className="text-[10px] uppercase text-slate-400">Bull Score</div>
              <div className="mt-1">
                <ScoreBadge score={btcCondition.bullScore} compact />
              </div>
              <div className="text-[10px] text-slate-500 mt-1 truncate">
                MA50: ${btcCondition.ma50 > 1000 ? `${(btcCondition.ma50 / 1000).toFixed(1)}k` : btcCondition.ma50}
              </div>
            </div>

            {/* Downside Risk Score */}
            <div className="p-2.5 rounded-xl bg-[#080d16] border border-[#152033]">
              <div className="text-[10px] uppercase text-slate-400">Downside Risk</div>
              <div className="mt-1">
                <RiskBadge score={btcCondition.downsideRiskScore} compact />
              </div>
              <div className="text-[10px] text-slate-500 mt-1 truncate">
                MA200: ${btcCondition.ma200 > 1000 ? `${(btcCondition.ma200 / 1000).toFixed(1)}k` : btcCondition.ma200}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Overview: ETH & Tracked Pairs Stats */}
        <div className="bg-[#0c121e] border border-[#1e2a42] rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#172238] pb-2.5 mb-2 font-mono">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                MARKET BREADTH
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                {overview.activeExchange ? `${overview.activeExchange} SPOT` : 'BINANCE SPOT'}
              </span>
            </div>

            {/* Quick Export in Breadth Header */}
            <button
              id="btn-quick-export-data"
              onClick={handleDownloadReport}
              disabled={isExporting}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                exportSuccess
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-[#080d16] hover:bg-[#121c2d] border-[#1a283f] hover:border-cyan-500/50 text-slate-300 hover:text-white'
              }`}
              title={`Export current filtered coin scanner results (${coinsToExport.length} assets) to CSV`}
              aria-label="Export Data"
            >
              {exportSuccess ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px]">Saved</span>
                </>
              ) : isExporting ? (
                <>
                  <Activity className="w-3 h-3 text-cyan-400 animate-spin" />
                  <span className="text-[10px]">Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px]">Export CSV</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono my-auto">
            {/* ETH Overview */}
            <div className="p-2.5 rounded-xl bg-[#080d16] border border-[#152033]">
              <div className="text-[10px] uppercase text-slate-400">ETH/USDT</div>
              <div className="text-base font-bold text-white mt-0.5">
                ${overview.ethPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              <div className={`text-xs font-semibold mt-0.5 ${overview.ethChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {overview.ethChange24h >= 0 ? '+' : ''}{overview.ethChange24h.toFixed(2)}%
              </div>
            </div>

            {/* Tracked Pairs */}
            <div className="p-2.5 rounded-xl bg-[#080d16] border border-[#152033]">
              <div className="text-[10px] uppercase text-slate-400">Tracked Pairs</div>
              <div className="text-base font-bold text-cyan-400 mt-0.5">
                {overview.totalPairsScanned}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                USDT Spot Pairs
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-[#141d2e]">
            Scores are computed algorithmically from multi-timeframe Binance data.
          </div>
        </div>
      </div>

      {/* 24h Volatility & Range Heatmap Visualization (Recharts) */}
      <VolatilityHeatmap
        coins={allAvailableCoins}
        onSelectCoin={onSelectCoin}
        activeExchange={overview.activeExchange || 'BINANCE'}
      />

      {/* Quick Section Switcher Buttons & Download Report Action */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 font-mono">
        {onQuickSectionChange && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => onQuickSectionChange('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeQuickSection === 'all'
                  ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/20'
                  : 'bg-[#0e1524] text-slate-400 hover:text-white border border-[#1d293f]'
              }`}
            >
              All Pairs
            </button>
            <button
              onClick={() => onQuickSectionChange('bulls')}
              className={`px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
                activeQuickSection === 'bulls'
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'bg-[#0e1524] text-slate-400 hover:text-emerald-300 border border-[#1d293f]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>Top Bull Potential</span>
            </button>
            <button
              onClick={() => onQuickSectionChange('risk')}
              className={`px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
                activeQuickSection === 'risk'
                  ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-600/20'
                  : 'bg-[#0e1524] text-slate-400 hover:text-rose-300 border border-[#1d293f]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Downside Risk</span>
            </button>
            <button
              onClick={() => onQuickSectionChange('volume')}
              className={`px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
                activeQuickSection === 'volume'
                  ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/20'
                  : 'bg-[#0e1524] text-slate-400 hover:text-cyan-300 border border-[#1d293f]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Volume Spike</span>
            </button>
            <button
              onClick={() => onQuickSectionChange('momentum')}
              className={`px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
                activeQuickSection === 'momentum'
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/20'
                  : 'bg-[#0e1524] text-slate-400 hover:text-amber-300 border border-[#1d293f]'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Market Momentum</span>
            </button>
          </div>
        )}

        {/* Export Data Button: Download current filtered coin scanner results as CSV */}
        <button
          id="btn-export-data"
          data-testid="btn-export-data"
          onClick={handleDownloadReport}
          disabled={isExporting}
          className={`ml-auto px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer border ${
            exportSuccess
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-lg shadow-emerald-950/50'
              : 'bg-[#0a1220] hover:bg-[#111c30] border-[#1e2e4a] hover:border-cyan-500/50 text-slate-200 hover:text-white shadow-sm'
          }`}
          title={`Export current filtered coin scanner results (${coinsToExport.length} assets) as a CSV file`}
          aria-label="Export Data"
        >
          {exportSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Exported!</span>
            </>
          ) : isExporting ? (
            <>
              <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export Data</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#132034] text-cyan-300 font-semibold border border-[#1f3352]">
                CSV ({coinsToExport.length})
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
