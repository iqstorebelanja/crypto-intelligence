import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  Check,
  CheckCircle,
  Clock,
  Coins,
  Cpu,
  Eye,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';
import { AIMonetizationMetrics, RewardedAdConfig, TestResult } from '../../types';

interface AdminAiMonetizationProps {
  token: string | null;
}

export const AdminAiMonetization: React.FC<AdminAiMonetizationProps> = ({ token }) => {
  const [metrics, setMetrics] = useState<AIMonetizationMetrics | null>(null);
  const [config, setConfig] = useState<RewardedAdConfig | null>(null);
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form edits
  const [formConfig, setFormConfig] = useState<Partial<RewardedAdConfig>>({});

  // Test Runner State
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [testSummary, setTestSummary] = useState<{ total: number; passed: number; failed: number } | null>(null);

  const fetchMonetizationData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ad/admin/monetization/metrics', { headers });
      if (!res.ok) {
        throw new Error(`Failed to load monetization data: HTTP ${res.status}`);
      }
      const data = await res.json();
      setMetrics(data.metrics);
      setConfig(data.config);
      setFormConfig(data.config);
      setProviderStatus(data.providerStatus);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonetizationData();
  }, [token]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ad/admin/monetization/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(formConfig)
      });

      if (!res.ok) {
        throw new Error(`Failed to update config: HTTP ${res.status}`);
      }
      const data = await res.json();
      setConfig(data.config);
      setFormConfig(data.config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const runPhase9bTests = async () => {
    setIsRunningTests(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/phase9b/tests', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestResults(data.results || []);
      setTestSummary({
        total: data.totalTests,
        passed: data.passedCount,
        failed: data.failedCount
      });
      // Refresh telemetry metrics after running tests
      fetchMonetizationData();
    } catch (err) {
      setError(`Test execution error: ${(err as Error).message}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Module Title Banner */}
      <div className="bg-[#0c121e] border border-cyan-900/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                PHASE 9B: AI MONETIZATION & REWARDED-AD ENGINE
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Free 15-Second Rewarded Ad Gate • Pro Ad-Free Pass • Server-Side Cryptographic Verification • Anti-Replay Shield
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchMonetizationData}
            disabled={isLoading}
            className="px-3 py-2 bg-[#080d16] hover:bg-[#121c2e] border border-[#1b253b] text-slate-300 rounded-xl text-xs flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>

          <button
            onClick={runPhase9bTests}
            disabled={isRunningTests}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-cyan-600/20"
          >
            <Play className={`w-3.5 h-3.5 fill-white ${isRunningTests ? 'animate-spin' : ''}`} />
            <span>{isRunningTests ? 'Running Verification...' : 'Run Phase 9B Test Suite'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Free Requests */}
        <div className="p-4 bg-[#080d16] border border-[#182338] rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Free AI Queries</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.freeAiRequests ?? 0}
          </div>
          <div className="text-[11px] text-cyan-400">
            Unlocked via 15s Ads: {metrics?.aiRequestsUnlockedByAds ?? 0}
          </div>
        </div>

        {/* Metric 2: Pro Requests */}
        <div className="p-4 bg-[#080d16] border border-[#182338] rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pro AI Queries</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 font-mono">
            {metrics?.proAiRequests ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">
            100% Ad-Free Direct Pass
          </div>
        </div>

        {/* Metric 3: Ad Completions */}
        <div className="p-4 bg-[#080d16] border border-[#182338] rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Rewarded Ad Starts / Done</span>
            <Play className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {metrics?.rewardedAdCompletions ?? 0} <span className="text-xs text-slate-500 font-normal">/ {metrics?.rewardedAdAttempts ?? 0}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {metrics && metrics.rewardedAdAttempts > 0
              ? `${Math.round((metrics.rewardedAdCompletions / metrics.rewardedAdAttempts) * 100)}% Completion Rate`
              : '100% Fill Rate'}
          </div>
        </div>

        {/* Metric 4: Anti-Abuse Defenses */}
        <div className="p-4 bg-[#080d16] border border-[#182338] rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Security Interceptions</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {(metrics?.duplicateRewardAttempts ?? 0) + (metrics?.rewardVerificationFailures ?? 0) + (metrics?.expiredRewardSessions ?? 0)}
          </div>
          <div className="text-[11px] text-slate-400">
            Replay: {metrics?.duplicateRewardAttempts ?? 0} • Expired: {metrics?.expiredRewardSessions ?? 0}
          </div>
        </div>
      </div>

      {/* AI Token & Cost Telemetry (Separated Free vs Pro vs Moderation) */}
      <div className="bg-[#080d16] border border-[#182338] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Token Consumption & Inference Cost (Separated by Tier)
            </h3>
          </div>
          <div className="text-[11px] text-slate-400">
            Ad Revenue: <strong className="text-amber-300 font-mono">{metrics?.adRevenueStatus || 'N/A — Provider revenue data unavailable'}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Free Tier Pool */}
          <div className="p-4 bg-[#0c121e] border border-cyan-900/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300">FREE TIER POOL</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                15s Ad Funded
              </span>
            </div>
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-slate-400">
                <span>Tokens Consumed:</span>
                <span className="text-white font-mono font-bold">{(metrics?.freeAiTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Inference Cost:</span>
                <span className="text-cyan-400 font-mono font-bold">${(metrics?.freeEstimatedCostUsd ?? 0).toFixed(5)}</span>
              </div>
            </div>
          </div>

          {/* Pro Tier Pool */}
          <div className="p-4 bg-[#0c121e] border border-amber-900/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">PRO TIER POOL</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/50">
                Subscription Funded
              </span>
            </div>
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-slate-400">
                <span>Tokens Consumed:</span>
                <span className="text-white font-mono font-bold">{(metrics?.proAiTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Inference Cost:</span>
                <span className="text-amber-400 font-mono font-bold">${(metrics?.proEstimatedCostUsd ?? 0).toFixed(5)}</span>
              </div>
            </div>
          </div>

          {/* Background Moderation Pool */}
          <div className="p-4 bg-[#0c121e] border border-purple-900/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-300">COMMUNITY MODERATION</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800/50">
                Platform Safety
              </span>
            </div>
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-slate-400">
                <span>Engine Separation:</span>
                <span className="text-emerald-400 font-bold">Isolated Layer 2</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Quota Impact:</span>
                <span className="text-white font-mono font-bold">0 units (Exempt)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monetization & Rewarded Ad Configuration Controls */}
      <div className="bg-[#080d16] border border-[#182338] rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Runtime Monetization Engine Settings
            </h3>
          </div>
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>Configuration Saved</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          {/* Free Daily Quota */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold block">Free Daily AI Quota (Queries / Day)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={formConfig.freeDailyQuota ?? 5}
              onChange={e => setFormConfig(prev => ({ ...prev, freeDailyQuota: parseInt(e.target.value) || 5 }))}
              className="w-full bg-[#0c121e] border border-[#1b253b] rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Number of requests free users receive per UTC day.</p>
          </div>

          {/* Pro Daily Quota */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold block">Pro Daily AI Limit (Fair Use)</label>
            <input
              type="number"
              min={10}
              max={1000}
              value={formConfig.proDailyQuota ?? 100}
              onChange={e => setFormConfig(prev => ({ ...prev, proDailyQuota: parseInt(e.target.value) || 100 }))}
              className="w-full bg-[#0c121e] border border-[#1b253b] rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Fair-use limit for paying Pro accounts.</p>
          </div>

          {/* Ad Duration */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold block">Rewarded Ad Duration (Seconds)</label>
            <input
              type="number"
              min={5}
              max={60}
              value={formConfig.adDurationSeconds ?? 15}
              onChange={e => setFormConfig(prev => ({ ...prev, adDurationSeconds: parseInt(e.target.value) || 15 }))}
              className="w-full bg-[#0c121e] border border-[#1b253b] rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Server rejects completions under this duration.</p>
          </div>

          {/* Rewarded Ad Mandatory Toggle */}
          <div className="p-3 bg-[#0c121e] border border-[#1b253b] rounded-xl flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Enforce Rewarded Ad</span>
              <span className="text-[10px] text-slate-400">Block Free users until 15s ad completion</span>
            </div>
            <input
              type="checkbox"
              checked={formConfig.enabled ?? true}
              onChange={e => setFormConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="w-4 h-4 accent-cyan-500 rounded"
            />
          </div>

          {/* Ad Provider Availability Toggle */}
          <div className="p-3 bg-[#0c121e] border border-[#1b253b] rounded-xl flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Ad Fill Availability</span>
              <span className="text-[10px] text-slate-400">Simulate ad inventory outages</span>
            </div>
            <input
              type="checkbox"
              checked={formConfig.adAvailability ?? true}
              onChange={e => setFormConfig(prev => ({ ...prev, adAvailability: e.target.checked }))}
              className="w-4 h-4 accent-cyan-500 rounded"
            />
          </div>

          {/* Test Mode */}
          <div className="p-3 bg-[#0c121e] border border-[#1b253b] rounded-xl flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Test Mode Simulation</span>
              <span className="text-[10px] text-slate-400">Use test provider & zero fake revenue</span>
            </div>
            <input
              type="checkbox"
              checked={formConfig.testMode ?? true}
              onChange={e => setFormConfig(prev => ({ ...prev, testMode: e.target.checked }))}
              className="w-4 h-4 accent-cyan-500 rounded"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Apply Monetization Settings'}</span>
          </button>
        </div>
      </div>

      {/* Automated Phase 9B Test Runner Panel */}
      <div className="bg-[#080d16] border border-[#182338] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Phase 9B Test Suite & Anti-Abuse Verifier
            </h3>
          </div>
          {testSummary && (
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                {testSummary.passed} Passed
              </span>
              {testSummary.failed > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                  {testSummary.failed} Failed
                </span>
              )}
            </div>
          )}
        </div>

        {testResults.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs space-y-2">
            <p>No test run executed yet.</p>
            <p className="text-[11px] text-slate-600">
              Click &quot;Run Phase 9B Test Suite&quot; above to execute all 14 automated tests for Free ad gates, Pro passes, and anti-abuse verification.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {testResults.map((t, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#0c121e] border border-[#182338] rounded-xl flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{t.name}</span>
                    {t.category && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-300">
                        {t.category}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{t.details}</p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className="text-[10px] text-slate-500 font-mono">{t.durationMs}ms</span>
                  {t.passed ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 text-[10px] font-bold flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>PASS</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-700/50 text-[10px] font-bold flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>FAIL</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
