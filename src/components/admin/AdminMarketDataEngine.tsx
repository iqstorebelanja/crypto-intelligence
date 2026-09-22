import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Layers,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react';
import { ExchangeId } from '../../types';

interface ExchangeCapabilityItem {
  exchange: ExchangeId;
  spot: boolean;
  futures: boolean;
  perpetual: boolean;
  swap: boolean;
  ohlcv: boolean;
  openInterest: boolean;
  funding: boolean;
  liquidations: boolean;
  orderBook: boolean;
  trades: boolean;
  markPrice: boolean;
  indexPrice: boolean;
  websocket: boolean;
  restFallback: boolean;
  status: 'LIVE' | 'PARTIAL' | 'OFFLINE' | 'DEGRADED';
  supportedTimeframes: string[];
}

interface StreamMetricItem {
  exchange: ExchangeId;
  status: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'RECONNECTING';
  isWebSocketActive: boolean;
  isRestFallbackActive: boolean;
  messagesReceived: number;
  lastMessageAt: number;
  reconnectCount: number;
  latencyMs: number;
  lastError: string | null;
}

interface PipelineMetricsData {
  streams: StreamMetricItem[];
  singleFlight: {
    inFlightCount: number;
    deduplicatedCount: number;
    totalExecutions: number;
    rateLimitHits: number;
    circuitBreaks: number;
  };
  cache: {
    size: number;
    hitRatio: number;
    hits: number;
    misses: number;
  };
  capabilities: ExchangeCapabilityItem[];
  logs: Array<{
    id: string;
    timestamp: number;
    exchange: ExchangeId;
    market?: string;
    operation: string;
    errorCode?: string;
    message: string;
    retryCount?: number;
    latency?: number;
  }>;
}

