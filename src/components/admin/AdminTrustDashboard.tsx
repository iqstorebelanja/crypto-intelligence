import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Flame,
  HelpCircle,
  Layers,
  Lock,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap
} from 'lucide-react';
import { TrustDashboardMetrics } from '../../types';

export interface AdminTrustDashboardProps {
  token: string;
}

export const AdminTrustDashboard: React.FC<AdminTrustDashboardProps> = ({ token }) => {
  const [metrics, setMetrics] = useState<TrustDashboardMetrics | null>(null);
  const [feedbackRecords, setFeedbackRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resTrust, resFeedback] = await Promise.all([
        fetch('/api/admin/intelligence/trust', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/intelligence/feedback', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!resTrust.ok) throw new Error(`HTTP ${resTrust.status}`);
      const dataTrust = await resTrust.json();
      setMetrics(dataTrust.metrics);

      if (resFeedback.ok) {
        const dataFb = await resFeedback.json();
        setFeedbackRecords(dataFb.records || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trust metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#182338] gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              PHASE 30
            </span>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Intelligence Explainability & Trust Layer Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Audit coverage, evidence completeness, missing data rate, and model transparency based on live observations.
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-[#162032] hover:bg-[#1d2a42] text-slate-200 border border-[#223049] text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
          Audit Error: {error}
        </div>
      )}

      {metrics && (
        <>
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1b273d] space-y-1">
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Explanation Coverage</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {metrics.explanationCoveragePercent}%
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {metrics.totalSignalsAudited} signals dynamically covered
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1b273d] space-y-1">
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Evidence Completeness</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">
                {metrics.evidenceCompletenessPercent}%
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Real indicators, structure & derivatives</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1b273d] space-y-1">
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Contradiction Rate</div>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {metrics.contradictionRatePercent}%
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Divergent signals flagged to users</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1b273d] space-y-1">
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Missing Data Rate</div>
              <div className="text-2xl font-bold text-slate-300 font-mono">
                {metrics.missingDataRatePercent}%
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Handled explicitly as UNAVAILABLE</div>
            </div>
          </div>

          {/* Detailed Audit Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Confidence & Model Version Distribution */}
            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1b273d] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#182338] pb-2">
                <span className="font-bold text-white">Confidence Label Distribution</span>
                <span className="text-[10px] text-slate-400">Analytical Completeness</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400">HIGH CONFIDENCE</span>
                  <span className="font-bold text-slate-200">{metrics.confidenceDistribution.high}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400">MEDIUM CONFIDENCE</span>
                  <span className="font-bold text-slate-200">{metrics.confidenceDistribution.medium}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-400">LOW CONFIDENCE</span>
                  <span className="font-bold text-slate-200">{metrics.confidenceDistribution.low}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">INSUFFICIENT DATA</span>
                  <span className="font-bold text-slate-200">{metrics.confidenceDistribution.insufficientData}%</span>
                </div>
              </div>
              <div className="pt-2 text-[10px] text-slate-500 border-t border-[#182338]">
                Active Models: {Object.keys(metrics.modelVersionDistribution).join(', ')}
              </div>
            </div>

            {/* User Feedback Telemetry */}
            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1b273d] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#182338] pb-2">
                <span className="font-bold text-white">User Explanation Feedback ({feedbackRecords.length})</span>
                <span className="text-[10px] text-slate-400">Section 19 Telemetry</span>
              </div>
              {feedbackRecords.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  Zero negative feedback reports received. Explanations operating normally.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {feedbackRecords.slice(0, 5).map((fb: any) => (
                    <div key={fb.id} className="p-2 rounded bg-[#121a2c] flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-bold text-cyan-300">{fb.symbol}</span>
                        <span className="text-slate-400 ml-2">{fb.isHelpful ? '👍 Helpful' : '👎 Not helpful'}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{fb.comment || fb.reason || 'General'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
