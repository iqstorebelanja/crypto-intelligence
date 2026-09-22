import {
  ArrowDownAZ,
  ArrowUpDown,
  Check,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react';
import React, { useState } from 'react';

export interface ScannerFilterState {
  search: string;
  bullMin: number | null;
  riskMin: number | null;
  volRatioMin: number | null;
  rsiMin: number | null;
  rsiMax: number | null;
  aboveMa20: boolean;
  aboveMa50: boolean;
  aboveMa200: boolean;
  sortBy: 'bullScore' | 'downsideRisk' | 'volumeRatio' | 'rsi14' | 'change24h' | 'volume24h' | 'price';
  sortOrder: 'desc' | 'asc';
}

interface ScannerFiltersProps {
  filters: ScannerFilterState;
  onChange: (updated: ScannerFilterState) => void;
  onReset: () => void;
  totalFilteredCount: number;
  totalCoinsCount: number;
}

export const ScannerFilters: React.FC<ScannerFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalFilteredCount,
  totalCoinsCount
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [naturalQuery, setNaturalQuery] = useState('');
  const [isParsingQuery, setIsParsingQuery] = useState(false);
  const [activeNaturalLabel, setActiveNaturalLabel] = useState<string | null>(null);

  const handleParseNaturalQuery = async (queryText?: string) => {
    const q = (queryText || naturalQuery).trim();
    if (!q) return;

    setIsParsingQuery(true);
    try {
      const res = await fetch('/api/ai/parse-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });

      if (res.ok) {
        const data = await res.json();
        const f = data.filters || {};
        onChange({
          ...filters,
          bullMin: f.minBullScore ?? null,
          riskMin: f.minDownsideRisk ?? null,
          volRatioMin: f.minVolumeRatio ?? null,
          rsiMin: f.minRsi ?? null,
          rsiMax: f.maxRsi ?? null,
          aboveMa20: Boolean(f.aboveMa20),
          aboveMa50: Boolean(f.aboveMa50),
          aboveMa200: Boolean(f.aboveMa200)
        });
        setActiveNaturalLabel(q);
      }
    } catch (err) {
      console.error('Failed to parse query:', err);
    } finally {
      setIsParsingQuery(false);
    }
  };

  // Quick preset handlers
  const applyPreset = (preset: 'bull70' | 'risk70' | 'vol3' | 'rsiOversold' | 'rsiOverbought' | 'aboveAllMA') => {
    switch (preset) {
      case 'bull70':
        onChange({ ...filters, bullMin: 70, riskMin: null, volRatioMin: null, rsiMin: null, rsiMax: null });
        break;
      case 'risk70':
        onChange({ ...filters, riskMin: 70, bullMin: null, volRatioMin: null, rsiMin: null, rsiMax: null });
        break;
      case 'vol3':
        onChange({ ...filters, volRatioMin: 3.0, bullMin: null, riskMin: null });
        break;
      case 'rsiOversold':
        onChange({ ...filters, rsiMax: 35, rsiMin: null, bullMin: null, riskMin: null });
        break;
      case 'rsiOverbought':
        onChange({ ...filters, rsiMin: 70, rsiMax: null, bullMin: null, riskMin: null });
        break;
      case 'aboveAllMA':
        onChange({ ...filters, aboveMa20: true, aboveMa50: true, aboveMa200: true });
        break;
    }
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.bullMin !== null ||
    filters.riskMin !== null ||
    filters.volRatioMin !== null ||
    filters.rsiMin !== null ||
    filters.rsiMax !== null ||
    filters.aboveMa20 ||
    filters.aboveMa50 ||
    filters.aboveMa200;

  return (
    <div className="bg-[#0c121e] border border-[#1d2940] rounded-2xl p-4 shadow-lg space-y-3 font-mono">
      {/* Top Row: Search + Quick Sorter + Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            placeholder="Search coin (e.g. BTC, SOL, PEPE)..."
            className="w-full bg-[#080d16] border border-[#1b253b] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sorting controls */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 text-[11px] hidden sm:inline">SORT BY:</span>
          <select
            value={filters.sortBy}
            onChange={e => onChange({ ...filters, sortBy: e.target.value as any })}
            className="bg-[#080d16] border border-[#1b253b] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="bullScore">Bull Score</option>
            <option value="downsideRisk">Downside Risk</option>
            <option value="volumeRatio">Volume Ratio</option>
            <option value="rsi14">RSI 14</option>
            <option value="change24h">24h Change</option>
            <option value="price">Spot Price</option>
          </select>

          <button
            onClick={() => onChange({ ...filters, sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })}
            className="p-1.5 rounded-lg bg-[#080d16] border border-[#1b253b] text-slate-300 hover:text-white"
            title={`Toggle Sort Order (${filters.sortOrder.toUpperCase()})`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center space-x-1 transition-colors ${
              showAdvanced || hasActiveFilters
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                : 'bg-[#080d16] border-[#1b253b] text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 hover:text-white text-xs flex items-center space-x-1"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Natural Language AI Market Query Bar (Phase 3) */}
      <div className="pt-2 border-t border-[#141e30] flex flex-wrap items-center gap-2">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleParseNaturalQuery();
          }}
          className="flex-1 min-w-[280px] flex items-center bg-[#080d16] border border-purple-900/40 hover:border-purple-600/50 rounded-xl px-2.5 py-1.5 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={naturalQuery}
            onChange={e => setNaturalQuery(e.target.value)}
            placeholder="Ask AI Scanner: 'Bull Score > 75 and Volume > 2x', 'RSI < 35 with expanding volume'..."
            disabled={isParsingQuery}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!naturalQuery.trim() || isParsingQuery}
            className="ml-2 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] disabled:opacity-40 transition-all flex-shrink-0"
          >
            {isParsingQuery ? 'Parsing...' : 'Apply Filter'}
          </button>
        </form>

        {activeNaturalLabel && (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-500/40 text-purple-300 text-[11px]">
            <span>Active: <strong>"{activeNaturalLabel}"</strong></span>
            <button
              onClick={() => {
                setActiveNaturalLabel(null);
                setNaturalQuery('');
                onReset();
              }}
              className="text-purple-400 hover:text-white ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Filter Presets Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1 border-t border-[#141e30]">
        <span className="text-slate-500 uppercase text-[10px] mr-1">Presets:</span>

        <button
          onClick={() => applyPreset('bull70')}
          className={`px-2 py-0.5 rounded-lg border transition-all ${
            filters.bullMin === 70
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
              : 'bg-[#080d16] border-[#182338] text-slate-400 hover:text-emerald-400'
          }`}
        >
          Bull Score ≥ 70
        </button>

        <button
          onClick={() => applyPreset('risk70')}
          className={`px-2 py-0.5 rounded-lg border transition-all ${
            filters.riskMin === 70
              ? 'bg-rose-950/80 border-rose-500/60 text-rose-300'
              : 'bg-[#080d16] border-[#182338] text-slate-400 hover:text-rose-400'
          }`}
        >
          Downside Risk ≥ 70
        </button>

        <button
          onClick={() => applyPreset('vol3')}
          className={`px-2 py-0.5 rounded-lg border transition-all ${
            filters.volRatioMin === 3.0
              ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
              : 'bg-[#080d16] border-[#182338] text-slate-400 hover:text-cyan-300'
          }`}
        >
          Volume Ratio ≥ 3x
        </button>

        <button
          onClick={() => applyPreset('rsiOversold')}
          className={`px-2 py-0.5 rounded-lg border transition-all ${
            filters.rsiMax === 35
              ? 'bg-blue-950/80 border-blue-500/60 text-blue-300'
              : 'bg-[#080d16] border-[#182338] text-slate-400 hover:text-blue-300'
          }`}
        >
          RSI &lt; 35
        </button>

        <button
          onClick={() => applyPreset('rsiOverbought')}
          className={`px-2 py-0.5 rounded-lg border transition-all ${
            filters.rsiMin === 70
              ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
              : 'bg-[#080d16] border-[#182338] text-slate-400 hover:text-amber-300'
          }`}
        >
          RSI &gt; 70
        </button>

        <button
          onClick={() => applyPreset('aboveAllMA')}
          className={`px-2 py-0.5 rounded-lg border transition-all ${
            filters.aboveMa20 && filters.aboveMa50 && filters.aboveMa200
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
              : 'bg-[#080d16] border-[#182338] text-slate-400 hover:text-emerald-300'
          }`}
        >
          Price &gt; MA20, 50, 200
        </button>

        <div className="ml-auto text-[10px] text-slate-400">
          Showing <span className="text-cyan-300 font-bold">{totalFilteredCount}</span> of {totalCoinsCount} pairs
        </div>
      </div>

      {/* Advanced Drawer Filter Box */}
      {showAdvanced && (
        <div className="p-3.5 bg-[#090e18] border border-[#1a253b] rounded-xl space-y-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Bull Score Min */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase">Min Bull Score (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.bullMin ?? ''}
                onChange={e => onChange({ ...filters, bullMin: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="e.g. 60"
                className="w-full mt-1 bg-[#05080f] border border-[#1b253b] rounded-lg px-2 py-1 text-xs text-white"
              />
            </div>

            {/* Downside Risk Min */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase">Min Downside Risk (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.riskMin ?? ''}
                onChange={e => onChange({ ...filters, riskMin: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="e.g. 50"
                className="w-full mt-1 bg-[#05080f] border border-[#1b253b] rounded-lg px-2 py-1 text-xs text-white"
              />
            </div>

            {/* Volume Ratio Min */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase">Min Vol Ratio (vs 20-MA)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={filters.volRatioMin ?? ''}
                onChange={e => onChange({ ...filters, volRatioMin: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="e.g. 1.8"
                className="w-full mt-1 bg-[#05080f] border border-[#1b253b] rounded-lg px-2 py-1 text-xs text-white"
              />
            </div>

            {/* RSI Range */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase">RSI 14 Range (Min / Max)</label>
              <div className="flex items-center space-x-1 mt-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.rsiMin ?? ''}
                  onChange={e => onChange({ ...filters, rsiMin: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-1/2 bg-[#05080f] border border-[#1b253b] rounded-lg px-2 py-1 text-xs text-white"
                />
                <span className="text-slate-600">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.rsiMax ?? ''}
                  onChange={e => onChange({ ...filters, rsiMax: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-1/2 bg-[#05080f] border border-[#1b253b] rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* MA Checkbox filters */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#141e30]">
            <span className="text-[10px] text-slate-400 uppercase">Price Alignment:</span>

            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={filters.aboveMa20}
                onChange={e => onChange({ ...filters, aboveMa20: e.target.checked })}
                className="rounded accent-cyan-500"
              />
              <span>Price &gt; MA20</span>
            </label>

            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={filters.aboveMa50}
                onChange={e => onChange({ ...filters, aboveMa50: e.target.checked })}
                className="rounded accent-cyan-500"
              />
              <span>Price &gt; MA50</span>
            </label>

            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={filters.aboveMa200}
                onChange={e => onChange({ ...filters, aboveMa200: e.target.checked })}
                className="rounded accent-cyan-500"
              />
              <span>Price &gt; MA200</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