export const AdminMarketDataEngine: React.FC<{ token: string | null }> = ({ token }) => {
  const [data, setData] = useState<PipelineMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/market/pipeline/metrics', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pipeline metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTestSuite = async () => {
    try {
      setRunningTests(true);
      const res = await fetch('/api/admin/phase6/test-suite');
      const json = await res.json();
      setTestResults(json.results || []);
      setActionMessage(`Phase 6 Test Suite completed: ${json.passedTests}/${json.totalTests} passed`);
    } catch (err: any) {
      setActionMessage(`Test Suite failed: ${err.message}`);
    } finally {
      setRunningTests(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const timer = setInterval(fetchMetrics, 10000);
    return () => clearInterval(timer);
  }, [token]);

  const handleSimulateDisconnect = async (exchange: ExchangeId) => {
    try {
      setSimulating(exchange);
      setActionMessage(null);
      const res = await fetch('/api/market/pipeline/simulate-ws-disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange })
      });
      const json = await res.json();
      setActionMessage(json.message || `Simulated WebSocket disconnect for ${exchange}`);
      await fetchMetrics();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  };

  const handleRestoreWs = async (exchange: ExchangeId) => {
    try {
      setSimulating(exchange);
      setActionMessage(null);
      const res = await fetch('/api/market/pipeline/restore-ws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange })
      });
      const json = await res.json();
      setActionMessage(json.message || `Restored WebSocket for ${exchange}`);
      await fetchMetrics();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#0b101c] border border-[#1a2538] rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wider">
                MARKET DATA PIPELINE & REALTIME ENGINE
              </h2>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-600/40 text-[10px] font-bold">
                PHASE 6 ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Production multi-exchange streaming, WebSocket with REST fallback, and single-flight coalescing.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-center">
          <button
            onClick={handleRunTestSuite}
            disabled={runningTests}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-bold transition-all"
          >
            <Activity className={`w-3.5 h-3.5 text-emerald-400 ${runningTests ? 'animate-pulse' : ''}`} />
            <span>{runningTests ? 'Running Phase 6 Tests...' : 'Run Engine Test Suite'}</span>
          </button>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#141e30] hover:bg-[#1b2840] border border-[#23334d] text-slate-300 text-xs font-bold transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-700/50 rounded-xl text-xs text-cyan-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white text-[10px]">
            Dismiss
          </button>
        </div>
      )}

      {testResults && (
        <div className="p-4 bg-[#0a1120] border border-cyan-800/40 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white tracking-wider">
                PHASE 6 AUTOMATED TEST SUITE RESULTS ({testResults.filter(t => t.passed).length}/{testResults.length} PASSED)
              </h3>
            </div>
            <button
              onClick={() => setTestResults(null)}
              className="text-[10px] text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {testResults.map(test => (
              <div
                key={test.testId}
                className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-1 ${
                  test.passed
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-[11px]">
                  <span>{test.testId}: {test.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40">
                    {test.durationMs}ms
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  {test.details}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-700/50 rounded-xl text-xs text-rose-300">
          Telemetry Error: {error}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-[#090e18] border border-[#172236] space-y-1">
          <div className="text-[10px] uppercase text-slate-400 flex items-center justify-between">
            <span>Single-Flight Deduplication</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300">
            {data?.singleFlight.deduplicatedCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">
            {data?.singleFlight.inFlightCount ?? 0} active in-flight requests
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#090e18] border border-[#172236] space-y-1">
          <div className="text-[10px] uppercase text-slate-400 flex items-center justify-between">
            <span>Cache Hit Rate</span>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400">
            {data?.cache.hitRatio ?? 0}%
          </div>
          <div className="text-[10px] text-slate-500">
            {data?.cache.size ?? 0} cached market items
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#090e18] border border-[#172236] space-y-1">
          <div className="text-[10px] uppercase text-slate-400 flex items-center justify-between">
            <span>Rate Limit Events</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-bold text-rose-400">
            {data?.singleFlight.rateLimitHits ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">
            {data?.singleFlight.circuitBreaks ?? 0} circuit breaker cooldowns
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#090e18] border border-[#172236] space-y-1">
          <div className="text-[10px] uppercase text-slate-400 flex items-center justify-between">
            <span>Active Exchanges</span>
            <Server className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-400">
            {data?.capabilities.length ?? 4}
          </div>
          <div className="text-[10px] text-slate-500">
            BINANCE • OKX • PIONEX • BYBIT
          </div>
        </div>
      </div>

      {/* Exchange Connection Status & Failover Controls */}
      <div className="p-5 bg-[#090e18] border border-[#172236] rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
              <Wifi className="w-4 h-4 text-cyan-400" />
              EXCHANGE STREAMS & WEBSOCKET / REST STATUS
            </h3>
            <p className="text-xs text-slate-400">
              Real-time WebSocket streaming with automatic fallback to REST polling on disconnection.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data?.streams.map((stream) => (
            <div
              key={stream.exchange}
              className="p-4 bg-[#0d1424] border border-[#1e2c45] rounded-xl space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm tracking-wider">
                    {stream.exchange}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      stream.status === 'CONNECTED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                        : stream.status === 'DEGRADED'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700/50'
                        : 'bg-rose-950 text-rose-300 border border-rose-700/50'
                    }`}
                  >
                    {stream.status}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {stream.status === 'CONNECTED' ? (
                    <button
                      onClick={() => handleSimulateDisconnect(stream.exchange)}
                      disabled={simulating === stream.exchange}
                      className="px-2 py-1 bg-amber-950/60 hover:bg-amber-900 border border-amber-700/50 text-amber-300 rounded text-[10px] font-bold transition-all"
                      title="Simulate WS disconnect to test REST fallback"
                    >
                      Simulate Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRestoreWs(stream.exchange)}
                      disabled={simulating === stream.exchange}
                      className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 rounded text-[10px] font-bold transition-all"
                    >
                      Restore WebSocket
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 bg-[#080d16] p-2.5 rounded-lg border border-[#152033]">
                <div>
                  WebSocket Stream:{' '}
                  <strong className={stream.isWebSocketActive ? 'text-emerald-400' : 'text-slate-500'}>
                    {stream.isWebSocketActive ? 'ACTIVE' : 'OFFLINE'}
                  </strong>
                </div>
                <div>
                  REST Fallback:{' '}
                  <strong className={stream.isRestFallbackActive ? 'text-amber-400' : 'text-slate-500'}>
                    {stream.isRestFallbackActive ? 'ACTIVE' : 'STANDBY'}
                  </strong>
                </div>
                <div>
                  Messages Received:{' '}
                  <strong className="text-white">{stream.messagesReceived.toLocaleString()}</strong>
                </div>
                <div>
                  Reconnects:{' '}
                  <strong className={stream.reconnectCount > 0 ? 'text-amber-400' : 'text-slate-400'}>
                    {stream.reconnectCount}
                  </strong>
                </div>
                <div className="col-span-2 flex justify-between">
                  <span>Latency: <strong className="text-cyan-400">{stream.latencyMs}ms</strong></span>
                  <span>
                    Last Message:{' '}
                    <strong className="text-slate-300">
                      {stream.lastMessageAt ? `${Math.round((Date.now() - stream.lastMessageAt) / 1000)}s ago` : 'N/A'}
                    </strong>
                  </span>
                </div>
              </div>

              {stream.lastError && (
                <div className="text-[10px] text-rose-400 bg-rose-950/30 p-1.5 rounded border border-rose-900/40 truncate">
                  Error: {stream.lastError}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Capability Registry Matrix */}
      <div className="p-5 bg-[#090e18] border border-[#172236] rounded-2xl space-y-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            EXCHANGE CAPABILITY REGISTRY
          </h3>
          <p className="text-xs text-slate-400">
            Actual verified adapter capabilities. Missing features are displayed as N/A and never fabricated.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[11px] text-slate-400">
                <th className="pb-2.5 font-bold">Exchange</th>
                <th className="pb-2.5 font-bold text-center">Spot</th>
                <th className="pb-2.5 font-bold text-center">Futures</th>
                <th className="pb-2.5 font-bold text-center">Perpetual</th>
                <th className="pb-2.5 font-bold text-center">OHLCV</th>
                <th className="pb-2.5 font-bold text-center">Open Interest</th>
                <th className="pb-2.5 font-bold text-center">Funding</th>
                <th className="pb-2.5 font-bold text-center">Liquidations</th>
                <th className="pb-2.5 font-bold text-center">Order Book</th>
                <th className="pb-2.5 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141f33]">
              {data?.capabilities.map((cap) => (
                <tr key={cap.exchange} className="hover:bg-slate-900/30 transition-colors">
                  <td className="py-3 font-bold text-white tracking-wider flex items-center gap-1.5">
                    {cap.exchange}
                  </td>
                  <td className="py-3 text-center">
                    {cap.spot ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 text-center">
                    {cap.futures ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 text-center">
                    {cap.perpetual ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 text-center">
                    {cap.ohlcv ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 text-center">
                    {cap.openInterest ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">N/A</span>}
                  </td>
                  <td className="py-3 text-center">
                    {cap.funding ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">N/A</span>}
                  </td>
                  <td className="py-3 text-center">
                    {cap.liquidations ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">N/A</span>}
                  </td>
                  <td className="py-3 text-center">
                    {cap.orderBook ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cap.status === 'LIVE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                          : 'bg-amber-950 text-amber-300 border border-amber-700/50'
                      }`}
                    >
                      {cap.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Structured Pipeline Logs */}
      <div className="p-5 bg-[#090e18] border border-[#172236] rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              STRUCTURED PIPELINE LOGS & INCIDENTS
            </h3>
            <p className="text-xs text-slate-400">
              Audit log of stream transitions, validation outcomes, rate limit events, and fallback activations.
            </p>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
          {data?.logs && data.logs.length > 0 ? (
            data.logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-[#0d1424] border border-[#19253c] rounded-lg text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 font-mono text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                    {log.exchange}
                  </span>
                  {log.errorCode && (
                    <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/40 text-[10px] font-bold">
                      {log.errorCode}
                    </span>
                  )}
                  <span className="text-slate-300">{log.message}</span>
                </div>
                {log.market && (
                  <span className="text-slate-400 text-[10px] self-start sm:self-center font-bold">
                    {log.market}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-500 text-xs">
              No recent pipeline incidents or errors. Pipeline is running cleanly.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
