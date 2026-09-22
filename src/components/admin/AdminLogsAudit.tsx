import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Info,
  RefreshCw,
  Search,
  Shield,
  Trash2
} from 'lucide-react';
import { AdminAuditLogEntry, SystemLogEntry, SystemLogLevel, SystemLogSource } from '../../types';

interface AdminLogsAuditProps {
  token: string | null;
}

export const AdminLogsAudit: React.FC<AdminLogsAuditProps> = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState<'system' | 'audit'>('system');
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // System log filters
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState('');
  const [clearingLogs, setClearingLogs] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = activeSubTab === 'system'
        ? `/api/admin/logs/system?level=${selectedLevel === 'ALL' ? '' : selectedLevel}&source=${selectedSource === 'ALL' ? '' : selectedSource}`
        : '/api/admin/logs/audit';

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to load logs: HTTP ${res.status}`);
      const json = await res.json();

      if (activeSubTab === 'system') {
        setSystemLogs(json);
      } else {
        setAuditLogs(json);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeSubTab, selectedLevel, selectedSource, token]);

  const handleClearSystemLogs = async () => {
    if (!confirm('Are you sure you want to clear system logs?')) return;
    try {
      setClearingLogs(true);
      const res = await fetch('/api/admin/logs/system/clear', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to clear logs');
      fetchLogs();
    } catch (err) {
      alert(`Clear logs failed: ${(err as Error).message}`);
    } finally {
      setClearingLogs(false);
    }
  };

  const filteredSystemLogs = systemLogs.filter(l => {
    if (!logSearch.trim()) return true;
    const q = logSearch.toLowerCase();
    return (
      l.message.toLowerCase().includes(q) ||
      (l.endpoint && l.endpoint.toLowerCase().includes(q)) ||
      l.source.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Tab Selector */}
      <div className="flex items-center justify-between border-b border-[#182338] pb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('system')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSubTab === 'system'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            System Event Logs ({systemLogs.length})
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSubTab === 'audit'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Administrative Audit Trail ({auditLogs.length})
          </button>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center space-x-1 text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {activeSubTab === 'system' ? (
        <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#182338] pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="bg-[#090e18] border border-[#21304a] rounded px-2.5 py-1 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              >
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>

              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-[#090e18] border border-[#21304a] rounded px-2.5 py-1 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              >
                <option value="ALL">All Sources</option>
                <option value="AUTH">AUTH</option>
                <option value="BINANCE">BINANCE</option>
                <option value="BYBIT">BYBIT</option>
                <option value="SCANNER">SCANNER</option>
                <option value="SCORING">SCORING</option>
                <option value="ALERT">ALERT</option>
                <option value="AI">AI</option>
                <option value="DATABASE">DATABASE</option>
                <option value="TELEGRAM">TELEGRAM</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>

              <input
                type="text"
                placeholder="Search log messages..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-[#090e18] border border-[#21304a] rounded px-2.5 py-1 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none w-48 sm:w-56"
              />
            </div>

            <button
              onClick={handleClearSystemLogs}
              disabled={clearingLogs}
              className="flex items-center space-x-1 px-3 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearingLogs ? 'Clearing...' : 'Clear Logs'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#182338] text-[11px] text-slate-400 font-bold uppercase">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Level</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Endpoint</th>
                  <th className="py-2.5 px-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141e30] text-[11px]">
                {filteredSystemLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.level === 'INFO' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                        log.level === 'WARNING' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        log.level === 'ERROR' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        'bg-red-900 text-white font-bold'
                      }`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-bold">{log.source}</td>
                    <td className="py-2.5 px-3 text-slate-400">{log.endpoint || '--'}</td>
                    <td className="py-2.5 px-3 text-slate-200 font-mono">
                      <div>{log.message}</div>
                      {log.metadata && (
                        <pre className="text-[10px] text-slate-400 bg-[#090e18] p-1 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredSystemLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono text-xs">
                      No system logs found for this filter combination.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
          <div className="border-b border-[#182338] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Immutable Administrative Action Audit Trail</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Tracks all configuration modifications, weights calibration, symbol toggles, and user privileges.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#182338] text-[11px] text-slate-400 font-bold uppercase">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141e30] text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-amber-400 font-bold">{log.adminUser}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300 font-bold">{log.target}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {log.metadata ? (
                        <pre className="text-[10px] text-slate-400 bg-[#090e18] p-1.5 rounded max-w-lg overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      ) : '--'}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono text-xs">
                      No administrative audit records logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
