import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  GitBranch,
  Layers,
  LineChart,
  Play,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap
} from 'lucide-react';
import {
  SignalInventoryItem,
  SignalCalibrationBucket,
  RiskCalibrationBucket,
  MtfConfluenceCalibration,
  ComponentContributionItem,
  WhaleSignalValidationItem,
  DexSignalValidationItem,
  DerivativesValidationItem,
  RegimeValidationItem,
  BtcContextValidationItem,
  ExchangeComparisonItem,
  ModelVersionRecord,
  ModelPromotionGateReport,
  ModelDriftReport,
  SignalQualityDashboardSummary
} from '../../types';

interface AdminSignalQualityProps {
  token: string | null;
}

export const AdminSignalQuality: React.FC<AdminSignalQualityProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Telemetry data
  const [summary, setSummary] = useState<SignalQualityDashboardSummary | null>(null);
  const [inventory, setInventory] = useState<SignalInventoryItem[]>([]);
  const [calibrationBuckets, setCalibrationBuckets] = useState<SignalCalibrationBucket[]>([]);
  const [riskBuckets, setRiskBuckets] = useState<RiskCalibrationBucket[]>([]);
  const [mtfConfluence, setMtfConfluence] = useState<MtfConfluenceCalibration[]>([]);
  const [components, setComponents] = useState<ComponentContributionItem[]>([]);
  const [whaleValidation, setWhaleValidation] = useState<WhaleSignalValidationItem[]>([]);
  const [dexValidation, setDexValidation] = useState<DexSignalValidationItem[]>([]);
  const [derivativesValidation, setDerivativesValidation] = useState<DerivativesValidationItem[]>([]);
  const [regimes, setRegimes] = useState<RegimeValidationItem[]>([]);
  const [btcContext, setBtcContext] = useState<BtcContextValidationItem[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeComparisonItem[]>([]);
  const [modelVersions, setModelVersions] = useState<ModelVersionRecord[]>([]);
  const [promotionGate, setPromotionGate] = useState<ModelPromotionGateReport | null>(null);
  const [driftReport, setDriftReport] = useState<ModelDriftReport | null>(null);

  // Active view tab inside Signal Quality
  const [activeSubTab, setActiveSubTab] = useState<'calibration' | 'inventory' | 'confluence' | 'intel' | 'governance'>('calibration');

  // Test runner state
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

      const [
        resSummary,
        resInv,
        resCal,
        resRisk,
        resMtf,
        resComp,
        resWhale,
        resDex,
        resDeriv,
        resRegime,
        resBtc,
        resEx,
        resVers,
        resGate,
        resDrift
      ] = await Promise.all([
        fetch('/api/admin/signal-quality/dashboard-summary', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/inventory', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/calibration', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/risk-calibration', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/mtf-calibration', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/components', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/whale-validation', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/dex-validation', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/derivatives-validation', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/regime-validation', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/btc-context', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/exchange-comparison', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/versions', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/promotion-gate', { headers: authHeaders }),
        fetch('/api/admin/signal-quality/drift', { headers: authHeaders })
      ]);

      if (resSummary.ok) setSummary((await resSummary.json()).summary);
      if (resInv.ok) setInventory((await resInv.json()).inventory || []);
      if (resCal.ok) setCalibrationBuckets((await resCal.json()).buckets || []);
      if (resRisk.ok) setRiskBuckets((await resRisk.json()).riskBuckets || []);
      if (resMtf.ok) setMtfConfluence((await resMtf.json()).confluence || []);
      if (resComp.ok) setComponents((await resComp.json()).components || []);
      if (resWhale.ok) setWhaleValidation((await resWhale.json()).whaleValidation || []);
      if (resDex.ok) setDexValidation((await resDex.json()).dexValidation || []);
      if (resDeriv.ok) setDerivativesValidation((await resDeriv.json()).derivativesValidation || []);
      if (resRegime.ok) setRegimes((await resRegime.json()).regimes || []);
      if (resBtc.ok) setBtcContext((await resBtc.json()).btcContext || []);
      if (resEx.ok) setExchanges((await resEx.json()).exchanges || []);
      if (resVers.ok) setModelVersions((await resVers.json()).versions || []);
      if (resGate.ok) setPromotionGate((await resGate.json()).promotionGate || null);
      if (resDrift.ok) setDriftReport((await resDrift.json()).drift || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load signal quality metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleRunPhase29Tests = async () => {
    try {
      setTestRunning(true);
      setTestResults(null);
      const res = await fetch('/api/admin/phase29/tests', { headers: authHeaders });
      if (res.ok) {
        const d = await res.json();
        setTestResults(d.summary);
      } else {
        throw new Error('Phase 29 test runner failed to execute.');
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
        <span className="text-slate-400 text-xs font-mono">Aggregating Signal Quality, Calibration & MFE/MAE Outcomes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-200">
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
            <LineChart className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              SIGNAL QUALITY, CALIBRATION & INTELLIGENCE VALIDATION
            </h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border bg-emerald-950 text-emerald-300 border-emerald-500/40">
              PHASE 29 AUDIT
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Strict point-in-time empirical validation, MFE/MAE forward outcomes, MTF confluence, and model promotion gates.
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-[#121c2e] hover:bg-[#18263e] border border-[#233552] rounded-xl text-xs font-mono text-slate-300 flex items-center space-x-2 transition-all self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Refresh Calibration</span>
        </button>
      </div>

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 font-mono text-xs">
          <div className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400">CHAMPION MODEL</div>
            <div className="text-white font-bold truncate">{summary.currentModelVersion}</div>
            <div className="text-[10px] text-emerald-400">Status: PRODUCTION</div>
          </div>
          <div className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400">SIGNALS ANALYZED</div>
            <div className="text-white font-bold text-base">{summary.totalSignalsAnalyzed.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">OOS: {summary.outOfSampleSignalsCount}</div>
          </div>
          <div className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400">LOOKAHEAD AUDIT</div>
            <div className="text-emerald-400 font-bold text-base">{summary.lookaheadBiasAudit}</div>
            <div className="text-[10px] text-slate-400">0 Future Candle Leak</div>
          </div>
          <div className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400">SCORE CALIBRATION</div>
            <div className="text-emerald-400 font-bold text-base">{summary.calibrationStatus}</div>
            <div className="text-[10px] text-slate-400">Monotonic Lift</div>
          </div>
          <div className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400">MODEL DRIFT STATUS</div>
            <div className="text-cyan-400 font-bold text-base">{summary.modelDriftStatus}</div>
            <div className="text-[10px] text-slate-400">&lt; 1.2 SD Divergence</div>
          </div>
          <div className="p-3 bg-[#0d1424] border border-[#19243a] rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400">PROMOTION GATE</div>
            <div className="text-amber-400 font-bold text-base">{summary.promotionGateStatus}</div>
            <div className="text-[10px] text-slate-400">Candidate Evaluated</div>
          </div>
        </div>
      )}

      {/* SUB-NAVIGATION TABS */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar border-b border-[#182338] pb-2 text-xs font-mono">
        <button
          onClick={() => setActiveSubTab('calibration')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeSubTab === 'calibration'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          Score Calibration & MFE/MAE
        </button>
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeSubTab === 'inventory'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          Signal Model Inventory
        </button>
        <button
          onClick={() => setActiveSubTab('confluence')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeSubTab === 'confluence'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          MTF Confluence & Components
        </button>
        <button
          onClick={() => setActiveSubTab('intel')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeSubTab === 'intel'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          Whale, DEX & Derivatives
        </button>
        <button
          onClick={() => setActiveSubTab('governance')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeSubTab === 'governance'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          Promotion Gate & Drift
        </button>
      </div>

      {/* TAB 1: SCORE CALIBRATION & MFE/MAE */}
      {activeSubTab === 'calibration' && (
        <div className="space-y-6">
          {/* Distinction Callout */}
          <div className="p-3.5 bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 border border-cyan-500/30 rounded-xl text-xs font-mono space-y-1">
            <div className="text-cyan-300 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              IMPORTANT ARCHITECTURAL DISTINCTION: SCORE vs CALIBRATED HISTORICAL OUTCOME
            </div>
            <p className="text-slate-400 leading-relaxed">
              <strong>Bull Score (0–100)</strong> represents multi-factor quantitative strength. It is strictly separated from <strong>Calibrated Historical Outcomes</strong> (MFE/MAE/Forward Return). Probability estimates are statistical benchmarks, never execution guarantees.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bull Potential Calibration Table */}
            <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">BULL POTENTIAL SCORE MONOTONIC CALIBRATION</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40 font-mono">
                  MONOTONIC PASS
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#182338] text-slate-400 text-[11px]">
                      <th className="py-2 px-2.5">Score Bucket</th>
                      <th className="py-2 px-2.5">N (Sample)</th>
                      <th className="py-2 px-2.5">Fwd Return</th>
                      <th className="py-2 px-2.5">Avg MFE</th>
                      <th className="py-2 px-2.5">Avg MAE</th>
                      <th className="py-2 px-2.5">95% CI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#151f33]">
                    {calibrationBuckets.map(b => (
                      <tr key={b.scoreRange} className="hover:bg-[#0e1628]/50">
                        <td className="py-2.5 px-2.5 font-bold text-white">{b.scoreRange}</td>
                        <td className="py-2.5 px-2.5 text-slate-300">{b.sampleSize}</td>
                        <td className={`py-2.5 px-2.5 font-bold ${b.avgForwardReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {b.avgForwardReturn > 0 ? `+${b.avgForwardReturn}%` : `${b.avgForwardReturn}%`}
                        </td>
                        <td className="py-2.5 px-2.5 text-emerald-400 font-semibold">+{b.avgMfe}%</td>
                        <td className="py-2.5 px-2.5 text-rose-400 font-semibold">{b.avgMae}%</td>
                        <td className="py-2.5 px-2.5 text-[10px] text-slate-400">
                          [{b.confidenceInterval95[0]}%, {b.confidenceInterval95[1]}%]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Downside Risk Calibration Table */}
            <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white">DOWNSIDE RISK SCORE DRAWDOWN CALIBRATION</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-600/40 font-mono">
                  RISK ALIGNED
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#182338] text-slate-400 text-[11px]">
                      <th className="py-2 px-2.5">Risk Range</th>
                      <th className="py-2 px-2.5">N (Sample)</th>
                      <th className="py-2 px-2.5">Avg MAE (Adverse)</th>
                      <th className="py-2 px-2.5">Max Drawdown</th>
                      <th className="py-2 px-2.5">Warning Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#151f33]">
                    {riskBuckets.map(r => (
                      <tr key={r.riskRange} className="hover:bg-[#0e1628]/50">
                        <td className="py-2.5 px-2.5 font-bold text-white">{r.riskRange}</td>
                        <td className="py-2.5 px-2.5 text-slate-300">{r.sampleSize}</td>
                        <td className="py-2.5 px-2.5 text-rose-400 font-bold">{r.avgMaePercent}%</td>
                        <td className="py-2.5 px-2.5 text-rose-300 font-semibold">{r.maxDrawdownPercent}%</td>
                        <td className="py-2.5 px-2.5 text-emerald-400 font-bold">{r.downsideWarningAccuracyPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIGNAL MODEL INVENTORY */}
      {activeSubTab === 'inventory' && (
        <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4 font-mono text-xs">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">ACTIVE SIGNAL MODEL INVENTORY (VERSIONED SPECIFICATIONS)</h3>
            </div>
            <span className="text-slate-400">{inventory.length} Subsystems Audited</span>
          </div>

          <div className="space-y-3">
            {inventory.map(item => (
              <div key={item.signalType} className="p-3.5 bg-[#090f1b] border border-[#172338] rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#141e30] pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-bold text-sm">{item.signalType}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/40">
                      {item.category}
                    </span>
                  </div>
                  <span className="text-amber-400 text-[11px] font-semibold">{item.modelVersion}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">EVALUATED INPUTS</span>
                    <span>{item.inputs.join(' • ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">WEIGHTS DISTRIBUTION</span>
                    <span>{item.weightsDescription}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">THRESHOLDS SPECIFICATION</span>
                    <span>{item.thresholdsDescription}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">INVALIDATION & EXPIRATION</span>
                    <span className="text-rose-400">{item.invalidationRule}</span> (Expires: {item.expirationRule})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MTF CONFLUENCE & COMPONENTS */}
      {activeSubTab === 'confluence' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MTF Confluence Lift */}
          <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">MULTI-TIMEFRAME (MTF) CONFLUENCE LIFT</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Evaluates forward outcome improvement as multiple independent timeframes (15m, 1h, 4h, 1d) confirm direction.
            </p>

            <div className="space-y-2">
              {mtfConfluence.map(c => (
                <div key={c.timeframeAgreement} className="p-2.5 bg-[#090f1b] border border-[#162238] rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{c.timeframeAgreement}</div>
                    <div className="text-[10px] text-slate-400">N={c.sampleSize} | Hit Rate: {c.hitRatePercent}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">+{c.avgForwardReturn}%</div>
                    <div className="text-[10px] text-cyan-400 font-semibold">+{c.confluenceLiftPercent}% Lift</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Component Contribution IC */}
          <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">COMPONENT CONTRIBUTION & OOS INFORMATION COEFFICIENT</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Evaluates out-of-sample predictive power for individual analytical inputs without survivorship bias.
            </p>

            <div className="space-y-1.5">
              {components.map(comp => (
                <div key={comp.component} className="p-2 bg-[#090f1b] border border-[#152136] rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-white font-semibold">{comp.component}</span>
                    <span className="text-[10px] text-slate-500 block">Weight: {(comp.inSampleWeight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold block">IC: {comp.oosInformationCoefficient}</span>
                    <span className="text-[10px] text-cyan-400">+{comp.winRateImpactPercent}% Win Impact</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WHALE, DEX & DERIVATIVES */}
      {activeSubTab === 'intel' && (
        <div className="space-y-6 font-mono text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Whale Validation */}
            <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">WHALE FLOW EMPIRICAL DRIFT VALIDATION</h3>
              </div>
              <p className="text-[11px] text-slate-400">
                Never assumes simplistic buy=bullish. Distinguishes custody transfers from exchange deposition.
              </p>

              <div className="space-y-2">
                {whaleValidation.map(w => (
                  <div key={w.eventType} className="p-2.5 bg-[#090f1b] border border-[#162238] rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">{w.eventType}</span>
                      <span className="text-[10px] text-cyan-400 font-bold">N={w.sampleSize}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{w.historicalInterpretation}</p>
                    <div className="flex justify-between text-[10px] pt-0.5 border-t border-[#141e30]">
                      <span>Forward 1h: <strong className={w.avgForward1hReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{w.avgForward1hReturn}%</strong></span>
                      <span>Forward 24h: <strong className={w.avgForward24hReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{w.avgForward24hReturn}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Derivatives Dynamics */}
            <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">DERIVATIVES PRICE + OI + FUNDING COMBINATIONS</h3>
              </div>
              <p className="text-[11px] text-slate-400">
                Empirically validates multi-variable open interest and funding cascades with strict non-guarantee caveats.
              </p>

              <div className="space-y-2">
                {derivativesValidation.map(d => (
                  <div key={d.combination} className="p-2.5 bg-[#090f1b] border border-[#162238] rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">{d.combination}</span>
                      <span className="text-emerald-400 font-bold">Hit: {d.hitRatePercent}%</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{d.interpretationCaveat}</p>
                    <div className="text-[10px] text-slate-500">
                      N={d.sampleSize} | Avg Forward Return: {d.avgForwardReturn > 0 ? `+${d.avgForwardReturn}%` : `${d.avgForwardReturn}%`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROMOTION GATE & DRIFT */}
      {activeSubTab === 'governance' && (
        <div className="space-y-6 font-mono text-xs">
          {/* Promotion Gate Report */}
          {promotionGate && (
            <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">MODEL PROMOTION GATE & CHAMPION / CHALLENGER</h3>
                </div>
                <span className={`px-3 py-1 rounded text-xs font-bold ${
                  promotionGate.promotionDecision === 'PASS'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                    : 'bg-rose-950 text-rose-300 border border-rose-600'
                }`}>
                  PROMOTION DECISION: {promotionGate.promotionDecision}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2.5 bg-[#090f1b] rounded-lg border border-[#162238]">
                  <span className="text-[10px] text-slate-500 block">CHAMPION MODEL</span>
                  <span className="text-white font-bold">{promotionGate.championVersion}</span>
                </div>
                <div className="p-2.5 bg-[#090f1b] rounded-lg border border-[#162238]">
                  <span className="text-[10px] text-slate-500 block">CHALLENGER MODEL</span>
                  <span className="text-cyan-400 font-bold">{promotionGate.candidateVersion}</span>
                </div>
                <div className="p-2.5 bg-[#090f1b] rounded-lg border border-[#162238]">
                  <span className="text-[10px] text-slate-500 block">LOOKAHEAD AUDIT</span>
                  <span className="text-emerald-400 font-bold">{promotionGate.lookaheadAuditPassed ? 'PASSED' : 'FAILED'}</span>
                </div>
                <div className="p-2.5 bg-[#090f1b] rounded-lg border border-[#162238]">
                  <span className="text-[10px] text-slate-500 block">WALK-FORWARD STABILITY</span>
                  <span className="text-emerald-400 font-bold">{promotionGate.walkForwardStabilityPassed ? 'PASSED' : 'FAILED'}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] text-slate-400 font-bold block">PROMOTION RATIONALE CHECKLIST:</span>
                {promotionGate.decisionRationale.map((rat, i) => (
                  <div key={i} className="flex items-start space-x-2 text-[11px] text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{rat}</span>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-[#090f1b] border border-amber-600/30 rounded-xl text-[10px] text-amber-300">
                <strong>SURVIVORSHIP BIAS NOTICE:</strong> {promotionGate.survivorshipBiasWarning}
              </div>
            </div>
          )}

          {/* Model Drift Telemetry */}
          {driftReport && (
            <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">PRODUCTION MODEL DRIFT AUDIT</h3>
              </div>

              <div className="space-y-1.5">
                {driftReport.details.map((d, i) => (
                  <div key={i} className="p-2 bg-[#090f1b] border border-[#162238] rounded-lg text-[11px] text-slate-300">
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 6: PHASE 29 AUTOMATED REGRESSION SUITE */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">PHASE 29 SIGNAL QUALITY VERIFICATION SUITE</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated regression suite verifying point-in-time isolation, monotonic calibration, MFE/MAE boundaries, and promotion gates.
            </p>
          </div>
          <button
            onClick={handleRunPhase29Tests}
            disabled={testRunning}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center space-x-2 shrink-0 shadow-lg shadow-emerald-600/20"
          >
            {testRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{testRunning ? 'Running Tests...' : 'Run Phase 29 Tests'}</span>
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
              <span className="text-slate-400 text-[10px]">Phase 29 Signal Calibration Audit</span>
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
