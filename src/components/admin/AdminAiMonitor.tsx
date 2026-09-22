import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  RefreshCw,
  Zap
} from 'lucide-react';
import { AIErrorLogEntry } from '../../types';

interface AiTelemetryData {
  serviceStatus: string;
  configured: boolean;
  model: string;
  requestsToday: number;
  requestsThisHour: number;
  avgResponseTimeMs: number;
  toolUsage: Record<string, { calls: number; errors: number }>;
  recentErrors: AIErrorLogEntry[];
}

interface AdminAiMonitorProps {
  token: string | null;
}

export const AdminAiMonitor: React.FC<AdminAiMonitorProps> = ({ token }) => {
  const [data, setData] = useState<AiTelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAiMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/ai/metrics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to load AI metrics: HTTP ${res.status}`);
      const json: AiTelemetryData = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiMetrics();
    const interval = setInterval(fetchAiMetrics, 15000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
        Loading AI Trader & tool telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">AI ENGINE STATUS</span>
            <div className="flex items-center space-x-2">
              <span className={`text-base font-bold tracking-wider ${
                data?.configured ? 'text-purple-300' : 'text-amber-400'
              }`}>
                {data?.serviceStatus}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              {data?.configured ? 'API Connected' : 'NOT CONFIGURED'}
            </span>
          </div>
          <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-lg text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
        </div>

        {/* Requests Today */}
        <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">REQUESTS (24H)</span>
            <div className="text-base font-bold text-white tracking-wider">
              {data?.requestsToday}
            </div>
            <span className="text-[10px] text-slate-500">
              {data?.requestsThisHour} in the past hour
            </span>
          </div>
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Avg Latency */}
        <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">AVG LATENCY</span>
            <div className="text-base font-bold text-cyan-300">
              {data?.avgResponseTimeMs} ms
            </div>
            <span className="text-[10px] text-slate-500">End-to-end round trip</span>
          </div>
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Active Model */}
        <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">MODEL ARCHITECTURE</span>
            <div className="text-sm font-bold text-white truncate max-w-[140px]">
              {data?.model}
            </div>
            <span className="text-[10px] text-slate-500">Deterministic Tool Layer</span>
          </div>
          <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tool Invocation Matrix */}
      <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#182338] pb-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Controlled AI Tool Execution Metrics</h3>
          </div>
          <button
            onClick={fetchAiMetrics}
            className="flex items-center space-x-1 text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#182338] text-[11px] text-slate-400 font-bold uppercase">
                <th className="py-2.5 px-3">Tool Name</th>
                <th className="py-2.5 px-3">Purpose</th>
                <th className="py-2.5 px-3">Total Calls</th>
                <th className="py-2.5 px-3">Errors</th>
                <th className="py-2.5 px-3">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141e30] text-[11px]">
              {data && Object.entries(data.toolUsage).map(([name, stats]) => {
                const total = stats.calls;
                const errs = stats.errors;
                const successRate = total > 0 ? (((total - errs) / total) * 100).toFixed(1) : '100.0';
                return (
                  <tr key={name} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-cyan-300">
                      <code>{name}()</code>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {name === 'getMarketData' ? 'Real-time ticker, 24h stats & volume' :
                       name === 'getTechnicalIndicators' ? 'EMA, RSI, MACD, Bollinger calculations' :
                       name === 'getDerivatives' ? 'Open Interest, Funding Rate & Liquidations' :
                       name === 'getMarketStructure' ? 'BOS, ChoCH, Swing Highs & Lows' :
                       name === 'getScores' ? 'Bull Score & Downside Risk snapshots' :
                       name === 'getBTCContext' ? 'Bitcoin macro regime & dominance' :
                       name === 'getWhaleActivity' ? 'On-chain large transfers & whale transactions' :
                       name === 'scanMarket' ? 'Natural-language filter & ranking' :
                       name === 'compareCoins' ? 'Relative strength & derivative divergence' :
                       'Quantitative analytics subroutine'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{total}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-400">{errs}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        Number(successRate) >= 95
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                          : 'bg-amber-950 text-amber-300 border border-amber-700/50'
                      }`}>
                        {successRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Error Logs */}
      <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#182338] pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">AI Error & Timeout Telemetry</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {data?.recentErrors.length || 0} recorded incidents
          </span>
        </div>

        {data && data.recentErrors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#182338] text-[11px] text-slate-400 font-bold uppercase">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Request Type</th>
                  <th className="py-2.5 px-3">Tool</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Error Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141e30] text-[11px]">
                {data.recentErrors.map((err) => (
                  <tr key={err.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(err.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300">{err.user}</td>
                    <td className="py-2.5 px-3 text-slate-300">{err.requestType}</td>
                    <td className="py-2.5 px-3 text-purple-300">{err.tool || '--'}</td>
                    <td className="py-2.5 px-3 text-slate-400">{err.duration} ms</td>
                    <td className="py-2.5 px-3 text-rose-400 max-w-md truncate">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400/80 mb-1" />
            <span className="text-slate-300 font-bold">No AI Errors Recorded</span>
            <span className="text-slate-500 text-[11px]">All natural language parsing and tool calls executed cleanly.</span>
          </div>
        )}
      </div>
    </div>
  );
};
