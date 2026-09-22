import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  History,
  Info,
  RefreshCw,
  Save,
  Sliders,
  TrendingUp,
  Zap
} from 'lucide-react';
import { ScoreConfigVersion } from '../../types';

interface BullWeights {
  trendWeight: number;
  rsiWeight: number;
  volumeWeight: number;
  bollingerWeight: number;
  momentumWeight: number;
  structureWeight: number;
  oiWeight: number;
  fundingWeight: number;
}

interface RiskWeights {
  rsiExtremeWeight: number;
  maBreakdownWeight: number;
  volumeWeaknessWeight: number;
  momentumLossWeight: number;
  supportLossWeight: number;
  bearishStructureWeight: number;
  derivativesRiskWeight: number;
}

interface ScoringConfigResponse {
  bull: BullWeights & { version: number; totalWeight: number };
  risk: RiskWeights & { version: number; totalWeight: number };
  history: ScoreConfigVersion[];
}

interface AdminScoringConfigProps {
  token: string | null;
}

export const AdminScoringConfig: React.FC<AdminScoringConfigProps> = ({ token }) => {
  const [data, setData] = useState<ScoringConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bull state
  const [bullWeights, setBullWeights] = useState<BullWeights>({
    trendWeight: 20,
    rsiWeight: 10,
    volumeWeight: 15,
    bollingerWeight: 10,
    momentumWeight: 10,
    structureWeight: 20,
    oiWeight: 10,
    fundingWeight: 5
  });
  const [bullNotes, setBullNotes] = useState('');
  const [savingBull, setSavingBull] = useState(false);
  const [bullMsg, setBullMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Risk state
  const [riskWeights, setRiskWeights] = useState<RiskWeights>({
    rsiExtremeWeight: 20,
    maBreakdownWeight: 20,
    volumeWeaknessWeight: 15,
    momentumLossWeight: 15,
    supportLossWeight: 15,
    bearishStructureWeight: 15,
    derivativesRiskWeight: 0
  });
  const [riskNotes, setRiskNotes] = useState('');
  const [savingRisk, setSavingRisk] = useState(false);
  const [riskMsg, setRiskMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/scoring/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to load scoring config: HTTP ${res.status}`);
      const json: ScoringConfigResponse = await res.json();
      setData(json);
      if (json.bull) {
        setBullWeights({
          trendWeight: json.bull.trendWeight,
          rsiWeight: json.bull.rsiWeight,
          volumeWeight: json.bull.volumeWeight,
          bollingerWeight: json.bull.bollingerWeight,
          momentumWeight: json.bull.momentumWeight,
          structureWeight: json.bull.structureWeight,
          oiWeight: json.bull.oiWeight,
          fundingWeight: json.bull.fundingWeight
        });
      }
      if (json.risk) {
        setRiskWeights({
          rsiExtremeWeight: json.risk.rsiExtremeWeight,
          maBreakdownWeight: json.risk.maBreakdownWeight,
          volumeWeaknessWeight: json.risk.volumeWeaknessWeight,
          momentumLossWeight: json.risk.momentumLossWeight,
          supportLossWeight: json.risk.supportLossWeight,
          bearishStructureWeight: json.risk.bearishStructureWeight,
          derivativesRiskWeight: json.risk.derivativesRiskWeight ?? 0
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  const bullSum = Object.values(bullWeights).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const riskSum = Object.values(riskWeights).reduce((acc, v) => acc + (Number(v) || 0), 0);

  const handleSaveBull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bullSum !== 100) {
      setBullMsg({ type: 'error', text: `Total weights must sum to exactly 100%. Current sum: ${bullSum}%` });
      return;
    }
    try {
      setSavingBull(true);
      setBullMsg(null);
      const res = await fetch('/api/admin/scoring/bull', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          weights: bullWeights,
          notes: bullNotes.trim() || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update Bull Score config');
      setBullMsg({ type: 'success', text: `Bull Score updated to version v${json.config.version}` });
      setBullNotes('');
      fetchConfig();
    } catch (err) {
      setBullMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setSavingBull(false);
    }
  };

  const handleSaveRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (riskSum !== 100) {
      setRiskMsg({ type: 'error', text: `Total weights must sum to exactly 100%. Current sum: ${riskSum}%` });
      return;
    }
    try {
      setSavingRisk(true);
      setRiskMsg(null);
      const res = await fetch('/api/admin/scoring/risk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          weights: riskWeights,
          notes: riskNotes.trim() || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update Downside Risk config');
      setRiskMsg({ type: 'success', text: `Downside Risk updated to version v${json.config.version}` });
      setRiskNotes('');
      fetchConfig();
    } catch (err) {
      setRiskMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setSavingRisk(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
        Loading scoring configuration & audit matrix...
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Overview Notice */}
      <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl flex items-start space-x-3">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-slate-300 text-[11px] leading-relaxed">
          <span className="font-bold text-white">Scoring Engine Calibration Notice: </span>
          Weight alterations take effect immediately across all newly calculated candle intervals.
          In accordance with the regulatory & telemetry requirements, historical score snapshots retain
          the version under which they were generated. The sum of weights must equal exactly 100%.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bull Score Configuration */}
        <form onSubmit={handleSaveBull} className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#182338] pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Bull Score Engine</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold">
                v{data?.bull.version || 1}
              </span>
            </div>

            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              bullSum === 100
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/50'
                : 'bg-rose-950/60 text-rose-300 border border-rose-600/50'
            }`}>
              <span>Total: {bullSum}%</span>
              {bullSum === 100 ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            </div>
          </div>

          {bullMsg && (
            <div className={`p-2.5 rounded-lg text-[11px] flex items-center space-x-2 ${
              bullMsg.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50'
                : 'bg-rose-950/60 text-rose-300 border border-rose-700/50'
            }`}>
              <span>{bullMsg.text}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Trend Weight (EMA 20/50/200 Alignment)</span>
                <span className="text-cyan-300 font-bold">{bullWeights.trendWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bullWeights.trendWeight}
                onChange={(e) => setBullWeights({ ...bullWeights, trendWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>RSI Weight (Momentum & Oversold Recovery)</span>
                <span className="text-cyan-300 font-bold">{bullWeights.rsiWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bullWeights.rsiWeight}
                onChange={(e) => setBullWeights({ ...bullWeights, rsiWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Volume Weight (Volume Expansion Ratio)</span>
                <span className="text-cyan-300 font-bold">{bullWeights.volumeWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bullWeights.volumeWeight}
                onChange={(e) => setBullWeights({ ...bullWeights, volumeWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Bollinger Band Weight (Squeeze & Band Walk)</span>
                <span className="text-cyan-300 font-bold">{bullWeights.bollingerWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bullWeights.bollingerWeight}
                onChange={(e) => setBullWeights({ ...bullWeights, bollingerWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Momentum Weight (MACD & Histogram Shift)</span>
                <span className="text-cyan-300 font-bold">{bullWeights.momentumWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bullWeights.momentumWeight}
                onChange={(e) => setBullWeights({ ...bullWeights, momentumWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Market Structure Weight (BOS / ChoCH / Highs)</span>
                <span className="text-cyan-300 font-bold">{bullWeights.structureWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bullWeights.structureWeight}
                onChange={(e) => setBullWeights({ ...bullWeights, structureWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Open Interest Weight (Expansion Dynamics)</span>
                <span className="text-cyan-300 font-bold">{bullWeights.oiWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bullWeights.oiWeight}
                onChange={(e) => setBullWeights({ ...bullWeights, oiWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Funding Rate Weight (Healthy Spot vs Perpetual Premium)</span>
                <span className="text-cyan-300 font-bold">{bullWeights.fundingWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={bullWeights.fundingWeight}
                onChange={(e) => setBullWeights({ ...bullWeights, fundingWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <input
              type="text"
              placeholder="Audit log change notes (e.g., Increased Structure Weight for trend breakout)"
              value={bullNotes}
              onChange={(e) => setBullNotes(e.target.value)}
              className="w-full bg-[#090e18] border border-[#21304a] rounded px-3 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBull || bullSum !== 100}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingBull ? 'Calibrating...' : 'Publish v' + ((data?.bull.version || 1) + 1)}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Downside Risk Configuration */}
        <form onSubmit={handleSaveRisk} className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#182338] pb-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">Downside Risk Engine</h3>
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700/50 text-[10px] font-bold">
                v{data?.risk.version || 1}
              </span>
            </div>

            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              riskSum === 100
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/50'
                : 'bg-rose-950/60 text-rose-300 border border-rose-600/50'
            }`}>
              <span>Total: {riskSum}%</span>
              {riskSum === 100 ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            </div>
          </div>

          {riskMsg && (
            <div className={`p-2.5 rounded-lg text-[11px] flex items-center space-x-2 ${
              riskMsg.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50'
                : 'bg-rose-950/60 text-rose-300 border border-rose-700/50'
            }`}>
              <span>{riskMsg.text}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>RSI Extreme Weight (Overbought & Bearish Divergence)</span>
                <span className="text-rose-300 font-bold">{riskWeights.rsiExtremeWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={riskWeights.rsiExtremeWeight}
                onChange={(e) => setRiskWeights({ ...riskWeights, rsiExtremeWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>MA Breakdown Weight (Loss of Key Exponential Moving Averages)</span>
                <span className="text-rose-300 font-bold">{riskWeights.maBreakdownWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={riskWeights.maBreakdownWeight}
                onChange={(e) => setRiskWeights({ ...riskWeights, maBreakdownWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Volume Weakness Weight (Exhaustion on Highs)</span>
                <span className="text-rose-300 font-bold">{riskWeights.volumeWeaknessWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={riskWeights.volumeWeaknessWeight}
                onChange={(e) => setRiskWeights({ ...riskWeights, volumeWeaknessWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Momentum Loss Weight (Bearish MACD Cross)</span>
                <span className="text-rose-300 font-bold">{riskWeights.momentumLossWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={riskWeights.momentumLossWeight}
                onChange={(e) => setRiskWeights({ ...riskWeights, momentumLossWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Support Loss Proxy Weight (Close Below Local Support)</span>
                <span className="text-rose-300 font-bold">{riskWeights.supportLossWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={riskWeights.supportLossWeight}
                onChange={(e) => setRiskWeights({ ...riskWeights, supportLossWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Bearish Structure Weight (Lower Lows & Breakdowns)</span>
                <span className="text-rose-300 font-bold">{riskWeights.bearishStructureWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={riskWeights.bearishStructureWeight}
                onChange={(e) => setRiskWeights({ ...riskWeights, bearishStructureWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Derivatives Liquidation / Crowded Long Weight</span>
                <span className="text-rose-300 font-bold">{riskWeights.derivativesRiskWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={riskWeights.derivativesRiskWeight}
                onChange={(e) => setRiskWeights({ ...riskWeights, derivativesRiskWeight: parseInt(e.target.value) || 0 })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <input
              type="text"
              placeholder="Audit log change notes (e.g., Elevated MA breakdown weight for high volatility regime)"
              value={riskNotes}
              onChange={(e) => setRiskNotes(e.target.value)}
              className="w-full bg-[#090e18] border border-[#21304a] rounded px-3 py-1.5 text-white font-mono text-xs focus:border-rose-500 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingRisk || riskSum !== 100}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingRisk ? 'Calibrating...' : 'Publish v' + ((data?.risk.version || 1) + 1)}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Version History Log */}
      <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Scoring Engine Versioning & Audit History</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            {data?.history.length || 0} historical records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#182338] text-[11px] text-slate-400 font-bold uppercase">
                <th className="py-2.5 px-3">Engine</th>
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-3">Changed By</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Total Weight</th>
                <th className="py-2.5 px-3">Change Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141e30] text-[11px]">
              {data && data.history.map((ver) => (
                <tr key={ver.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ver.type === 'BULL'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                        : 'bg-rose-950 text-rose-300 border border-rose-700/50'
                    }`}>
                      {ver.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">v{ver.version}</td>
                  <td className="py-2.5 px-3 text-cyan-300">{ver.changedBy}</td>
                  <td className="py-2.5 px-3 text-slate-400">{new Date(ver.timestamp).toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-200">{ver.totalWeight}%</td>
                  <td className="py-2.5 px-3 text-slate-300 max-w-md truncate">{ver.notes || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
