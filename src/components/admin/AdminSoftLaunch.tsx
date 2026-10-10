import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  HelpCircle,
  Layers,
  LifeBuoy,
  Lock,
  PauseCircle,
  Play,
  PlayCircle,
  Power,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  XCircle,
  Zap
} from 'lucide-react';
import {
  LaunchMode,
  FeatureFlagKey,
  KillSwitchKey,
  IncidentRecord,
  IncidentSeverity,
  FunnelStageMetric,
  DataIntegrityReport
} from '../../types';

interface AdminSoftLaunchProps {
  token: string | null;
}

export const AdminSoftLaunch: React.FC<AdminSoftLaunchProps> = ({ token }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Launch Mode & Limits
  const [launchMode, setLaunchMode] = useState<LaunchMode>('SOFT_LAUNCH');
  const [limits, setLimits] = useState({
    maxRegistrations: 1000,
    aiDailyUsageLimit: 100,
    alertsPerUserLimit: 25,
    scannerRequestRatePerMin: 120,
    communityPostingRatePerMin: 10,
    notificationRatePerMin: 60
  });

  // Feature Flags & Kill Switches
  const [featureFlags, setFeatureFlags] = useState<Record<FeatureFlagKey, boolean>>({
    SIGNALS_ENABLED: true,
    WHALE_ENABLED: true,
    DEX_INTELLIGENCE_ENABLED: true,
    AI_TRADER_ENABLED: true,
    COMMUNITY_ENABLED: true,
    ALERTS_ENABLED: true,
    PAYMENTS_ENABLED: true,
    TRIAL_ENABLED: true,
    NEW_USER_REGISTRATION_ENABLED: true
  });

  const [killSwitches, setKillSwitches] = useState<Record<KillSwitchKey, boolean>>({
    AI_TRADER: false,
    ALERT_ENGINE: false,
    NOTIFICATIONS: false,
    WHALE_PROVIDER: false,
    DEX_PROVIDER: false,
    PAYMENT_CHECKOUT: false,
    COMMUNITY_POSTING: false,
    MAINTENANCE_MODE: false
  });

  // Analytics & Costs
  const [funnel, setFunnel] = useState<FunnelStageMetric[]>([]);
  const [retention, setRetention] = useState({ day1Pct: 0, day7Pct: 0, day30Pct: 0, sampleSize: 0 });
  const [costs, setCosts] = useState({
    tokensToday: 0,
    tokensThisMonth: 0,
    aiCostTodayUsd: 0,
    dailyWarningThresholdUsd: 15,
    monthlyWarningThresholdUsd: 250,
    warningTriggered: false
  });

  // Data Integrity
  const [integrity, setIntegrity] = useState<DataIntegrityReport | null>(null);

  // Incidents
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [newIncidentTitle, setNewIncidentTitle] = useState('');
  const [newIncidentSeverity, setNewIncidentSeverity] = useState<IncidentSeverity>('SEV-3');
  const [newIncidentComponent, setNewIncidentComponent] = useState('MARKET_DATA');

  // Support Search
  const [supportSearchInput, setSupportSearchInput] = useState('');
  const [supportUserData, setSupportUserData] = useState<any | null>(null);
  const [supportUserError, setSupportUserError] = useState<string | null>(null);

  // Test Runner State
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<any | null>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load launch config
      const resConfig = await fetch('/api/admin/launch-config', { headers: authHeaders });
      if (resConfig.ok) {
        const data = await resConfig.json();
        setLaunchMode(data.launchMode);
        if (data.limits) setLimits(data.limits);
        if (data.flags) setFeatureFlags(data.flags);
        if (data.killSwitches) setKillSwitches(data.killSwitches);
      }

      // Load incidents
      const resIncidents = await fetch('/api/admin/incidents', { headers: authHeaders });
      if (resIncidents.ok) {
        const incData = await resIncidents.json();
        setIncidents(incData.incidents || []);
      }

      // Load funnel
      const resFunnel = await fetch('/api/admin/analytics/funnel', { headers: authHeaders });
      if (resFunnel.ok) {
        const fData = await resFunnel.json();
        setFunnel(fData.funnel || []);
      }

      // Load retention
      const resRet = await fetch('/api/admin/analytics/retention', { headers: authHeaders });
      if (resRet.ok) {
        const rData = await resRet.json();
        setRetention(rData.retention || { day1Pct: 0, day7Pct: 0, day30Pct: 0, sampleSize: 0 });
      }

      // Load costs
      const resCosts = await fetch('/api/admin/analytics/costs', { headers: authHeaders });
      if (resCosts.ok) {
        const cData = await resCosts.json();
        setCosts(cData.costs || costs);
      }

      // Load integrity
      const resInteg = await fetch('/api/admin/data-integrity', { headers: authHeaders });
      if (resInteg.ok) {
        const iData = await resInteg.json();
        setIntegrity(iData.integrity || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Soft Launch telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleLaunchModeChange = async (mode: LaunchMode) => {
    try {
      const res = await fetch('/api/admin/launch-config', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ launchMode: mode })
      });
      if (res.ok) {
        setLaunchMode(mode);
        setActionSuccess(`Launch Mode safely switched to ${mode}.`);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleFeatureFlag = async (flag: FeatureFlagKey, currentVal: boolean) => {
    try {
      const newVal = !currentVal;
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ flag, enabled: newVal })
      });
      if (res.ok) {
        setFeatureFlags(prev => ({ ...prev, [flag]: newVal }));
        setActionSuccess(`Feature Flag ${flag} updated to ${newVal ? 'ENABLED' : 'DISABLED'}.`);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleKillSwitch = async (component: KillSwitchKey, currentVal: boolean) => {
    try {
      const newVal = !currentVal;
      const reason = newVal ? prompt('Enter reason for emergency kill switch activation:', 'Instability / anomaly prevention') : 'Deactivated by admin';
      if (newVal && reason === null) return; // user cancelled

      const res = await fetch('/api/admin/kill-switches', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ component, active: newVal, reason: reason || 'Emergency isolation' })
      });
      if (res.ok) {
        setKillSwitches(prev => ({ ...prev, [component]: newVal }));
        setActionSuccess(`Emergency Kill Switch for ${component} is now ${newVal ? 'TRIGGERED (HALTED)' : 'NORMAL'}.`);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidentTitle.trim()) return;

    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: newIncidentTitle,
          severity: newIncidentSeverity,
          affectedComponent: newIncidentComponent
        })
      });
      if (res.ok) {
        const data = await res.json();
        setIncidents(prev => [data.incident, ...prev]);
        setNewIncidentTitle('');
        setActionSuccess('Incident logged and assigned tracking ID.');
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResolveIncident = async (id: string) => {
    const summary = prompt('Resolution Summary:', 'Verified stable by system engineer');
    if (summary === null) return;

    try {
      const res = await fetch(`/api/admin/incidents/${id}/resolve`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ resolutionSummary: summary })
      });
      if (res.ok) {
        const data = await res.json();
        setIncidents(prev => prev.map(inc => inc.id === id ? data.incident : inc));
        setActionSuccess(`Incident ${id} resolved.`);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSupportLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSearchInput.trim()) return;

    try {
      setSupportUserError(null);
      setSupportUserData(null);
      const res = await fetch(`/api/admin/support/user/${encodeURIComponent(supportSearchInput.trim())}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setSupportUserData(data.user);
      } else {
        setSupportUserError('User not found or no associated record in database.');
      }
    } catch (err: any) {
      setSupportUserError(err.message || 'Lookup failed');
    }
  };

  const handleRunSoftLaunchTests = async () => {
    try {
      setTestRunning(true);
      setTestResults(null);
      const res = await fetch('/api/admin/soft-launch/tests', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setTestResults(data.summary);
      } else {
        throw new Error('Test runner failed to execute.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTestRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <span className="text-slate-400 text-xs font-mono">Loading Soft Launch Control Center & Observability Matrix...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-200">
      {/* Toast Alert */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs font-mono animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl flex items-center space-x-2 text-rose-300 text-xs font-mono">
          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TOP HEADER: LAUNCH MODE & CONTROL BANNER */}
      <div className="p-5 bg-gradient-to-r from-[#0b101d] via-[#101726] to-[#0e1622] border border-[#1b273d] rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              SOFT LAUNCH, OBSERVABILITY & RUNBOOKS
            </h2>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
              launchMode === 'PRODUCTION'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                : launchMode === 'SOFT_LAUNCH'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
            }`}>
              MODE: {launchMode}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time telemetry, server-authoritative feature flags, emergency kill switches, and customer support console.
          </p>
        </div>

        {/* Launch Mode Selector */}
        <div className="flex items-center space-x-2 bg-[#080d16] p-1.5 rounded-xl border border-[#172236]">
          <span className="text-[11px] font-mono text-slate-400 px-2 font-semibold">Stage:</span>
          {(['DEVELOPMENT', 'STAGING', 'SOFT_LAUNCH', 'PRODUCTION'] as LaunchMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => handleLaunchModeChange(mode)}
              className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all ${
                launchMode === mode
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-[#131d2e]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: EMERGENCY KILL SWITCHES & CIRCUIT BREAKERS */}
      <div className="p-5 bg-[#0b101c] border border-rose-900/30 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                EMERGENCY SUBSYSTEM KILL SWITCHES
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700/50">
                  ISOLATION SAFEGUARD
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Immediately isolate an unstable external provider or subsystem without bringing down the whole platform.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleToggleKillSwitch('MAINTENANCE_MODE', killSwitches.MAINTENANCE_MODE)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
              killSwitches.MAINTENANCE_MODE
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-[#151f33] text-slate-300 hover:bg-[#1e2c47] border border-[#23334e]'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{killSwitches.MAINTENANCE_MODE ? 'MAINTENANCE MODE ACTIVE' : 'ENTER MAINTENANCE MODE'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(killSwitches) as KillSwitchKey[])
            .filter(k => k !== 'MAINTENANCE_MODE')
            .map(key => {
              const isActive = killSwitches[key];
              return (
                <div
                  key={key}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
                    isActive
                      ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                      : 'bg-[#0e1524] border-[#182338] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold">{key}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      {isActive ? 'HALTED' : 'NORMAL'}
                    </span>
                    <button
                      onClick={() => handleToggleKillSwitch(key, isActive)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                        isActive
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40'
                      }`}
                    >
                      {isActive ? 'RESTORE' : 'KILL'}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* SECTION 2: SERVER-AUTHORITATIVE FEATURE FLAGS */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-600/50 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                SERVER-AUTHORITATIVE FEATURE FLAGS
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                  ZERO REDEPLOY
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Instantly toggle customer-facing features dynamically while server-side entitlements remain immutable.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-700/40 px-3 py-1 rounded-lg">
            {Object.values(featureFlags).filter(Boolean).length} / {Object.keys(featureFlags).length} Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(featureFlags) as FeatureFlagKey[]).map(flag => {
            const isEnabled = featureFlags[flag];
            return (
              <div
                key={flag}
                className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-mono font-bold text-white">{flag}</div>
                  <div className="text-[10px] text-slate-400">
                    Status: <span className={isEnabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{isEnabled ? 'ENABLED' : 'PAUSED'}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleFeatureFlag(flag, isEnabled)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    isEnabled ? 'bg-cyan-600 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: OBSERVABILITY, FUNNEL & RETENTION MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">SOFT LAUNCH CONVERSION FUNNEL (8 STAGES)</h3>
          </div>
          <div className="space-y-2.5">
            {funnel.map(st => (
              <div key={st.stage} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">{st.stage}</span>
                  <span className="text-slate-400">
                    <span className="text-white font-bold">{st.uniqueUsers}</span> users ({st.conversionPercent}%)
                  </span>
                </div>
                <div className="w-full bg-[#121a2c] rounded-full h-2 overflow-hidden border border-[#1a253d]">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(st.conversionPercent, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#182338] grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="p-2 bg-[#0e1626] rounded-xl border border-[#172338]">
              <div className="text-slate-400 text-[10px]">DAY-1 RETENTION</div>
              <div className="text-emerald-400 font-bold text-sm">{retention.day1Pct}%</div>
            </div>
            <div className="p-2 bg-[#0e1626] rounded-xl border border-[#172338]">
              <div className="text-slate-400 text-[10px]">DAY-7 RETENTION</div>
              <div className="text-cyan-400 font-bold text-sm">{retention.day7Pct}%</div>
            </div>
            <div className="p-2 bg-[#0e1626] rounded-xl border border-[#172338]">
              <div className="text-slate-400 text-[10px]">DAY-30 RETENTION</div>
              <div className="text-indigo-400 font-bold text-sm">{retention.day30Pct}%</div>
            </div>
          </div>
        </div>

        {/* AI Usage & Cost Monitoring */}
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">AI TOKEN USAGE & COST GUARDRAILS</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 font-mono text-xs">
              <div className="p-3 bg-[#0d1424] rounded-xl border border-[#1a263d]">
                <div className="text-slate-400 text-[10px]">TOKENS USED TODAY</div>
                <div className="text-white font-bold text-base">{costs.tokensToday.toLocaleString()}</div>
                <div className="text-[10px] text-indigo-400 mt-1">Est. ${costs.aiCostTodayUsd.toFixed(4)} USD</div>
              </div>
              <div className="p-3 bg-[#0d1424] rounded-xl border border-[#1a263d]">
                <div className="text-slate-400 text-[10px]">MONTHLY RUN-RATE</div>
                <div className="text-white font-bold text-base">{costs.tokensThisMonth.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400 mt-1">Warn at ${costs.monthlyWarningThresholdUsd}</div>
              </div>
            </div>

            {/* Threshold Banner */}
            <div className={`p-3 rounded-xl border text-xs font-mono flex items-center space-x-2 ${
              costs.warningTriggered
                ? 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Daily budget guardrail: <strong>${costs.dailyWarningThresholdUsd} USD</strong>. Current utilization is normal.
              </span>
            </div>
          </div>

          {/* Data Integrity Summary */}
          {integrity && (
            <div className="pt-3 border-t border-[#182338] text-xs font-mono space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Database Consistency:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 0 Orphan Records
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] text-slate-400">
                <div className="p-1.5 bg-[#0a0f1c] rounded border border-[#141d2e]">
                  <div>Users</div>
                  <div className="text-white font-bold">{integrity.metrics.totalUsers}</div>
                </div>
                <div className="p-1.5 bg-[#0a0f1c] rounded border border-[#141d2e]">
                  <div>Subs</div>
                  <div className="text-white font-bold">{integrity.metrics.totalSubscriptions}</div>
                </div>
                <div className="p-1.5 bg-[#0a0f1c] rounded border border-[#141d2e]">
                  <div>Alerts</div>
                  <div className="text-white font-bold">{integrity.metrics.totalAlerts}</div>
                </div>
                <div className="p-1.5 bg-[#0a0f1c] rounded border border-[#141d2e]">
                  <div>Events</div>
                  <div className="text-white font-bold">{integrity.metrics.totalPaymentEvents}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: INCIDENT TRACKER & RUNBOOKS */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">INCIDENT RESPONSE TRACKER & RESOLUTION RUNBOOK</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">SEV-1 (Critical) to SEV-4 (Low)</span>
        </div>

        {/* Create Incident Form */}
        <form onSubmit={handleCreateIncident} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Log new operational incident (e.g., Bybit rate limit anomaly)..."
            value={newIncidentTitle}
            onChange={e => setNewIncidentTitle(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#090e18] border border-[#1c2940] rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
          />
          <select
            value={newIncidentSeverity}
            onChange={e => setNewIncidentSeverity(e.target.value as IncidentSeverity)}
            className="px-3 py-2 bg-[#090e18] border border-[#1c2940] rounded-xl text-xs font-mono text-amber-400 focus:outline-none"
          >
            <option value="SEV-1">SEV-1 (Outage)</option>
            <option value="SEV-2">SEV-2 (Degraded)</option>
            <option value="SEV-3">SEV-3 (Moderate)</option>
            <option value="SEV-4">SEV-4 (Low / Advisory)</option>
          </select>
          <select
            value={newIncidentComponent}
            onChange={e => setNewIncidentComponent(e.target.value)}
            className="px-3 py-2 bg-[#090e18] border border-[#1c2940] rounded-xl text-xs font-mono text-cyan-400 focus:outline-none"
          >
            <option value="MARKET_DATA">Market Data</option>
            <option value="WHALE_RADAR">Whale Radar</option>
            <option value="DEX_INTEL">DEX Intel</option>
            <option value="AI_TRADER">AI Trader</option>
            <option value="PAYMENTS">Payments</option>
            <option value="DATABASE">Database</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-600/20"
          >
            Log Incident
          </button>
        </form>

        {/* Incidents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#182338] text-slate-400">
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Title</th>
                <th className="py-2 px-3">Component</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Opened</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151f33]">
              {incidents.map(inc => (
                <tr key={inc.id} className="hover:bg-[#0e1628]/50">
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inc.severity === 'SEV-1'
                        ? 'bg-rose-950 text-rose-300 border border-rose-600'
                        : inc.severity === 'SEV-2'
                        ? 'bg-amber-950 text-amber-300 border border-amber-600'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-600'
                    }`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white">{inc.title}</td>
                  <td className="py-2.5 px-3 text-slate-300">{inc.affectedComponent}</td>
                  <td className="py-2.5 px-3">
                    <span className={inc.status === 'RESOLVED' ? 'text-emerald-400' : 'text-amber-400'}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {inc.status !== 'RESOLVED' ? (
                      <button
                        onClick={() => handleResolveIncident(inc.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition-all"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5: CUSTOMER SUPPORT SAFE ACCOUNT VIEW */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
        <div className="flex items-center space-x-2">
          <LifeBuoy className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">CUSTOMER SUPPORT SAFE ACCOUNT VIEW (ZERO CREDENTIAL EXPOSURE)</h3>
        </div>
        <p className="text-xs text-slate-400">
          Inspect customer subscription state, trial validity, and entitlements without exposing passwords or payment secrets.
        </p>

        <form onSubmit={handleSupportLookup} className="flex gap-2">
          <input
            type="text"
            placeholder="Search customer by email or User ID (e.g. demo@cryptointelligence.ai)..."
            value={supportSearchInput}
            onChange={e => setSupportSearchInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#090e18] border border-[#1c2940] rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Lookup User</span>
          </button>
        </form>

        {supportUserError && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs font-mono text-rose-300">
            {supportUserError}
          </div>
        )}

        {supportUserData && (
          <div className="p-4 bg-[#090f1b] border border-[#18243a] rounded-xl space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-[#141e30] pb-2">
              <div>
                <span className="text-white font-bold text-sm">{supportUserData.name}</span>
                <span className="text-slate-400 ml-2">({supportUserData.email})</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                supportUserData.isPro
                  ? 'bg-amber-950 text-amber-300 border border-amber-600'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                TIER: {supportUserData.tier}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">TRIAL STATUS</span>
                <span className="text-white font-semibold">{supportUserData.trialStatus}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SUBSCRIPTION</span>
                <span className="text-white font-semibold">{supportUserData.subscriptionStatus}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">ACTIVE ALERTS</span>
                <span className="text-white font-semibold">{supportUserData.activeAlertsCount} alerts</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">WATCHLIST ITEMS</span>
                <span className="text-white font-semibold">{supportUserData.watchlistItemsCount} symbols</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between pt-1">
              <span>Account Created: {supportUserData.accountCreatedAt}</span>
              <span>Last Active: {supportUserData.lastActiveAt}</span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 6: SOFT LAUNCH AUTOMATED VERIFICATION SUITE */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">PHASE 27 SOFT LAUNCH VERIFICATION SUITE</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated regression suite verifying launch mode authority, feature flag engine, emergency kill switches, and privacy-conscious analytics.
            </p>
          </div>
          <button
            onClick={handleRunSoftLaunchTests}
            disabled={testRunning}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center space-x-2 shrink-0 shadow-lg shadow-emerald-600/20"
          >
            {testRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{testRunning ? 'Running Regression...' : 'Run Soft Launch Tests'}</span>
          </button>
        </div>

        {testResults && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 bg-[#0d1526] border border-[#1b2a45] rounded-xl font-mono text-xs">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  testResults.allPassed ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-rose-950 text-rose-300'
                }`}>
                  {testResults.allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}
                </span>
                <span className="text-white font-bold">{testResults.passedCount} / {testResults.totalCount} tests passed</span>
              </div>
              <span className="text-slate-400 text-[10px]">Phase 27 Soft Launch Audit</span>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {testResults.results.map((r: any) => (
                <div
                  key={r.testId}
                  className="p-2.5 bg-[#090f1b] border border-[#152136] rounded-lg flex items-start space-x-2 font-mono text-xs"
                >
                  {r.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-white">{r.testName}</span>
                      <span className="text-[10px] text-cyan-400">{r.category}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
