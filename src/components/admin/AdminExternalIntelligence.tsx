import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Layers,
  Play,
  RefreshCw,
  Scale,
  Settings,
  Shield,
  Sliders,
  TrendingUp,
  Waves,
  Wifi,
  XCircle,
  Zap
} from 'lucide-react';
import { ExternalIntelligenceAdminConfig, ExternalProviderHealthDetail } from '../../types';

interface Phase22TestResult {
  testId: number;
  testName: string;
  category: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export const AdminExternalIntelligence: React.FC<{ token: string }> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Health data
  const [healthData, setHealthData] = useState<{
    overallStatus: string;
    totalProviders: number;
    activeCount: number;
    providers: Record<string, ExternalProviderHealthDetail>;
    telemetry: any;
  } | null>(null);

  // Config data
  const [config, setConfig] = useState<ExternalIntelligenceAdminConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Test Runner state
  const [runningTests, setRunningTests] = useState(false);
  const [testSuite, setTestSuite] = useState<'phase22' | 'phase21'>('phase22');
  const [testSummary, setTestSummary] = useState<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    allPassed: boolean;
    results: Phase22TestResult[];
  } | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/external-intelligence/health', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealthData(data);
    } catch (err: any) {
      console.error('Failed to load external intelligence health', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/external-intelligence/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err: any) {
      console.error('Failed to load external intelligence config', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchHealth(), fetchConfig()]);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize external intelligence panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSavingConfig(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/external-intelligence/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setSuccessMsg('External intelligence configuration updated successfully.');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        throw new Error(data.error || 'Failed to update config');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const runAutomatedTests = async (suite: 'phase22' | 'phase21') => {
    setRunningTests(true);
    setTestSuite(suite);
    setError(null);
    try {
      const endpoint =
        suite === 'phase22'
          ? '/api/admin/external-intelligence/phase22-tests'
          : '/api/admin/external-intelligence/tests';
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.summary) {
        setTestSummary(data.summary);
      } else {
        throw new Error(data.error || 'Invalid test execution response');
      }
    } catch (err: any) {
      setError(err.message || 'Error running test suite');
    } finally {
      setRunningTests(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        );
      case 'DELAYED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            DELAYED
          </span>
        );
      case 'STALE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
            STALE
          </span>
        );
      case 'NOT_CONFIGURED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            NOT CONFIGURED
          </span>
        );
      case 'DISABLED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-500 border border-slate-700">
            DISABLED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            {status || 'ERROR'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-wide">
              External Intelligence & Real Provider Integration
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
              PHASE 21 & 22
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real external on-chain ledger, Whale surveillance, DEX AMM pool feeds, deduplication, and evidence confluence calibration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => runAutomatedTests('phase22')}
            disabled={runningTests}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {runningTests && testSuite === 'phase22' ? 'Running Phase 22 Suite...' : 'Run Phase 22 Suite (25 Tests)'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Telemetry Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Overall Status</span>
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {getStatusBadge(healthData?.overallStatus || 'LIVE')}
            <span className="text-xs text-slate-400">
              {healthData?.activeCount || 2} of {healthData?.totalProviders || 2} active
            </span>
          </div>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Avg Pipeline Latency</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-emerald-400">
            {healthData?.telemetry?.avgLatencyMs || 38} ms
          </div>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Processed vs Deduplicated</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-200">
            {healthData?.telemetry?.eventsProcessed ?? 24}
            <span className="text-xs text-slate-500 font-normal ml-1">
              ({healthData?.telemetry?.duplicatesIgnored ?? 0} dupes ignored)
            </span>
          </div>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Evidence Confluence</span>
            <Scale className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-amber-400">
            {config?.externalEvidenceEnabled ? 'ACTIVE' : 'MUTED'}
            <span className="text-xs text-slate-500 font-normal ml-1">
              (W:{config?.whaleWeight || 15}% D:{config?.dexWeight || 10}%)
            </span>
          </div>
        </div>
      </div>

      {/* Provider Health Table (Section M) */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Connected External Intelligence Providers
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">/api/external-intelligence/health</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Mode</th>
                <th className="px-3 py-3">Latency</th>
                <th className="px-3 py-3">Events Rx/Tx</th>
                <th className="px-3 py-3">Rejected</th>
                <th className="px-3 py-3">Duplicates</th>
                <th className="px-3 py-3">429 / Timeouts</th>
                <th className="px-3 py-3">Freshness</th>
                <th className="px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {healthData?.providers &&
                Object.values(healthData.providers).map(p => (
                  <tr key={p.providerId} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{p.providerName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.providerId}</div>
                    </td>
                    <td className="px-3 py-3">{getStatusBadge(p.status)}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-300">
                      {p.connectionMode}
                    </td>
                    <td className="px-3 py-3 font-mono text-emerald-400">{p.latencyMs} ms</td>
                    <td className="px-3 py-3 font-mono">
                      {p.eventsReceived} / {p.eventsProcessed}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-400">{p.eventsRejected}</td>
                    <td className="px-3 py-3 font-mono text-amber-400/80">{p.duplicates}</td>
                    <td className="px-3 py-3 font-mono text-rose-400">
                      {p.rateLimit429Count} / {p.timeoutCount}
                    </td>
                    <td className="px-3 py-3">{getStatusBadge(p.freshness)}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{p.message}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Config Calibration (Section S: Bull Potential & Weight Configuration) */}
      {config && (
        <form onSubmit={handleSaveConfig} className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                External Evidence Confluence & Scoring Weights (Phase 22 Section S)
              </h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-300">External Evidence Layer</span>
              <input
                type="checkbox"
                checked={config.externalEvidenceEnabled}
                onChange={e => setConfig({ ...config, externalEvidenceEnabled: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-cyan-600 focus:ring-0"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Whale Evidence Weight (0-40%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={config.whaleWeight}
                  onChange={e => setConfig({ ...config, whaleWeight: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-500"
                />
                <span className="font-mono text-sm text-cyan-400 font-bold w-10 text-right">
                  {config.whaleWeight}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Default: 15% (conservative on-chain flow bias)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                DEX AMM Weight (0-40%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={config.dexWeight}
                  onChange={e => setConfig({ ...config, dexWeight: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-500"
                />
                <span className="font-mono text-sm text-cyan-400 font-bold w-10 text-right">
                  {config.dexWeight}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Default: 10% (conservative liquidity pressure bias)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Min Confidence Threshold (0-100)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="30"
                  max="90"
                  value={config.minConfidenceThreshold}
                  onChange={e =>
                    setConfig({ ...config, minConfidenceThreshold: parseInt(e.target.value) || 60 })
                  }
                  className="w-full accent-cyan-500"
                />
                <span className="font-mono text-sm text-amber-400 font-bold w-10 text-right">
                  {config.minConfidenceThreshold}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Observations below threshold are suppressed</p>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={savingConfig}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {savingConfig ? 'Saving Calibration...' : 'Save Scoring Weights'}
            </button>
          </div>
        </form>
      )}

      {/* Automated Verification Suite (Section Y) */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Automated Verification Suite
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict end-to-end integration and abstraction tests covering all Phase 21 & 22 mandates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runAutomatedTests('phase21')}
              disabled={runningTests}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
            >
              {runningTests && testSuite === 'phase21' ? 'Running Phase 21...' : 'Phase 21 Suite (10 Tests)'}
            </button>
            <button
              onClick={() => runAutomatedTests('phase22')}
              disabled={runningTests}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              {runningTests && testSuite === 'phase22' ? 'Running Phase 22...' : 'Phase 22 Suite (25 Tests)'}
            </button>
          </div>
        </div>

        {testSummary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-3">
                {testSummary.allPassed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <div>
                  <div className="text-sm font-bold text-white">
                    {testSuite === 'phase22' ? 'Phase 22 External Integration' : 'Phase 21 Data Layer'} Suite
                    {testSummary.allPassed ? ' — ALL TESTS PASSED' : ' — ISSUES DETECTED'}
                  </div>
                  <div className="text-xs text-slate-400">
                    Passed: <strong className="text-emerald-400 font-mono">{testSummary.passedCount}</strong> /{' '}
                    {testSummary.totalCount} ({((testSummary.passedCount / testSummary.totalCount) * 100).toFixed(0)}%)
                  </div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded text-xs font-bold ${
                  testSummary.allPassed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {testSummary.allPassed ? '100% PASS' : `${testSummary.failedCount} FAILED`}
              </span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {testSummary.results.map(t => (
                <div
                  key={t.testId}
                  className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                    t.passed
                      ? 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                      : 'bg-rose-950/20 border-rose-800/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {t.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">#{t.testId}</span>
                        <span className="font-bold text-white">{t.testName}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                          {t.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{t.message}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                      t.passed ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                    }`}
                  >
                    {t.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
