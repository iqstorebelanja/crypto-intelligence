import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  Flame,
  HelpCircle,
  Layers,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  Zap
} from 'lucide-react';
import {
  JourneyFunnelStep,
  FeatureUsageMetric,
  ActivationStatusSummary,
  SegmentedCohortRetention,
  TrialCorrelationItem,
  ProCapabilityItem,
  RealUserPerformanceStats,
  ProductionErrorImpact,
  UserFeedbackItem
} from '../../types';

interface AdminProductOptimizationProps {
  token: string | null;
}

export const AdminProductOptimization: React.FC<AdminProductOptimizationProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Data states
  const [journeySteps, setJourneySteps] = useState<JourneyFunnelStep[]>([]);
  const [featureUsage, setFeatureUsage] = useState<any>(null);
  const [userSegments, setUserSegments] = useState<any>(null);
  const [activation, setActivation] = useState<ActivationStatusSummary | null>(null);
  const [retentionCohorts, setRetentionCohorts] = useState<SegmentedCohortRetention[]>([]);
  const [trialCorrelations, setTrialCorrelations] = useState<TrialCorrelationItem[]>([]);
  const [proCapabilities, setProCapabilities] = useState<ProCapabilityItem[]>([]);
  const [realUserPerf, setRealUserPerf] = useState<RealUserPerformanceStats | null>(null);
  const [errorImpacts, setErrorImpacts] = useState<ProductionErrorImpact[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserFeedbackItem[]>([]);

  // Configurable Activation State
  const [customDefName, setCustomDefName] = useState('');
  const [customThreshold, setCustomThreshold] = useState(1);
  const [isEditingActivation, setIsEditingActivation] = useState(false);

  // Test Runner State
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<any | null>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const loadAllOptimizationData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        resJourney,
        resUsage,
        resSegments,
        resActivation,
        resRet,
        resTrial,
        resPro,
        resPerf,
        resErrors,
        resFeedbacks
      ] = await Promise.all([
        fetch('/api/admin/analytics/journey-funnel', { headers: authHeaders }),
        fetch('/api/admin/analytics/feature-usage', { headers: authHeaders }),
        fetch('/api/admin/analytics/user-segments', { headers: authHeaders }),
        fetch('/api/admin/analytics/activation', { headers: authHeaders }),
        fetch('/api/admin/analytics/segmented-retention', { headers: authHeaders }),
        fetch('/api/admin/analytics/trial-correlations', { headers: authHeaders }),
        fetch('/api/admin/analytics/pro-value', { headers: authHeaders }),
        fetch('/api/admin/analytics/real-user-perf', { headers: authHeaders }),
        fetch('/api/admin/analytics/error-impact', { headers: authHeaders }),
        fetch('/api/admin/feedback', { headers: authHeaders })
      ]);

      if (resJourney.ok) {
        const d = await resJourney.json();
        setJourneySteps(d.steps || []);
      }
      if (resUsage.ok) {
        const d = await resUsage.json();
        setFeatureUsage(d.summary || null);
      }
      if (resSegments.ok) {
        const d = await resSegments.json();
        setUserSegments(d.segments || null);
      }
      if (resActivation.ok) {
        const d = await resActivation.json();
        setActivation(d.activation || null);
        if (d.activation) {
          setCustomDefName(d.activation.definitionName);
          setCustomThreshold(d.activation.thresholdCalls);
        }
      }
      if (resRet.ok) {
        const d = await resRet.json();
        setRetentionCohorts(d.cohorts || []);
      }
      if (resTrial.ok) {
        const d = await resTrial.json();
        setTrialCorrelations(d.correlations || []);
      }
      if (resPro.ok) {
        const d = await resPro.json();
        setProCapabilities(d.capabilities || []);
      }
      if (resPerf.ok) {
        const d = await resPerf.json();
        setRealUserPerf(d.perf || null);
      }
      if (resErrors.ok) {
        const d = await resErrors.json();
        setErrorImpacts(d.errors || []);
      }
      if (resFeedbacks.ok) {
        const d = await resFeedbacks.json();
        setFeedbacks(d.feedbacks || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load telemetry data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllOptimizationData();
  }, [token]);

  const handleUpdateActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/analytics/activation', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          definitionName: customDefName,
          thresholdCalls: customThreshold
        })
      });
      if (res.ok) {
        const d = await res.json();
        setActivation(d.activation);
        setIsEditingActivation(false);
        setActionSuccess('Activation definition updated dynamically.');
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResolveFeedback = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/feedback/${id}/resolve`, {
        method: 'POST',
        headers: authHeaders
      });
      if (res.ok) {
        setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, resolved: true } : f));
        setActionSuccess('Feedback marked as resolved.');
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRunPhase28Tests = async () => {
    try {
      setTestRunning(true);
      setTestResults(null);
      const res = await fetch('/api/admin/phase28/tests', { headers: authHeaders });
      if (res.ok) {
        const d = await res.json();
        setTestResults(d.summary);
      } else {
        throw new Error('Phase 28 test runner failed to execute.');
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
        <span className="text-slate-400 text-xs font-mono">Aggregating telemetry & product feedback...</span>
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

      {/* TOP HEADER */}
      <div className="p-5 bg-gradient-to-r from-[#0b101d] via-[#101726] to-[#0e1622] border border-[#1b273d] rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <Compass className="w-6 h-6 text-cyan-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              REAL USER FEEDBACK & PRODUCT OPTIMIZATION
            </h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border bg-indigo-950 text-indigo-300 border-indigo-500/40">
              PHASE 28 TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Data-driven product optimization derived strictly from observed behavior. Zero fabricated metrics.
          </p>
        </div>

        <button
          onClick={loadAllOptimizationData}
          className="px-3 py-1.5 bg-[#121c2e] hover:bg-[#18263e] border border-[#233552] rounded-xl text-xs font-mono text-slate-300 flex items-center space-x-2 transition-all self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* SECTION 1: 11-STAGE USER JOURNEY & DROP-OFF FUNNEL */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              END-TO-END USER JOURNEY FUNNEL (11 STAGES)
            </h3>
          </div>
          {journeySteps[0]?.insufficientData && (
            <span className="px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-600/50 rounded text-[10px] font-mono font-bold">
              INSUFFICIENT DATA (SAMPLE &lt; 10 USERS)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {journeySteps.map(step => (
            <div
              key={step.stepIndex}
              className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl space-y-1.5 font-mono text-xs"
            >
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span className="font-bold text-white truncate">{step.name}</span>
                <span className="text-cyan-400 font-bold">{step.uniqueUsers} users</span>
              </div>
              <div className="w-full bg-[#121a2c] rounded-full h-1.5 overflow-hidden border border-[#1a253d]">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min(step.conversionFromStart, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                <span>Conv: <strong className="text-white">{step.conversionFromStart}%</strong></span>
                <span className="flex items-center text-rose-400">
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  Drop: {step.dropOffRatePercent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: ACTIVATION RATE & SEGMENTED COHORT RETENTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurable Activation */}
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">USER ACTIVATION RATE</h3>
            </div>
            <button
              onClick={() => setIsEditingActivation(!isEditingActivation)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono underline"
            >
              {isEditingActivation ? 'Cancel' : 'Configure Definition'}
            </button>
          </div>

          {isEditingActivation ? (
            <form onSubmit={handleUpdateActivation} className="space-y-3 bg-[#090f1b] p-3 rounded-xl border border-[#172338]">
              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">Activation Definition Name:</label>
                <input
                  type="text"
                  value={customDefName}
                  onChange={e => setCustomDefName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0d1424] border border-[#1c2940] rounded text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">Required Event Threshold Calls:</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={customThreshold}
                  onChange={e => setCustomThreshold(parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 bg-[#0d1424] border border-[#1c2940] rounded text-xs text-white font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-mono font-bold"
              >
                Save Activation Rule
              </button>
            </form>
          ) : (
            activation && (
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#090f1b] rounded-xl border border-[#18243a] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400">ACTIVE DEFINITION</div>
                    <div className="text-white font-bold">{activation.definitionName}</div>
                    <div className="text-[10px] text-cyan-400 mt-0.5">Threshold: &gt;= {activation.thresholdCalls} calls</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-400">{activation.activationRatePercent}%</div>
                    <div className="text-[10px] text-slate-400">{activation.activatedUsers} / {activation.registeredUsers} users</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Activation definition is server-configurable. It measures users who reached their first meaningful aha-moment.
                </div>
              </div>
            )
          )}
        </div>

        {/* Segmented Retention (Free, Trial, Pro) */}
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">SEGMENTED COHORT RETENTION</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {retentionCohorts.map(cohort => (
              <div
                key={cohort.segment}
                className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl font-mono text-xs space-y-2 text-center"
              >
                <div className="text-[11px] font-bold text-cyan-400">{cohort.segment} COHORT</div>
                <div className="text-[10px] text-slate-400">Sample: {cohort.sampleSize} users</div>

                {cohort.insufficientData ? (
                  <div className="py-2 text-[10px] text-amber-400 bg-amber-950/40 rounded border border-amber-800/40 font-bold">
                    INSUFFICIENT DATA
                  </div>
                ) : (
                  <div className="space-y-1 text-left text-[11px] pt-1 border-t border-[#162035]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">D1:</span>
                      <strong className="text-white">{cohort.day1Percent}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">D7:</span>
                      <strong className="text-white">{cohort.day7Percent}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">D30:</span>
                      <strong className="text-white">{cohort.day30Percent}%</strong>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Cohorts separated by Free, Trial, and Pro without merging or fabricating retention curves.
          </div>
        </div>
      </div>

      {/* SECTION 3: FEATURE POPULARITY & CORRELATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most / Least Used Features */}
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
          <div className="flex items-center space-x-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">AGGREGATE FEATURE USAGE</h3>
          </div>

          {featureUsage && (
            <div className="space-y-3 font-mono text-xs">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold block mb-1.5">MOST USED CAPABILITIES</span>
                <div className="space-y-1.5">
                  {featureUsage.mostUsedFeatures.map((f: any, idx: number) => (
                    <div key={f.featureKey} className="p-2 bg-[#090f1b] rounded-lg border border-[#162238] flex justify-between">
                      <span className="text-white">#{idx + 1} {f.name}</span>
                      <span className="text-cyan-400 font-bold">{f.callCount} calls</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[#182338]">
                <span className="text-[10px] text-amber-400 font-bold block mb-1.5">LEAST USED CAPABILITIES</span>
                <div className="space-y-1.5">
                  {featureUsage.leastUsedFeatures.map((f: any) => (
                    <div key={f.featureKey} className="p-2 bg-[#090f1b] rounded-lg border border-[#162238] flex justify-between">
                      <span className="text-slate-300">{f.name}</span>
                      <span className="text-slate-400">{f.callCount} calls</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trial Conversion Correlations */}
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">TRIAL CONVERSION BEHAVIOR CORRELATIONS</h3>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {trialCorrelations.map(c => (
              <div key={c.behavior} className="p-2.5 bg-[#090f1b] rounded-xl border border-[#162238] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">{c.behavior}</span>
                  <span className="text-emerald-400 font-bold text-[11px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-600/40">
                    {c.correlationRatio}x Lift
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Converted users: {c.usagePercentInConverted}%</span>
                  <span>Expired users: {c.usagePercentInExpired}%</span>
                </div>
              </div>
            ))}

            <div className="p-2.5 bg-amber-950/30 border border-amber-600/30 rounded-xl text-[10px] text-amber-300 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>CRITICAL GOVERNANCE:</strong> Correlation only. Never claim causation without randomized verification.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: PRO VALUE ANALYSIS & REAL USER PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pro Capabilities Value */}
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">PRO CAPABILITY VALUE RANKING</h3>
          </div>

          <div className="space-y-1.5 font-mono text-xs max-h-64 overflow-y-auto pr-1">
            {proCapabilities.map(cap => (
              <div
                key={cap.capability}
                className="p-2 bg-[#090f1b] border border-[#152136] rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 font-bold w-5">#{cap.rank}</span>
                  <span className="text-white">{cap.capability}</span>
                </div>
                <span className="text-cyan-400 font-bold">{cap.proUsageCount} uses</span>
              </div>
            ))}
          </div>

          <div className="p-2.5 bg-cyan-950/40 border border-cyan-600/30 rounded-xl text-[10px] text-cyan-300 font-mono">
            <strong>SAFEGUARD:</strong> Do NOT automatically remove or sunset features based purely on low usage.
          </div>
        </div>

        {/* Real User Performance */}
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">REAL USER PERFORMANCE TELEMETRY</h3>
          </div>

          {realUserPerf && (
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-[#090f1b] rounded-xl border border-[#162238]">
                  <div className="text-[10px] text-slate-400">PAGE LOAD (AVG)</div>
                  <div className="text-white font-bold text-base">{realUserPerf.pageLoadAvgMs}ms</div>
                </div>
                <div className="p-2.5 bg-[#090f1b] rounded-xl border border-[#162238]">
                  <div className="text-[10px] text-slate-400">SCANNER LOAD (AVG)</div>
                  <div className="text-white font-bold text-base">{realUserPerf.scannerLoadAvgMs}ms</div>
                </div>
                <div className="p-2.5 bg-[#090f1b] rounded-xl border border-[#162238]">
                  <div className="text-[10px] text-slate-400">AI RESPONSE (AVG)</div>
                  <div className="text-white font-bold text-base">{realUserPerf.aiResponseAvgMs}ms</div>
                </div>
                <div className="p-2.5 bg-[#090f1b] rounded-xl border border-[#162238]">
                  <div className="text-[10px] text-slate-400">API LATENCY P95</div>
                  <div className="text-emerald-400 font-bold text-base">{realUserPerf.apiLatencyP95Ms}ms</div>
                </div>
              </div>

              <div className="p-2.5 bg-[#090f1b] rounded-xl border border-[#162238] flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Platform Split:</span>
                <span className="text-white">
                  Desktop: <strong>{realUserPerf.mobileVsDesktop.desktopPercent}%</strong> | Mobile: <strong>{realUserPerf.mobileVsDesktop.mobilePercent}%</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: REAL USER FEEDBACK REPOSITORY */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">REAL USER FEEDBACK & ACCURACY RATINGS</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{feedbacks.length} submissions recorded</span>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {feedbacks.length === 0 ? (
            <div className="p-4 bg-[#080d16] border border-[#152033] rounded-xl text-center text-slate-500">
              No user feedback recorded yet.
            </div>
          ) : (
            feedbacks.map(fb => (
              <div
                key={fb.id}
                className="p-3 bg-[#090f1b] border border-[#162238] rounded-xl space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="flex text-amber-400">
                      {[...Array(fb.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="px-2 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 uppercase">
                      {fb.category}
                    </span>
                    <span className="text-[10px] text-cyan-400">{fb.userTier} TIER</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-500">
                      {new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!fb.resolved ? (
                      <button
                        onClick={() => handleResolveFeedback(fb.id)}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-bold">Resolved</span>
                    )}
                  </div>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">{fb.message}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 6: PHASE 28 AUTOMATED TEST RUNNER */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">PHASE 28 OPTIMIZATION VERIFICATION SUITE</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated regression suite auditing 24 event types, 11-stage user funnel, trial correlations, activation definitions, and feedback lifecycles.
            </p>
          </div>
          <button
            onClick={handleRunPhase28Tests}
            disabled={testRunning}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center space-x-2 shrink-0 shadow-lg shadow-emerald-600/20"
          >
            {testRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{testRunning ? 'Running Regression...' : 'Run Phase 28 Tests'}</span>
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
              <span className="text-slate-400 text-[10px]">Phase 28 Optimization Audit</span>
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
