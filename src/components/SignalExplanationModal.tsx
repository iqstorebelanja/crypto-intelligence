import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Minus,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Waves,
  X,
  Zap
} from 'lucide-react';
import {
  ClassifiedEvidenceItem,
  DataProvenanceItem,
  DataQualityReport,
  InvalidationConditionItem,
  NormalizedCoinData,
  SignalConfidenceLabel,
  SignalExplanationOutput,
  SignalStatePhase30,
  SignalTimelineEntry,
  Timeframe,
  TimeframeConfluenceEvidence,
  User
} from '../types';

export interface SignalExplanationModalProps {
  coin: NormalizedCoinData;
  timeframe?: Timeframe;
  user?: User | null;
  onClose: () => void;
  onOpenUpgrade?: (context?: string) => void;
}

export const SignalExplanationModal: React.FC<SignalExplanationModalProps> = ({
  coin,
  timeframe = '1h',
  user,
  onClose,
  onOpenUpgrade
}) => {
  const [explanation, setExplanation] = useState<SignalExplanationOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'evidence' | 'bull_risk' | 'mtf' | 'provenance' | 'timeline'>('evidence');
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // User feedback state
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [isHelpful, setIsHelpful] = useState<boolean | null>(null);
  const [feedbackReason, setFeedbackReason] = useState<string>('');
  const [feedbackComment, setFeedbackComment] = useState<string>('');

  const isProUser = Boolean(user?.isPro || user?.tier === 'PRO' || user?.role === 'admin' || user?.trialStatus === 'ACTIVE');
  const isAllowedBenchmark = coin.symbol.includes('BTC') || coin.symbol.includes('ETH');
  const isLockedForUser = !isProUser && !isAllowedBenchmark;

  useEffect(() => {
    let isMounted = true;
    const fetchExplanation = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token') || '';
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `/api/market/signal-explanation/${encodeURIComponent(coin.symbol)}?timeframe=${timeframe}&exchange=${coin.exchange}`,
          { headers }
        );

        if (!res.ok) {
          if (res.status === 403) {
            setError('PRO_REQUIRED');
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        if (isMounted) {
          setExplanation(data.explanation);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to generate explanation');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchExplanation();
    return () => {
      isMounted = false;
    };
  }, [coin.symbol, coin.exchange, timeframe]);

  const handleSendFeedback = async (helpful: boolean) => {
    setIsHelpful(helpful);
    try {
      const token = localStorage.getItem('token') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/market/explanation-feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          signalId: explanation?.signalId || `sig_${coin.symbol}`,
          symbol: coin.symbol,
          isHelpful: helpful,
          reason: feedbackReason || undefined,
          comment: feedbackComment || undefined
        })
      });
      setFeedbackSubmitted(true);
    } catch {
      // Non-blocking
      setFeedbackSubmitted(true);
    }
  };

  const getConfidenceBadgeColor = (label?: SignalConfidenceLabel) => {
    switch (label) {
      case 'HIGH CONFIDENCE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'MEDIUM CONFIDENCE':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'LOW CONFIDENCE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getStateBadgeColor = (state?: SignalStatePhase30) => {
    switch (state) {
      case 'STRENGTHENING':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'ACTIVE':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'WEAKENING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'INVALIDATED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'STALE':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0b0f19] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#182338] bg-gradient-to-r from-[#0d1424] via-[#090d16] to-[#0d1424] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Why This Signal? — {coin.symbol}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-[#141d2e] text-slate-300 border border-[#223049]">
                  {coin.exchange} • {timeframe}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Explainability & Trust Layer • Mathematical Evidence Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#182338] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400 font-mono">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-xs">Evaluating point-in-time mathematical evidence & provenance...</p>
            </div>
          ) : error === 'PRO_REQUIRED' || isLockedForUser ? (
            <div className="py-12 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">PRO Intelligence Explainability</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Full evidence classification, multi-timeframe divergence breakdown, and data provenance for altcoins ({coin.symbol}) are reserved for PRO members.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenUpgrade?.('SIGNAL_EXPLAINABILITY_ALTCOIN');
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                Upgrade to PRO (or Activate 7-Day Trial)
              </button>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
              Failed to load signal explanation: {error}
            </div>
          ) : explanation ? (
            <>
              {/* Top Banner: Signal Status & Trust Barometer */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-1">
                  <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Signal Setup</div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white font-mono">{explanation.signalType.replace(/_/g, ' ')}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${getStateBadgeColor(explanation.signalState)}`}>
                      {explanation.signalState}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-1">
                  <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Analytical Confidence</div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${getConfidenceBadgeColor(explanation.confidenceLabel)}`}>
                      {explanation.confidenceLabel}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">({explanation.confidenceScore}%)</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">Analytical completeness, not profit %</div>
                </div>

                <div className="p-3 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-1">
                  <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Bull Potential</div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-emerald-400 font-mono">{explanation.bullScore}/100</span>
                    <span className="text-[10px] text-slate-400 font-mono">Risk: {explanation.downsideRisk}/100</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-1">
                  <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Data Quality Score</div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-cyan-400 font-mono">
                      {explanation.dataQuality.score !== null ? `${explanation.dataQuality.score}/100` : 'N/A'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono">
                      {explanation.dataQuality.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contradiction Alert if exists */}
              {explanation.hasContradiction && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3 text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-300 uppercase tracking-wide font-mono text-[11px]">
                      Contradicting Evidence Detected
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed font-sans">
                      {explanation.contradictionSummary || 'Signal contains divergent evidence across momentum or higher timeframes.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex items-center space-x-2 border-b border-[#182338] pb-2 text-xs font-mono">
                <button
                  onClick={() => setActiveTab('evidence')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'evidence'
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-[#141c2b]'
                  }`}
                >
                  Evidence Breakdown ({explanation.supportingEvidence.length} Supp / {explanation.conflictingEvidence.length} Conf)
                </button>
                <button
                  onClick={() => setActiveTab('bull_risk')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'bull_risk'
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-[#141c2b]'
                  }`}
                >
                  Score Engine Rationale
                </button>
                <button
                  onClick={() => setActiveTab('mtf')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'mtf'
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-[#141c2b]'
                  }`}
                >
                  MTF Confluence
                </button>
                <button
                  onClick={() => setActiveTab('provenance')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'provenance'
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-[#141c2b]'
                  }`}
                >
                  Data Provenance
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'timeline'
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-[#141c2b]'
                  }`}
                >
                  Signal Timeline
                </button>
              </div>

              {/* Tab 1: Evidence Breakdown */}
              {activeTab === 'evidence' && (
                <div className="space-y-4">
                  {/* Summary Callout */}
                  <div className="p-3.5 rounded-xl bg-[#0e1626] border border-[#1b273d] text-xs space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Objective Synthesis
                    </div>
                    <p className="text-slate-200 leading-relaxed font-sans">{explanation.conclusion}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Supporting Evidence */}
                    <div className="space-y-2.5">
                      <div className="flex items-center space-x-2 text-xs font-mono font-bold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Supporting Evidence ({explanation.supportingEvidence.length})</span>
                      </div>
                      <div className="space-y-2">
                        {explanation.supportingEvidence.map(item => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-300 font-mono">{item.factor}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                                {item.category}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed">{item.description}</p>
                            <div className="text-[9px] text-slate-500 font-mono flex items-center justify-between pt-1">
                              <span>Source: {item.source}</span>
                              <span>{item.freshnessSeconds}s ago</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Conflicting Evidence */}
                    <div className="space-y-2.5">
                      <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Conflicting & Cautionary Factors ({explanation.conflictingEvidence.length})</span>
                      </div>
                      <div className="space-y-2">
                        {explanation.conflictingEvidence.length === 0 ? (
                          <div className="p-3 rounded-xl bg-[#0f172a] border border-[#1e293b] text-slate-400 text-xs font-mono">
                            Zero conflicting momentum or structural signals detected on 1H timeframe.
                          </div>
                        ) : (
                          explanation.conflictingEvidence.map(item => (
                            <div
                              key={item.id}
                              className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-300 font-mono">{item.factor}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-mono">
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-slate-300 text-[11px] leading-relaxed">{item.description}</p>
                              <div className="text-[9px] text-slate-500 font-mono flex items-center justify-between pt-1">
                                <span>Source: {item.source}</span>
                                <span>{item.freshnessSeconds}s ago</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Invalidation Conditions */}
                  <div className="pt-2 space-y-2">
                    <div className="text-xs font-mono font-bold text-slate-300 flex items-center space-x-2">
                      <AlertOctagon className="w-4 h-4 text-rose-400" />
                      <span>Signal Invalidation Conditions (What negates this signal?)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {explanation.invalidationConditions.map(cond => (
                        <div
                          key={cond.id}
                          className="p-2.5 rounded-xl bg-[#0f172a] border border-[#1e293b] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-bold text-slate-200">{cond.condition}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                cond.currentStatus === 'TRIGGERED'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {cond.currentStatus}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{cond.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Score Engine Rationale */}
              {activeTab === 'bull_risk' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bull Potential Breakdown */}
                    <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-white font-mono">
                          Bull Potential Breakdown ({explanation.bullScore}/100)
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400">Production Engine</span>
                      </div>
                      <div className="space-y-2 text-xs font-mono">
                        {coin.scores?.componentBreakdown ? (
                          Object.entries(coin.scores.componentBreakdown).map(([k, v]) => (
                            <div
                              key={k}
                              onClick={() => setSelectedComponent(k)}
                              className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                                selectedComponent === k ? 'bg-cyan-500/20 border border-cyan-500/40' : 'bg-[#141d2e] hover:bg-[#1a253a]'
                              }`}
                            >
                              <span className="capitalize text-slate-300">{k} Component</span>
                              <span className="font-bold text-cyan-300">{v}/100</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-400 text-xs">Standard component calculation active.</div>
                        )}
                      </div>
                    </div>

                    {/* Downside Risk Breakdown */}
                    <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-white font-mono">
                          Why Downside Risk ({explanation.downsideRisk}/100)?
                        </div>
                        <span className="text-[10px] font-mono text-amber-400">Risk Model v1.0.0</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        Downside risk reflects vulnerability to pullbacks or structural breakdown based on current price versus MA50, volume exhaustion, and support distance.
                      </p>
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Risk Invalidation / Reduction Conditions:</div>
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                          <li>Price holds support cleanly with volume stabilization</li>
                          <li>Moving average cross avoids death-cross convergence</li>
                          <li>Funding rate remains within normal bounds (&lt; 0.02%)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: MTF Confluence */}
              {activeTab === 'mtf' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-300">
                    Evaluation of structural and trend indicators across 5 primary horizons. Shorter timeframes reflect immediate momentum while higher timeframes reflect dominant macro trends.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                    {explanation.timeframeEvidence.map(tf => (
                      <div
                        key={tf.timeframe}
                        className={`p-3 rounded-xl border text-center space-y-1 ${
                          tf.direction === 'BULLISH'
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                            : tf.direction === 'BEARISH'
                            ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                            : 'bg-[#0f172a] border-[#1e293b] text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold font-mono">{tf.timeframe}</div>
                        <div className="text-sm font-mono font-bold">{tf.bias}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Score: {tf.score}/100</div>
                        <div className="text-[9px] text-slate-500 font-mono pt-1">{tf.trendSummary}</div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-xl bg-[#0f172a] border border-[#1e293b] text-xs font-mono text-slate-400">
                    <span className="text-cyan-400 font-bold">Confluence Note: </span>
                    {explanation.timeframeEvidence.filter(t => t.direction === 'BULLISH').length >= 3
                      ? 'Solid multi-timeframe alignment across intraday and daily charts.'
                      : 'Mixed/transitional state. Caution against assuming short-term moves overwrite higher timeframe trends.'}
                  </div>
                </div>
              )}

              {/* Tab 4: Data Provenance */}
              {activeTab === 'provenance' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="text-slate-300 text-[11px] font-sans">
                    Every calculation is stamped with authoritative source metadata, exchange origin, and real-time freshness telemetry.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#1b273d] text-[10px] text-slate-400 uppercase tracking-wider">
                          <th className="py-2 px-3">Stream / Layer</th>
                          <th className="py-2 px-3">Provider</th>
                          <th className="py-2 px-3">Exchange</th>
                          <th className="py-2 px-3">Freshness</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#151f33] text-slate-300 text-[11px]">
                        {explanation.sourceEvidence.map((s, idx) => (
                          <tr key={idx} className="hover:bg-[#121a2c]">
                            <td className="py-2 px-3 font-bold text-white">{s.streamName}</td>
                            <td className="py-2 px-3">{s.provider}</td>
                            <td className="py-2 px-3">{s.exchange}</td>
                            <td className="py-2 px-3 text-slate-400">{s.freshnessText}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  s.status === 'LIVE'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : s.status === 'STALE'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-slate-500/10 text-slate-400'
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-3 border-t border-[#182338] text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Model: {explanation.modelVersion.signalModel}</span>
                    <span>Scoring: {explanation.modelVersion.scoringModel}</span>
                    <span>Generated: {new Date(explanation.generatedAt).toISOString()}</span>
                  </div>
                </div>
              )}

              {/* Tab 5: Signal Timeline */}
              {activeTab === 'timeline' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="text-slate-300 text-[11px] font-sans">
                    Immutable event progression audit trail for this signal snapshot.
                  </div>
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#1e293b]">
                    {explanation.timeline.map((entry, idx) => (
                      <div key={entry.id} className="relative space-y-0.5">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-[#0b0f19]" />
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                          <span>{entry.timeFormatted}</span>
                          <span className="text-cyan-400 font-bold uppercase">{entry.eventType}</span>
                        </div>
                        <div className="text-xs font-bold text-white">{entry.title}</div>
                        <p className="text-[11px] text-slate-300 font-sans">{entry.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom: Nature of Signal & User Feedback */}
              <div className="pt-3 border-t border-[#182338] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-[10px] text-slate-500 font-mono">
                  {explanation.natureOfSignal.explanation}
                </div>

                {/* Feedback Widget */}
                <div className="flex items-center space-x-2 font-mono text-xs">
                  <span className="text-slate-400 text-[11px]">Was this explanation useful?</span>
                  {feedbackSubmitted ? (
                    <span className="text-emerald-400 text-[11px] font-bold">Thanks for your feedback!</span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSendFeedback(true)}
                        className="px-2 py-1 rounded bg-[#162032] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-[#223049] flex items-center space-x-1"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>Helpful</span>
                      </button>
                      <button
                        onClick={() => handleSendFeedback(false)}
                        className="px-2 py-1 rounded bg-[#162032] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-[#223049] flex items-center space-x-1"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span>Not helpful</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
