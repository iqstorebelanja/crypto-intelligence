import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Shield,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  Layers,
  ListPlus,
  Trash2
} from 'lucide-react';
import { TrialAdminConfig } from '../../types';

interface AdminTrialSettingsProps {
  token: string | null;
}

export const AdminTrialSettings: React.FC<AdminTrialSettingsProps> = ({ token }) => {
  const [config, setConfig] = useState<TrialAdminConfig>({
    enabled: true,
    trialDurationDays: 7,
    freeAllowedSymbols: ['BTC', 'ETH'],
    freeMaxWatchlist: 5,
    freeMaxAlerts: 3,
    freeScannerMaxPairs: 50
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    allPassed: boolean;
    results: Array<{ testId: number; testName: string; passed: boolean; message: string }>;
  } | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/trial/settings', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.settings) {
        setConfig(data.settings);
      }
    } catch (err: any) {
      // Fallback to public config endpoint if needed
      try {
        const fallbackRes = await fetch('/api/trial/config');
        const fallbackData = await fallbackRes.json();
        if (fallbackData.config) {
          setConfig(fallbackData.config);
        }
      } catch (e) {
        console.error('Failed to load trial settings:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/trial/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(config)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.settings) {
        setConfig(data.settings);
      }
      setStatusMessage({ type: 'success', text: 'Trial & Feature Gating settings updated successfully.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSymbol = () => {
    const clean = newSymbolInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) return;
    if (config.freeAllowedSymbols.includes(clean)) return;
    setConfig(prev => ({
      ...prev,
      freeAllowedSymbols: [...prev.freeAllowedSymbols, clean]
    }));
    setNewSymbolInput('');
  };

  const handleRemoveSymbol = (sym: string) => {
    setConfig(prev => ({
      ...prev,
      freeAllowedSymbols: prev.freeAllowedSymbols.filter(s => s !== sym)
    }));
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/admin/phase15/tests', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestResults(data);
    } catch (err: any) {
      console.error('Failed to execute phase 15 tests:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig({
      enabled: true,
      trialDurationDays: 7,
      freeAllowedSymbols: ['BTC', 'ETH'],
      freeMaxWatchlist: 5,
      freeMaxAlerts: 3,
      freeScannerMaxPairs: 50
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center font-mono text-cyan-400 flex items-center justify-center space-x-2">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Loading Reverse Trial Engine Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0c1626] via-[#09111e] to-[#0c1626] border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-wider uppercase">
              Phase 15: Reverse 7-Day PRO Trial & Feature Gating
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-950 text-amber-300 border border-amber-500/50">
              Authoritative Server-Enforced
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Manage onboarding trial duration, server-side expiration behavior, and free-tier signal gating boundaries.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchConfig}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-slate-950 font-bold flex items-center space-x-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center space-x-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid of Settings Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Reverse Trial Model Mechanics */}
        <div className="p-6 rounded-2xl bg-[#080d16] border border-[#162238] space-y-5 shadow-xl">
          <div className="border-b border-[#141e30] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Trial Timing & Activation</span>
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              New accounts automatically start on Free Plan with a temporary Pro entitlement.
            </p>
          </div>

          <div className="space-y-4">
            {/* Enable Trial Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0c1424] border border-[#1a2842]">
              <div>
                <div className="text-white font-bold">Automatic 7-Day PRO Trial for New Users</div>
                <div className="text-slate-400 text-[11px]">
                  When enabled, all newly created accounts receive 7-Day Pro trial access.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.enabled ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Trial Duration */}
            <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#1a2842] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">Trial Duration (Days)</span>
                <span className="text-amber-400 font-bold text-sm">{config.trialDurationDays} Days</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={config.trialDurationDays}
                onChange={e => setConfig(prev => ({ ...prev, trialDurationDays: parseInt(e.target.value, 10) }))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1 Day</span>
                <span>Default: 7 Days</span>
                <span>14 Days</span>
                <span>30 Days</span>
              </div>
            </div>

            {/* Server-Side Expiration Info */}
            <div className="p-3 rounded-xl bg-[#080d16] border border-[#182338] text-[11px] text-slate-400 space-y-1">
              <div className="font-bold text-cyan-300">Server-Authoritative Synchronization:</div>
              <p>
                Trial expiration checks run continuously every 60s in the background. Expiration relies strictly on UTC server timestamp:
                <code className="text-white bg-[#0e1726] px-1 py-0.5 rounded ml-1">trialEndsAt = trialStartedAt + (duration * 86,400,000)</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Panel 2: Free Plan Allowed Signal Universe */}
        <div className="p-6 rounded-2xl bg-[#080d16] border border-[#162238] space-y-5 shadow-xl">
          <div className="border-b border-[#141e30] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Free Plan Allowed Signals (BTC / ETH)</span>
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Assets configured here provide 100% full signal intelligence, score attribution, and MTF confluence on Free tier.
            </p>
          </div>

          <div className="space-y-4">
            {/* Symbol Chips */}
            <div>
              <label className="text-slate-400 block mb-2 font-bold">Permitted Free Full-Signal Assets:</label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2.5 rounded-xl bg-[#0c1424] border border-[#1a2842]">
                {config.freeAllowedSymbols.map(sym => (
                  <span
                    key={sym}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-600/50 text-cyan-300 text-xs font-bold"
                  >
                    <span>{sym}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSymbol(sym)}
                      className="text-cyan-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                      title={`Remove ${sym}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Add Symbol Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Asset symbol (e.g. SOL, BNB)"
                value={newSymbolInput}
                onChange={e => setNewSymbolInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSymbol();
                  }
                }}
                className="flex-1 px-3 py-2 rounded-xl bg-[#0c1424] border border-[#1a2842] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono uppercase"
              />
              <button
                type="button"
                onClick={handleAddSymbol}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center space-x-1"
              >
                <ListPlus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              Default: <strong className="text-white">BTC</strong> and <strong className="text-white">ETH</strong>.
              All other assets have their signal strength, MTF confluence, and bull scores redacted with 🔒 PRO guards.
            </p>
          </div>
        </div>

        {/* Panel 3: Free Plan Limits */}
        <div className="p-6 rounded-2xl bg-[#080d16] border border-[#162238] space-y-5 shadow-xl">
          <div className="border-b border-[#141e30] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span>Free Plan Tier Limits</span>
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Limits automatically applied when 7-Day PRO trial completes.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-xl bg-[#0c1424] border border-[#1a2842]">
              <div>
                <div className="text-white font-bold">Max Watchlist Assets</div>
                <div className="text-slate-500 text-[10px]">Excess items preserved, additions blocked until upgrade</div>
              </div>
              <input
                type="number"
                min="1"
                max="50"
                value={config.freeMaxWatchlist}
                onChange={e => setConfig(prev => ({ ...prev, freeMaxWatchlist: parseInt(e.target.value, 10) || 5 }))}
                className="w-20 px-2.5 py-1 rounded-lg bg-[#080d16] border border-[#1a2842] text-white text-right font-bold"
              />
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-[#0c1424] border border-[#1a2842]">
              <div>
                <div className="text-white font-bold">Max Active Alerts</div>
                <div className="text-slate-500 text-[10px]">Free users limited to 3 multi-exchange alerts</div>
              </div>
              <input
                type="number"
                min="1"
                max="25"
                value={config.freeMaxAlerts}
                onChange={e => setConfig(prev => ({ ...prev, freeMaxAlerts: parseInt(e.target.value, 10) || 3 }))}
                className="w-20 px-2.5 py-1 rounded-lg bg-[#080d16] border border-[#1a2842] text-white text-right font-bold"
              />
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-[#0c1424] border border-[#1a2842]">
              <div>
                <div className="text-white font-bold">Scanner Pair Universe</div>
                <div className="text-slate-500 text-[10px]">Maximum universe size rendered in Free scanner view</div>
              </div>
              <input
                type="number"
                min="10"
                max="200"
                value={config.freeScannerMaxPairs}
                onChange={e => setConfig(prev => ({ ...prev, freeScannerMaxPairs: parseInt(e.target.value, 10) || 50 }))}
                className="w-20 px-2.5 py-1 rounded-lg bg-[#080d16] border border-[#1a2842] text-white text-right font-bold"
              />
            </div>
          </div>
        </div>

        {/* Panel 4: Protection & Policy Verification */}
        <div className="p-6 rounded-2xl bg-[#080d16] border border-[#162238] space-y-4 shadow-xl">
          <div className="border-b border-[#141e30] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Security & Audit Trail</span>
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Audited configurations recorded in persistent audit log.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#1a2842] space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Last Updated:</span>
              <span className="text-white font-bold">
                {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'System Seed (Initial)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Modified By:</span>
              <span className="text-cyan-300 font-bold">{config.updatedBy || 'admin@cryptointelligence.ai'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Authoritative Engine:</span>
              <span className="text-emerald-400 font-bold">Server-Side Active</span>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-slate-400 hover:text-white underline text-[11px]"
            >
              Reset to Factory Defaults (7-day trial, BTC/ETH free)
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center space-x-1.5 shadow-md active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Commit Changes</span>
            </button>
          </div>
        </div>

        {/* Panel 5: Automated Entitlement Verification Suite (Section 26 Test Matrix) */}
        <div className="p-6 rounded-2xl bg-[#080d16] border border-[#162238] space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141e30] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Phase 15 Automated Test Matrix (28 Test Cases)</span>
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Execute automated validation across trial creation, expiration, security boundary, and feature gates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center space-x-2 text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'Executing 28 Tests...' : 'Run Automated Test Suite'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0c1424] border border-[#1b253b] text-xs">
                <div className="flex items-center space-x-2">
                  {testResults.allPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  )}
                  <span className="font-bold text-white">
                    {testResults.allPassed ? 'All 28 Test Cases Passed' : `${testResults.failedCount} Test Cases Failed`}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  <span className="text-emerald-400 font-bold">{testResults.passedCount}</span> / {testResults.totalCount} Passed
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {testResults.results.map(r => (
                  <div
                    key={r.testId}
                    className={`p-2.5 rounded-lg border text-[11px] flex items-start space-x-2 ${
                      r.passed
                        ? 'bg-emerald-950/20 border-emerald-900/40 text-slate-300'
                        : 'bg-rose-950/30 border-rose-900/50 text-rose-300'
                    }`}
                  >
                    <span className="font-mono font-bold text-cyan-400 shrink-0">#{r.testId}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white flex items-center space-x-1.5">
                        <span>{r.testName}</span>
                        {r.passed ? (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">PASS</span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800 font-mono">FAIL</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{r.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
