import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  RefreshCw,
  Save,
  Search,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap
} from 'lucide-react';
import {
  MarketSignal,
  SignalEngineAdminConfig,
  SignalQualityStats
} from '../../types';

interface AdminSignalEngineProps {
  token: string | null;
}

export const AdminSignalEngine: React.FC<AdminSignalEngineProps> = ({ token }) => {
  const [config, setConfig] = useState<SignalEngineAdminConfig | null>(null);
  const [weights, setWeights] = useState({
    trendWeight: 25,
    structureWeight: 20,
    volumeWeight: 20,
    derivativesWeight: 15,
    btcContextWeight: 10,
    rsiWeight: 10
  });
  const [minStrengthThreshold, setMinStrengthThreshold] = useState(55);
  const [minConfluenceScore, setMinConfluenceScore] = useState(60);
  const [requireVolumeConfirmation, setRequireVolumeConfirmation] = useState(true);

  const [stats, setStats] = useState<SignalQualityStats | null>(null);
  const [historicalSignals, setHistoricalSignals] = useState<MarketSignal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<MarketSignal | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Test Runner State
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    totalTests: number;
    passedCount: number;
    failedCount: number;
    allPassed: boolean;
    results: Array<{ testId: number; testName: string; passed: boolean; message: string }>;
  } | null>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const fetchConfigAndStats = async () => {
    try {
      const [cfgRes, statsRes, sigsRes] = await Promise.all([
        fetch('/api/signals/config', { headers: authHeaders }),
        fetch('/api/signals/stats', { headers: authHeaders }),
        fetch('/api/signals?limit=50', { headers: authHeaders })
      ]);

      if (cfgRes.ok) {
        const data = await cfgRes.json();
        if (data.config) {
          setConfig(data.config);
          setWeights(data.config.weights);
          setMinStrengthThreshold(data.config.minStrengthThreshold);
          setMinConfluenceScore(data.config.minConfluenceScore);
          setRequireVolumeConfirmation(data.config.requireVolumeConfirmation);
        }
      }

      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }

      if (sigsRes.ok) {
        const d = await sigsRes.json();
        setHistoricalSignals(d.signals || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  useEffect(() => {
    fetchConfigAndStats();
  }, [token]);

  const totalWeight =
    weights.trendWeight +
    weights.structureWeight +
    weights.volumeWeight +
    weights.derivativesWeight +
    weights.btcContextWeight +
    weights.rsiWeight;

  const handleSaveConfig = async () => {
    if (totalWeight !== 100) {
      setErrorMessage(`Total weight must equal 100% (currently ${totalWeight}%)`);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/signals/config', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          weights,
          minStrengthThreshold,
          minConfluenceScore,
          requireVolumeConfirmation
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveMessage(`Signal Engine updated to Version ${data.config.version} successfully!`);
        setConfig(data.config);
      } else {
        setErrorMessage(data.error || 'Failed to update configuration');
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    try {
      const res = await fetch('/api/signals/tests/run', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setTestResults(data);
      }
    } catch (err: any) {
      setErrorMessage('Failed to execute automated tests: ' + err.message);
    } finally {
      setIsRunningTests(false);
    }
  };

  const filteredHistory = historicalSignals.filter(
    s =>
      s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.signalType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.exchange.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner & Quick Metrics */}
      <div className="bg-[#0b121f] border border-[#1c2942] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-wider">
              SIGNAL INTELLIGENCE ENGINE (PHASE 7)
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/50">
              ACTIVE V{config?.version || 1}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Multi-timeframe confluence, non-lookahead signal calculation, and exchange-isolated intelligence.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-lg shadow-indigo-900/30"
          >
            {isRunningTests ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>RUN 10 AUTOMATED TESTS</span>
          </button>

          <button
            onClick={fetchConfigAndStats}
            className="p-1.5 rounded-lg bg-[#141e33] hover:bg-[#1a2845] text-slate-300 border border-[#233352]"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error & Success Messages */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/80 border border-rose-700/60 rounded-lg text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {saveMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-lg text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Quality Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-[#0b121f] border border-[#1b263b] rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase">Signals Generated</div>
          <div className="text-xl font-bold text-white">
            {stats ? (stats.totalSignalsGenerated ?? stats.totalSignals).toLocaleString() : '0'}
          </div>
          <div className="text-[10px] text-slate-500">
            Active: <span className="text-emerald-400 font-bold">{stats?.activeSignalsCount ?? stats?.activeCount ?? 0}</span>
          </div>
        </div>

        <div className="bg-[#0b121f] border border-[#1b263b] rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase">Confirmation Rate</div>
          <div className="text-xl font-bold text-cyan-400">
            {stats ? `${(stats.confirmedRate ?? (stats.totalSignals > 0 ? (stats.confirmedCount / stats.totalSignals) * 100 : 0)).toFixed(1)}%` : '0%'}
          </div>
          <div className="text-[10px] text-slate-500">
            Invalidated: <span className="text-rose-400 font-bold">{stats ? `${(stats.invalidatedRate ?? (stats.totalSignals > 0 ? (stats.invalidatedCount / stats.totalSignals) * 100 : 0)).toFixed(1)}%` : '0%'}</span>
          </div>
        </div>

        <div className="bg-[#0b121f] border border-[#1b263b] rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase">Avg Signal Strength</div>
          <div className="text-xl font-bold text-amber-400">
            {stats ? `${(stats.meanStrength ?? stats.averageStrength ?? 0).toFixed(1)}/100` : '0/100'}
          </div>
          <div className="text-[10px] text-slate-500">
            Median: <span className="text-slate-300 font-bold">{stats?.medianStrength ?? Math.round(stats?.averageStrength ?? 0)}</span>
          </div>
        </div>

        <div className="bg-[#0b121f] border border-[#1b263b] rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase">MTF Confluence Ratio</div>
          <div className="text-xl font-bold text-purple-400">
            {stats ? `${(stats.confluentSignalRate ?? 0).toFixed(1)}%` : '0%'}
          </div>
          <div className="text-[10px] text-slate-500">
            Avg Alignment: <span className="text-purple-300 font-bold">{stats ? `${(stats.avgConfluenceScore ?? stats.averageConfidence ?? 0).toFixed(0)}/100` : '0'}</span>
          </div>
        </div>
      </div>

      {/* Automated Tests Result Panel */}
      {testResults && (
        <div className="bg-[#0b121f] border border-indigo-900/60 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-900/40 pb-2">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Phase 7 Automated Verification Test Suite
              </span>
            </div>
            <div className="text-xs">
              <span className="text-emerald-400 font-bold">{testResults.passedCount}</span> /{' '}
              <span className="text-slate-300">{testResults.totalTests} Passed</span>{' '}
              {testResults.allPassed ? (
                <span className="text-[10px] ml-2 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold">
                  ALL PASSED (100%)
                </span>
              ) : (
                <span className="text-[10px] ml-2 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-600 font-bold">
                  {testResults.failedCount} FAILED
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {testResults.results.map(r => (
              <div
                key={r.testId}
                className={`p-2.5 rounded-lg border flex items-start space-x-2 ${
                  r.passed
                    ? 'bg-[#091322] border-emerald-900/40 text-slate-300'
                    : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                }`}
              >
                {r.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <div className="font-bold text-white">
                    TEST {r.testId} — {r.testName}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">{r.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Configuration Form & Historical Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Calibration Weights (lg: 5 cols) */}
        <div className="lg:col-span-5 bg-[#0b121f] border border-[#1b263b] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1b263b] pb-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Signal Weights Calibration
              </span>
            </div>
            <div
              className={`text-xs font-bold ${
                totalWeight === 100 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              Sum: {totalWeight}% / 100%
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Trend Component Weight</span>
                <span className="text-white font-bold">{weights.trendWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={weights.trendWeight}
                onChange={e =>
                  setWeights({ ...weights, trendWeight: parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Market Structure Weight</span>
                <span className="text-white font-bold">{weights.structureWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={weights.structureWeight}
                onChange={e =>
                  setWeights({ ...weights, structureWeight: parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Volume Confirmation Weight</span>
                <span className="text-white font-bold">{weights.volumeWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={weights.volumeWeight}
                onChange={e =>
                  setWeights({ ...weights, volumeWeight: parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Derivatives (OI/Funding) Weight</span>
                <span className="text-white font-bold">{weights.derivativesWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={weights.derivativesWeight}
                onChange={e =>
                  setWeights({ ...weights, derivativesWeight: parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>BTC Macro Context Weight</span>
                <span className="text-white font-bold">{weights.btcContextWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={weights.btcContextWeight}
                onChange={e =>
                  setWeights({ ...weights, btcContextWeight: parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>RSI Momentum Weight</span>
                <span className="text-white font-bold">{weights.rsiWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={weights.rsiWeight}
                onChange={e =>
                  setWeights({ ...weights, rsiWeight: parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          <div className="border-t border-[#1b263b] pt-3 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Min Strength Threshold:</span>
              <input
                type="number"
                min="40"
                max="90"
                value={minStrengthThreshold}
                onChange={e => setMinStrengthThreshold(parseInt(e.target.value, 10) || 55)}
                className="w-16 bg-[#131d2e] border border-[#23334d] px-2 py-0.5 rounded text-right text-white font-bold"
              />
            </div>

            <div className="flex justify-between items-center text-slate-400">
              <span>Min Confluence Score:</span>
              <input
                type="number"
                min="40"
                max="90"
                value={minConfluenceScore}
                onChange={e => setMinConfluenceScore(parseInt(e.target.value, 10) || 60)}
                className="w-16 bg-[#131d2e] border border-[#23334d] px-2 py-0.5 rounded text-right text-white font-bold"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1 text-slate-300">
              <input
                type="checkbox"
                id="volConf"
                checked={requireVolumeConfirmation}
                onChange={e => setRequireVolumeConfirmation(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              <label htmlFor="volConf" className="cursor-pointer">
                Strict Breakout Volume Ratio {'>='} 1.2x
              </label>
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving || totalWeight !== 100}
            className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-amber-900/30"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>SAVE ENGINE WEIGHTS & RULES</span>
          </button>
        </div>

        {/* Right Column: Historical Signals & Inspector (lg: 7 cols) */}
        <div className="lg:col-span-7 bg-[#0b121f] border border-[#1b263b] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1b263b] pb-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Live Generated Signal Stream
              </span>
            </div>
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1 bg-[#131d2e] border border-[#23334d] rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-[#080d16] text-[10px] text-slate-400 uppercase border-b border-[#1b263b]">
                <tr>
                  <th className="py-2 px-2">Asset</th>
                  <th className="py-2 px-2">Signal</th>
                  <th className="py-2 px-2 text-center">Strength</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 px-2 text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131d2e]">
                {filteredHistory.map(sig => (
                  <tr
                    key={sig.id}
                    onClick={() => setSelectedSignal(sig)}
                    className="hover:bg-[#111c30] cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-2 font-bold text-white">
                      {sig.symbol}
                      <span className="ml-1 text-[9px] text-slate-400 font-normal">
                        ({sig.exchange})
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          sig.direction === 'BULLISH'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                            : sig.direction === 'BEARISH'
                            ? 'bg-rose-950 text-rose-300 border border-rose-700/50'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {sig.signalType}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-amber-400">
                      {sig.strength}/100
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span
                        className={`text-[9px] px-1 py-0.5 rounded ${
                          sig.status === 'CONFIRMED'
                            ? 'text-cyan-400 font-bold'
                            : sig.status === 'INVALIDATED'
                            ? 'text-rose-400 line-through'
                            : 'text-slate-400'
                        }`}
                      >
                        {sig.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-slate-500 text-[10px]">
                      {Math.max(1, Math.round((Date.now() - sig.timestamp) / 1000))}s ago
                    </td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No active signals recorded yet. Scans will populate this table automatically.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Selected Signal Inspector Modal / Card */}
          {selectedSignal && (
            <div className="p-4 bg-[#080d16] border border-cyan-800/40 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-[#1b263b] pb-2">
                <div className="font-bold text-white text-sm">
                  {selectedSignal.symbol} — {selectedSignal.signalType} ({selectedSignal.direction})
                </div>
                <button
                  onClick={() => setSelectedSignal(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400">Trigger:</span>{' '}
                  <strong className="text-white">${(selectedSignal.triggerPrice ?? 0).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Invalidation:</span>{' '}
                  <strong className="text-rose-400">
                    {selectedSignal.invalidationPrice
                      ? `$${selectedSignal.invalidationPrice.toLocaleString()}`
                      : 'N/A'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Confidence:</span>{' '}
                  <strong className="text-amber-400">{selectedSignal.confidence}/100</strong>
                </div>
                <div>
                  <span className="text-slate-400">MTF Alignment:</span>{' '}
                  <strong className="text-purple-300">
                    {selectedSignal.multiTimeframeSummary.alignmentScore}/100
                  </strong>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="text-[10px] uppercase text-emerald-400 font-bold">
                  Supporting Factors:
                </div>
                <div className="space-y-0.5 text-[11px] text-slate-300">
                  {selectedSignal.supportingFactors.map((f, i) => (
                    <div key={i} className="flex items-center space-x-1.5">
                      <span className="text-emerald-400">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSignal.conflictingFactors.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-[#1b263b]">
                  <div className="text-[10px] uppercase text-amber-400 font-bold">
                    Conflicting Factors / Headwinds:
                  </div>
                  <div className="space-y-0.5 text-[11px] text-slate-400">
                    {selectedSignal.conflictingFactors.map((c, i) => (
                      <div key={i} className="flex items-center space-x-1.5">
                        <span className="text-amber-400">⚠</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
