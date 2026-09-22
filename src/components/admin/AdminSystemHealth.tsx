import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Power,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
  Zap
} from 'lucide-react';
import { DataFreshnessItem, ExchangeHealthDetail, FreshnessThresholds } from '../../types';

interface DetailedHealthData {
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  exchanges: Record<string, ExchangeHealthDetail>;
  freshnessThresholds: FreshnessThresholds;
  dataFreshness: DataFreshnessItem[];
  services: {
    database: { status: string; records: Record<string, number> };
    aiTrader: { status: string; model: string; configured: boolean };
    telegram: { status: string; configured: boolean; pendingQueue: number };
    whales: { status: string; configured: boolean; provider: string };
    alertEngine: { status: string; totalAlerts: number; activeAlerts: number };
  };
  cache: {
    hits: number;
    misses: number;
    hitRatioPercent: number;
    keysCount: number;
    lastPurge: number;
  };
}

interface AdminSystemHealthProps {
  token: string | null;
}

export const AdminSystemHealth: React.FC<AdminSystemHealthProps> = ({ token }) => {
  const [data, setData] = useState<DetailedHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<FreshnessThresholds>({
    liveMaxSec: 15,
    delayedMaxSec: 60,
    staleMinSec: 60
  });
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdMsg, setThresholdMsg] = useState<string | null>(null);
  const [purgingCache, setPurgingCache] = useState(false);
  const [togglingExchange, setTogglingExchange] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/overview', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to load system health: HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      if (json.freshnessThresholds) {
        setThresholds(json.freshnessThresholds);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingThresholds(true);
      setThresholdMsg(null);
      const res = await fetch('/api/admin/freshness/thresholds', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(thresholds)
      });
      if (!res.ok) throw new Error('Failed to update thresholds');
      setThresholdMsg('Freshness thresholds updated successfully');
      setTimeout(() => setThresholdMsg(null), 4000);
      fetchHealth();
    } catch (err) {
      setThresholdMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSavingThresholds(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!confirm('Are you sure you want to flush all system cache? Market data will be fetched fresh from upstream.')) {
      return;
    }
    try {
      setPurgingCache(true);
      const res = await fetch('/api/admin/cache/purge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to purge cache');
      fetchHealth();
    } catch (err) {
      alert(`Purge failed: ${(err as Error).message}`);
    } finally {
      setPurgingCache(false);
    }
  };

  const handleToggleExchange = async (exchangeId: string) => {
    try {
      setTogglingExchange(exchangeId);
      const res = await fetch(`/api/admin/exchanges/${exchangeId}/toggle`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to toggle exchange');
      fetchHealth();
    } catch (err) {
      alert(`Exchange toggle failed: ${(err as Error).message}`);
    } finally {
      setTogglingExchange(null);
    }
  };

  const formatUptime = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
        Loading system telemetry & telemetry matrix...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-rose-950/20 border border-rose-800/40 rounded-xl text-rose-300 font-mono text-xs space-y-2">
        <div className="flex items-center space-x-2 font-bold text-sm text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          <span>Telemetry Connection Error</span>
        </div>
        <p>{error}</p>
        <button
          onClick={fetchHealth}
          className="px-3 py-1 bg-rose-800/40 hover:bg-rose-700/60 rounded border border-rose-600 text-rose-200 mt-2"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Vital KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Health */}
        <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">SYSTEM STATUS</span>
            <div className="flex items-center space-x-2">
              <span className={`text-base font-bold tracking-wider ${
                data?.status === 'HEALTHY' ? 'text-emerald-400' :
                data?.status === 'DEGRADED' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {data?.status}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">Autonomous Monitoring</span>
          </div>
          <div className={`p-3 rounded-lg ${
            data?.status === 'HEALTHY' ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400' :
            data?.status === 'DEGRADED' ? 'bg-amber-950/40 border border-amber-500/30 text-amber-400' :
            'bg-rose-950/40 border border-rose-500/30 text-rose-400'
          }`}>
            <Server className="w-5 h-5" />
          </div>
        </div>

        {/* Uptime */}
        <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">PROCESS UPTIME</span>
            <div className="text-base font-bold text-white tracking-wider">
              {data ? formatUptime(data.uptimeSeconds) : '--'}
            </div>
            <span className="text-[10px] text-slate-500">Continuous Service</span>
          </div>
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Memory Footprint */}
        <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">MEMORY FOOTPRINT</span>
            <div className="text-base font-bold text-cyan-300">
              {data?.memory.heapUsedMb} <span className="text-xs text-slate-400">/ {data?.memory.heapTotalMb} MB</span>
            </div>
            <span className="text-[10px] text-slate-500">RSS: {data?.memory.rssMb} MB</span>
          </div>
          <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-lg text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        {/* Cache Hit Ratio */}
        <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">CACHE HIT RATIO</span>
            <div className="text-base font-bold text-emerald-400">
              {data?.cache.hitRatioPercent}%
            </div>
            <span className="text-[10px] text-slate-500">
              {data?.cache.hits} Hits / {data?.cache.misses} Misses
            </span>
          </div>
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-400">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Exchange Status Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Exchange Integration Telemetry</span>
          </h3>
          <button
            onClick={fetchHealth}
            className="flex items-center space-x-1 text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data && Object.values(data.exchanges).map((ex) => (
            <div
              key={ex.id}
              className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#182338] pb-3">
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    ex.status === 'Operational' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' :
                    ex.status === 'Degraded' ? 'bg-amber-400' : 'bg-rose-400'
                  }`} />
                  <span className="font-bold text-white text-sm">{ex.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {ex.id}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    ex.status === 'Operational' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/40' :
                    ex.status === 'Degraded' ? 'bg-amber-950/60 text-amber-300 border border-amber-600/40' :
                    'bg-rose-950/60 text-rose-300 border border-rose-600/40'
                  }`}>
                    {ex.status}
                  </span>
                  <button
                    onClick={() => handleToggleExchange(ex.id)}
                    disabled={togglingExchange === ex.id}
                    title={ex.status === 'Offline' ? 'Enable exchange' : 'Disable exchange'}
                    className={`p-1 rounded border transition-all ${
                      ex.status === 'Offline'
                        ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-emerald-400'
                        : 'bg-rose-950/30 text-rose-400 border-rose-800/40 hover:bg-rose-900/50'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 bg-[#090e18] rounded border border-[#152033]">
                  <div className="text-slate-400 text-[10px]">LATENCY</div>
                  <div className={`font-bold ${ex.latencyMs < 300 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {ex.latencyMs} ms
                  </div>
                </div>
                <div className="p-2 bg-[#090e18] rounded border border-[#152033]">
                  <div className="text-slate-400 text-[10px]">ERROR RATE</div>
                  <div className={`font-bold ${ex.errorRatePercent > 5 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {ex.errorRatePercent}%
                  </div>
                </div>
                <div className="p-2 bg-[#090e18] rounded border border-[#152033]">
                  <div className="text-slate-400 text-[10px]">TOTAL REQS</div>
                  <div className="font-bold text-slate-200">
                    {ex.requestCount} ({ex.failedRequests} fail)
                  </div>
                </div>
                <div className="p-2 bg-[#090e18] rounded border border-[#152033]">
                  <div className="text-slate-400 text-[10px]">RATE LIMIT</div>
                  <div className={`font-bold ${
                    ex.rateLimitStatus === 'Normal' ? 'text-emerald-400' :
                    ex.rateLimitStatus === 'Elevated' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {ex.rateLimitStatus}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>Last successful request: {new Date(ex.lastSuccessfulRequest).toLocaleTimeString()}</span>
                <span>Active Pairs: {ex.pairsCount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service Dependencies Matrix */}
      <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Core Subsystem Dependencies</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
          {/* Database */}
          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>In-Memory Datastore</span>
              </div>
              <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/50 text-[10px]">
                {data?.services.database.status}
              </span>
            </div>
            <div className="text-slate-400 text-[10px] space-y-0.5">
              <div>Users: {data?.services.database.records.users} | Alerts: {data?.services.database.records.alerts}</div>
              <div>Watchlists: {data?.services.database.records.watchlists} | Logs: {data?.services.database.records.logs}</div>
            </div>
          </div>

          {/* AI Trader */}
          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>AI Trader Subsystem</span>
              </div>
              <span className={`px-1.5 py-0.2 rounded border text-[10px] ${
                data?.services.aiTrader.configured
                  ? 'bg-purple-950 text-purple-300 border-purple-700/50'
                  : 'bg-amber-950/80 text-amber-300 border-amber-700/50'
              }`}>
                {data?.services.aiTrader.status}
              </span>
            </div>
            <div className="text-slate-400 text-[10px]">
              <div>Engine: {data?.services.aiTrader.model}</div>
              <div>Key: {data?.services.aiTrader.configured ? 'Configured (Server-side)' : 'NOT CONFIGURED (Simulated)'}</div>
            </div>
          </div>

          {/* Telegram */}
          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                <span>Telegram Bot Dispatcher</span>
              </div>
              <span className={`px-1.5 py-0.2 rounded border text-[10px] ${
                data?.services.telegram.configured
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {data?.services.telegram.status}
              </span>
            </div>
            <div className="text-slate-400 text-[10px]">
              <div>Bot Token: {data?.services.telegram.configured ? 'Active' : 'NOT CONFIGURED'}</div>
              <div>Pending Dispatch Queue: {data?.services.telegram.pendingQueue}</div>
            </div>
          </div>

          {/* Whale Intelligence */}
          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Whale Radar Architecture</span>
              </div>
              <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50 text-[10px]">
                {data?.services.whales.status}
              </span>
            </div>
            <div className="text-slate-400 text-[10px]">
              <div>Provider: {data?.services.whales.provider}</div>
              <div>State: {data?.services.whales.configured ? 'API Connected' : 'Simulated Active'}</div>
            </div>
          </div>

          {/* Alert Engine */}
          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>Alert Evaluation Engine</span>
              </div>
              <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50 text-[10px]">
                {data?.services.alertEngine.status}
              </span>
            </div>
            <div className="text-slate-400 text-[10px]">
              <div>Active Rules: {data?.services.alertEngine.activeAlerts}</div>
              <div>Total Evaluated: {data?.services.alertEngine.totalAlerts}</div>
            </div>
          </div>

          {/* Cache Controller */}
          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cache Management</span>
              </div>
              <button
                onClick={handlePurgeCache}
                disabled={purgingCache}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] transition-all"
              >
                <Trash2 className="w-3 h-3" />
                <span>{purgingCache ? 'Purging...' : 'Purge Cache'}</span>
              </button>
            </div>
            <div className="text-slate-400 text-[10px]">
              <div>Total Cached Keys: {data?.cache.keysCount}</div>
              <div>Last Purged: {data?.cache.lastPurge ? new Date(data.cache.lastPurge).toLocaleTimeString() : 'Never'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Freshness Thresholds Configuration */}
      <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Data Freshness Thresholds</span>
          </h3>
          {thresholdMsg && (
            <span className="text-[11px] text-emerald-400 font-semibold">{thresholdMsg}</span>
          )}
        </div>

        <form onSubmit={handleSaveThresholds} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <label className="text-slate-400 text-[11px] flex items-center justify-between">
              <span>LIVE MAX (SEC)</span>
              <span className="text-emerald-400 font-bold">&le; {thresholds.liveMaxSec}s</span>
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={thresholds.liveMaxSec}
              onChange={(e) => setThresholds({ ...thresholds, liveMaxSec: parseInt(e.target.value) || 15 })}
              className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Items updated within this window display as LIVE.</p>
          </div>

          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <label className="text-slate-400 text-[11px] flex items-center justify-between">
              <span>DELAYED MAX (SEC)</span>
              <span className="text-amber-400 font-bold">&le; {thresholds.delayedMaxSec}s</span>
            </label>
            <input
              type="number"
              min="10"
              max="300"
              value={thresholds.delayedMaxSec}
              onChange={(e) => setThresholds({ ...thresholds, delayedMaxSec: parseInt(e.target.value) || 60 })}
              className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Items aged between Live and Delayed window display as DELAYED.</p>
          </div>

          <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
            <label className="text-slate-400 text-[11px] flex items-center justify-between">
              <span>STALE MIN (SEC)</span>
              <span className="text-rose-400 font-bold">&gt; {thresholds.staleMinSec}s</span>
            </label>
            <input
              type="number"
              min="30"
              max="600"
              value={thresholds.staleMinSec}
              onChange={(e) => setThresholds({ ...thresholds, staleMinSec: parseInt(e.target.value) || 60 })}
              className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Items exceeding this threshold trigger a STALE warning.</p>
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={savingThresholds}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all disabled:opacity-50"
            >
              {savingThresholds ? 'Saving...' : 'Save Thresholds'}
            </button>
          </div>
        </form>
      </div>

      {/* Live Data Freshness Matrix */}
      <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Market Data Freshness Matrix</span>
          </h3>
          <span className="text-[10px] text-slate-500">
            {data?.dataFreshness.length || 0} trackable streams
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#182338] text-[11px] text-slate-400 font-bold uppercase">
                <th className="py-2.5 px-3">Data Stream</th>
                <th className="py-2.5 px-3">Exchange</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Timeframe</th>
                <th className="py-2.5 px-3">Age (sec)</th>
                <th className="py-2.5 px-3">Last Timestamp</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141e30] text-[11px]">
              {data && data.dataFreshness.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2 px-3 font-semibold text-white flex items-center space-x-2">
                    <span className="text-cyan-400">&bull;</span>
                    <span>{item.dataType}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-300">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                      {item.exchange}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-cyan-300 font-bold">{item.symbol}</td>
                  <td className="py-2 px-3 text-slate-400">{item.timeframe}</td>
                  <td className="py-2 px-3 font-bold text-slate-200">{item.ageSeconds}s</td>
                  <td className="py-2 px-3 text-slate-400">
                    {new Date(item.lastUpdate).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.status === 'LIVE' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40' :
                      item.status === 'DELAYED' ? 'bg-amber-950/80 text-amber-300 border border-amber-600/40' :
                      'bg-rose-950/80 text-rose-300 border border-rose-600/40'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
