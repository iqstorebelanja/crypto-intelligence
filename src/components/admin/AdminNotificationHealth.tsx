import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Cpu,
  Mail,
  MessageSquare,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  ShieldAlert,
  Sparkles,
  Zap
} from 'lucide-react';
import { NotificationChannel, NotificationHealthSummary, ProviderHealthState } from '../../types';
import { clientNotificationService } from '../../services/notificationService';

interface AdminNotificationHealthProps {
  token: string | null;
}

export const AdminNotificationHealth: React.FC<AdminNotificationHealthProps> = ({ token }) => {
  const [health, setHealth] = useState<NotificationHealthSummary | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [failures, setFailures] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      const [healthData, failureList] = await Promise.all([
        clientNotificationService.getAdminHealth(token),
        clientNotificationService.getAdminFailures(token)
      ]);
      setHealth(healthData.health);
      setLogs(healthData.logs || []);
      setFailures(failureList || []);
    } catch (err: any) {
      console.warn('Health fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const timer = setInterval(fetchHealthData, 10000); // 10s auto-refresh
    return () => clearInterval(timer);
  }, [token]);

  const handleRetry = async (attemptId: string) => {
    setRetryingId(attemptId);
    setStatusMsg(null);
    try {
      const res = await clientNotificationService.retryDelivery(token, attemptId);
      if (res.success) {
        setStatusMsg('Delivery retry successful!');
        fetchHealthData();
      } else {
        setStatusMsg(`Retry failed: ${res.message}`);
      }
    } catch (err: any) {
      setStatusMsg(`Retry error: ${err.message}`);
    } finally {
      setRetryingId(null);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleTriggerTest = async () => {
    setIsSendingTest(true);
    setStatusMsg(null);
    try {
      const ok = await clientNotificationService.sendTest(token, 'PRICE', 'BTC');
      if (ok) {
        setStatusMsg('Test alert queued into delivery pipeline.');
        fetchHealthData();
      } else {
        setStatusMsg('Failed to trigger test alert.');
      }
    } catch (err: any) {
      setStatusMsg(`Test error: ${err.message}`);
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const getStatusBadge = (st: ProviderHealthState) => {
    switch (st) {
      case 'HEALTHY':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-600/50">
            HEALTHY
          </span>
        );
      case 'CIRCUIT_OPEN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-600/60 animate-pulse">
            CIRCUIT OPEN
          </span>
        );
      case 'HALF_OPEN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/60">
            HALF OPEN
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/50">
            DEGRADED
          </span>
        );
      case 'NOT_CONFIGURED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-700">
            NOT CONFIGURED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700">
            ERROR
          </span>
        );
    }
  };

  const getChannelIcon = (ch: NotificationChannel) => {
    switch (ch) {
      case 'IN_APP':
        return <Bell className="w-4 h-4 text-cyan-400" />;
      case 'WEB_PUSH':
        return <Radio className="w-4 h-4 text-purple-400" />;
      case 'TELEGRAM':
        return <Send className="w-4 h-4 text-sky-400" />;
      case 'EMAIL':
        return <Mail className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs max-w-5xl">
      {/* Header bar */}
      <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                NOTIFICATION DELIVERY & RELIABILITY ENGINE
              </h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-700/50 font-bold">
                PHASE 17
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Centralized delivery queue, retry engine, deduplication and multi-channel health monitoring.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleTriggerTest}
            disabled={isSendingTest}
            className="px-3 py-1.5 rounded-lg bg-cyan-900/60 hover:bg-cyan-800/80 border border-cyan-500/40 text-cyan-200 font-bold transition-all flex items-center space-x-1.5 active:scale-95"
            title="Dispatch a test alert through pipeline"
          >
            <Zap className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-bounce' : 'text-cyan-400'}`} />
            <span>Test Pipeline</span>
          </button>

          <button
            type="button"
            onClick={fetchHealthData}
            disabled={loading}
            className="p-1.5 rounded-lg bg-[#141f33] hover:bg-[#1a2c4e] border border-[#233554] text-slate-300 transition-all"
            title="Refresh monitor"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-cyan-950/70 border border-cyan-600/50 text-cyan-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-[#090e18] border border-[#162236] rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 block font-bold">TOTAL DELIVERED</span>
          <span className="text-xl font-bold text-emerald-400">
            {health?.delivered ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">Across all channels</span>
        </div>

        <div className="p-3.5 bg-[#090e18] border border-[#162236] rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 block font-bold">CURRENT QUEUE DEPTH</span>
          <span className="text-xl font-bold text-cyan-400">
            {health?.totalQueued ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">Pending / deferred</span>
        </div>

        <div className="p-3.5 bg-[#090e18] border border-[#162236] rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 block font-bold">ACTIVE RETRIES</span>
          <span className="text-xl font-bold text-amber-400">
            {health?.retrying ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">With exponential backoff</span>
        </div>

        <div className="p-3.5 bg-[#090e18] border border-[#162236] rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 block font-bold">ERROR RATE</span>
          <span className={`text-xl font-bold ${health && health.errorRate > 0.1 ? 'text-rose-400' : 'text-slate-300'}`}>
            {health ? (health.errorRate * 100).toFixed(1) : 0}%
          </span>
          <span className="text-[10px] text-slate-500 block">
            {health?.failed ?? 0} total failure{health?.failed === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Channel Provider Health Grid */}
      <div className="p-4 bg-[#090e18] border border-[#162236] rounded-xl space-y-3">
        <h4 className="font-bold text-white text-xs border-b border-[#18263e] pb-2">
          DELIVERY CHANNEL PROVIDERS & CIRCUIT BREAKERS
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {health &&
            Object.entries(health.channels).map(([key, ch]) => (
              <div
                key={key}
                className="p-3 bg-[#0d1524] border border-[#1b2b46] rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getChannelIcon(ch.channel)}
                    <span className="font-bold text-white text-xs">{ch.channel}</span>
                  </div>
                  {getStatusBadge(ch.status)}
                </div>

                <div className="text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Provider:</span>
                    <span className="text-slate-200">{ch.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivered:</span>
                    <span className="text-emerald-400 font-bold">{ch.deliveredCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failures:</span>
                    <span className="text-rose-400 font-bold">{ch.failedCount}</span>
                  </div>
                  {ch.circuitBreakerOpen && (
                    <div className="p-1.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700/60 text-[10px]">
                      Circuit breaker tripped. Recovery pause active until:{' '}
                      {ch.circuitResetAt ? new Date(ch.circuitResetAt).toLocaleTimeString() : 'cooling down'}
                    </div>
                  )}
                  {ch.lastError && (
                    <div className="text-[10px] text-slate-400 truncate" title={ch.lastError}>
                      Last Error: <span className="text-rose-300">{ch.lastError}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Failed Deliveries & Dead Letter Queue (Section 35) */}
      <div className="p-4 bg-[#090e18] border border-[#162236] rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-[#18263e] pb-2">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h4 className="font-bold text-white text-xs">
              FAILED DELIVERIES & DEAD LETTER INSPECTOR
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            {failures.length} recorded failure{failures.length === 1 ? '' : 's'}
          </span>
        </div>

        {failures.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500/60" />
            <span>No dead letter failures. All active delivery attempts succeeded or were resolved.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[#1c2c47] text-slate-400">
                  <th className="py-2 px-2.5">CHANNEL</th>
                  <th className="py-2 px-2.5">NOTIFICATION</th>
                  <th className="py-2 px-2.5">ATTEMPTS</th>
                  <th className="py-2 px-2.5">ERROR CODE</th>
                  <th className="py-2 px-2.5">REASON</th>
                  <th className="py-2 px-2.5 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152338]">
                {failures.map(item => (
                  <tr key={item.id} className="hover:bg-[#111c30]">
                    <td className="py-2 px-2.5 font-bold text-slate-200">
                      {item.channel}
                    </td>
                    <td className="py-2 px-2.5 text-slate-400 font-mono text-[10px]">
                      {item.notificationId}
                    </td>
                    <td className="py-2 px-2.5 text-slate-300">
                      #{item.attemptNumber}
                    </td>
                    <td className="py-2 px-2.5">
                      <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[9px] font-bold">
                        {item.errorCode || 'FAILED'}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-slate-400 max-w-xs truncate" title={item.errorMessage}>
                      {item.errorMessage || 'No error description'}
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRetry(item.id)}
                        disabled={retryingId === item.id}
                        className="px-2 py-1 rounded bg-[#16233b] hover:bg-cyan-950/80 border border-[#273a5e] text-cyan-300 text-[10px] font-bold transition-all disabled:opacity-50"
                        title="Retry delivery idempotently"
                      >
                        {retryingId === item.id ? 'Retrying...' : 'Retry'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Structured Delivery Logs (Section 37) */}
      <div className="p-4 bg-[#090e18] border border-[#162236] rounded-xl space-y-3">
        <h4 className="font-bold text-white text-xs border-b border-[#18263e] pb-2">
          AUDITABLE STRUCTURED EVENT LOGS
        </h4>

        {logs.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-[11px]">
            No recent structured events recorded.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="p-2 rounded bg-[#0a1120] border border-[#16233a] flex items-center justify-between text-[10px]"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-bold px-1.5 py-0.2 rounded ${
                      log.event === 'DELIVERY_SUCCESS'
                        ? 'text-emerald-400 bg-emerald-950/60'
                        : log.event === 'DELIVERY_FAILED'
                        ? 'text-rose-400 bg-rose-950/60'
                        : log.event === 'NOTIFICATION_DEDUPED'
                        ? 'text-amber-400 bg-amber-950/60'
                        : 'text-cyan-400 bg-cyan-950/60'
                    }`}
                  >
                    {log.event}
                  </span>
                  {log.symbol && (
                    <span className="text-white font-bold">{log.symbol}</span>
                  )}
                  {log.channel && (
                    <span className="text-slate-400">[{log.channel}]</span>
                  )}
                </div>
                <span className="text-slate-400 truncate max-w-xs" title={log.message}>
                  {log.message || log.errorCode || ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
