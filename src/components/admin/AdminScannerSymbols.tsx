import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle,
  Database,
  Filter,
  Layers,
  Power,
  RefreshCw,
  Save,
  Search,
  Sliders,
  XCircle
} from 'lucide-react';
import { ExchangeId, ManagedSymbol, ScannerAdminConfig, Timeframe } from '../../types';

interface AdminScannerSymbolsProps {
  token: string | null;
}

export const AdminScannerSymbols: React.FC<AdminScannerSymbolsProps> = ({ token }) => {
  const [config, setConfig] = useState<ScannerAdminConfig | null>(null);
  const [symbols, setSymbols] = useState<ManagedSymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scanner config form
  const [minVolume, setMinVolume] = useState<number>(5000000);
  const [volumeSpikeThreshold, setVolumeSpikeThreshold] = useState<number>(2.0);
  const [maxPairs, setMaxPairs] = useState<number>(50);
  const [pollingIntervalSec, setPollingIntervalSec] = useState<number>(15);
  const [cacheDurationSec, setCacheDurationSec] = useState<number>(15);
  const [supportedTimeframes, setSupportedTimeframes] = useState<Timeframe[]>(['15m', '1h', '4h', '1D']);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  // Symbols list filter & toggle
  const [searchFilter, setSearchFilter] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | ExchangeId>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [togglingSymbol, setTogglingSymbol] = useState<string | null>(null);
  const [symbolNotice, setSymbolNotice] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [confRes, symRes] = await Promise.all([
        fetch('/api/admin/scanner/config', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/symbols', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!confRes.ok || !symRes.ok) throw new Error('Failed to fetch scanner configuration or symbols');

      const confJson: ScannerAdminConfig = await confRes.json();
      const symJson: ManagedSymbol[] = await symRes.json();

      setConfig(confJson);
      setMinVolume(confJson.minVolume);
      setVolumeSpikeThreshold(confJson.volumeSpikeThreshold);
      setMaxPairs(confJson.maxPairs);
      setPollingIntervalSec(confJson.pollingIntervalSec);
      setCacheDurationSec(confJson.cacheDurationSec);
      setSupportedTimeframes(confJson.supportedTimeframes || ['15m', '1h', '4h', '1D']);

      setSymbols(symJson);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSaveScannerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      setConfigMsg(null);
      const res = await fetch('/api/admin/scanner/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          minVolume,
          volumeSpikeThreshold,
          maxPairs,
          pollingIntervalSec,
          cacheDurationSec,
          supportedTimeframes
        })
      });
      if (!res.ok) throw new Error('Failed to update scanner config');
      setConfigMsg('Scanner parameters updated successfully');
      setTimeout(() => setConfigMsg(null), 4000);
      fetchData();
    } catch (err) {
      setConfigMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleSymbol = async (symbolItem: ManagedSymbol) => {
    try {
      setTogglingSymbol(symbolItem.symbol);
      setSymbolNotice(null);
      const encoded = encodeURIComponent(symbolItem.symbol);
      const res = await fetch(`/api/admin/symbols/${encoded}/toggle`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to toggle symbol');
      setSymbolNotice(json.message || `Symbol status updated to ${json.symbol.status}`);
      setTimeout(() => setSymbolNotice(null), 5000);
      fetchData();
    } catch (err) {
      alert(`Toggle failed: ${(err as Error).message}`);
    } finally {
      setTogglingSymbol(null);
    }
  };

  const filteredSymbols = symbols.filter(s => {
    if (exchangeFilter !== 'ALL' && s.exchange !== exchangeFilter) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        s.symbol.toLowerCase().includes(q) ||
        s.formattedSymbol.toLowerCase().includes(q) ||
        s.baseAsset.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const allTimeframes: Timeframe[] = ['15m', '1h', '4h', '1D'];

  const toggleTimeframe = (tf: Timeframe) => {
    if (supportedTimeframes.includes(tf)) {
      if (supportedTimeframes.length > 1) {
        setSupportedTimeframes(supportedTimeframes.filter(t => t !== tf));
      }
    } else {
      setSupportedTimeframes([...supportedTimeframes, tf]);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
        Loading scanner parameters & managed pairs registry...
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Scanner Global Engine Configuration */}
      <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#182338] pb-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Market Scanner Calibration</h3>
          </div>
          {configMsg && (
            <span className="text-[11px] text-emerald-400 font-bold">{configMsg}</span>
          )}
        </div>

        <form onSubmit={handleSaveScannerConfig} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>MIN 24H VOLUME ($ USD)</span>
                <span className="text-cyan-300 font-bold">${(minVolume / 1000000).toFixed(1)}M</span>
              </label>
              <input
                type="number"
                min="100000"
                step="100000"
                value={minVolume}
                onChange={(e) => setMinVolume(Number(e.target.value) || 0)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">Pairs below this threshold are excluded from high-priority scan sweeps.</p>
            </div>

            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>VOLUME SPIKE THRESHOLD</span>
                <span className="text-cyan-300 font-bold">{volumeSpikeThreshold}x</span>
              </label>
              <input
                type="number"
                min="1.1"
                max="10.0"
                step="0.1"
                value={volumeSpikeThreshold}
                onChange={(e) => setVolumeSpikeThreshold(parseFloat(e.target.value) || 2.0)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">Multiple of 20-period moving average required to trigger a Volume Surge flag.</p>
            </div>

            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>MAX PAIRS TO TRACK</span>
                <span className="text-cyan-300 font-bold">{maxPairs}</span>
              </label>
              <input
                type="number"
                min="10"
                max="200"
                value={maxPairs}
                onChange={(e) => setMaxPairs(parseInt(e.target.value) || 50)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">Top liquidity candidates fetched per exchange cycle.</p>
            </div>

            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>POLLING INTERVAL (SEC)</span>
                <span className="text-cyan-300 font-bold">{pollingIntervalSec}s</span>
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={pollingIntervalSec}
                onChange={(e) => setPollingIntervalSec(parseInt(e.target.value) || 15)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">Upstream exchange background sweep rate.</p>
            </div>

            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>CACHE DURATION (SEC)</span>
                <span className="text-cyan-300 font-bold">{cacheDurationSec}s</span>
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={cacheDurationSec}
                onChange={(e) => setCacheDurationSec(parseInt(e.target.value) || 15)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">In-memory TTL to prevent upstream exchange rate limiting.</p>
            </div>

            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px]">SUPPORTED TIMEFRAMES</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allTimeframes.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => toggleTimeframe(tf)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      supportedTimeframes.includes(tf)
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">Timeframes calculated for indicators and structure.</p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingConfig}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? 'Saving...' : 'Save Scanner Parameters'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Managed Symbols Registry */}
      <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#182338] pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Managed Symbols & Pairs Registry</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Preservation Guarantee: Disabling a symbol pauses real-time tracking while safely retaining all historical candles, scores, and alerts.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-[#090e18] border border-[#21304a] rounded pl-8 pr-2.5 py-1 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none w-36 sm:w-44"
              />
            </div>

            <select
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value as any)}
              className="bg-[#090e18] border border-[#21304a] rounded px-2 py-1 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Exchanges</option>
              <option value="BINANCE">Binance</option>
              <option value="BYBIT">Bybit</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#090e18] border border-[#21304a] rounded px-2 py-1 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE only</option>
              <option value="DISABLED">DISABLED only</option>
            </select>
          </div>
        </div>

        {symbolNotice && (
          <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-cyan-300 text-[11px] flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{symbolNotice}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#182338] text-[11px] text-slate-400 font-bold uppercase">
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Exchange</th>
                <th className="py-2.5 px-3">Asset Pair</th>
                <th className="py-2.5 px-3">Market Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Last Polled</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141e30] text-[11px]">
              {filteredSymbols.map((item) => (
                <tr key={`${item.exchange}_${item.symbol}`} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-white">
                    {item.formattedSymbol || item.symbol}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {item.exchange}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {item.baseAsset} / {item.quoteAsset}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-[#101726] border border-[#1b273d] text-[10px]">
                      {item.marketType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {item.lastDataUpdate ? new Date(item.lastDataUpdate).toLocaleTimeString() : 'Active cycle'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleToggleSymbol(item)}
                      disabled={togglingSymbol === item.symbol}
                      className={`px-3 py-1 rounded text-[11px] font-bold transition-all ${
                        item.status === 'ACTIVE'
                          ? 'bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800/60 text-rose-300'
                          : 'bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-800/60 text-emerald-300'
                      }`}
                    >
                      {togglingSymbol === item.symbol
                        ? 'Toggling...'
                        : item.status === 'ACTIVE'
                        ? 'Disable Symbol'
                        : 'Enable Symbol'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSymbols.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                    No managed symbols match current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
