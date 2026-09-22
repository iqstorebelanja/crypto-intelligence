import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  LineChart,
  Play,
  RefreshCw,
  Search,
  Shield,
  Sliders,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap
} from 'lucide-react';
import {
  ExchangeId,
  HistoricalPeriod,
  HistoricalSignalSnapshot,
  IndicatorConditionResult,
  ScoreBucketResult,
  StatisticalSummary,
  Timeframe,
  ValidationHorizon,
  ValidationRunRequest,
  ValidationRunResponse
} from '../../types';

interface AdminValidationLabProps {
  token: string | null;
}

export const AdminValidationLab: React.FC<AdminValidationLabProps> = ({ token }) => {
  // Run Configuration State
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [exchange, setExchange] = useState<ExchangeId>('BINANCE');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [period, setPeriod] = useState<HistoricalPeriod>('30d');
  const [selectedHorizon, setSelectedHorizon] = useState<ValidationHorizon>('24h');
  const [selectedModel, setSelectedModel] = useState<string>('Bull Score Model v1.0');

  // Custom filter state
  const [showCustomFilter, setShowCustomFilter] = useState<boolean>(false);
  const [customMinBull, setCustomMinBull] = useState<string>('');
  const [customMaxBull, setCustomMaxBull] = useState<string>('');
  const [customMinRisk, setCustomMinRisk] = useState<string>('');
  const [customMinVolRatio, setCustomMinVolRatio] = useState<string>('');
  const [customAboveMa20, setCustomAboveMa20] = useState<boolean>(false);
  const [customAboveMa50, setCustomAboveMa50] = useState<boolean>(false);
  const [customAboveMa200, setCustomAboveMa200] = useState<boolean>(false);

  // Execution State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationRunResponse | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<HistoricalSignalSnapshot | null>(null);

  // Active view tab inside Validation Lab
  const [viewSection, setViewSection] = useState<'buckets' | 'indicators' | 'derivatives' | 'structure' | 'snapshots'>('buckets');

  // Snapshot table search & filter
  const [snapshotFilter, setSnapshotFilter] = useState<string>('');
  const [snapshotSortBy, setSnapshotSortBy] = useState<'time' | 'price' | 'bull' | 'return'>('time');
  const [snapshotSortDir, setSnapshotSortDir] = useState<'asc' | 'desc'>('desc');

  // Run validation request
  const handleRunValidation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const customFiltersObj = (showCustomFilter && (customMinBull || customMaxBull || customMinRisk || customMinVolRatio || customAboveMa20 || customAboveMa50 || customAboveMa200))
        ? {
            minBullScore: customMinBull ? parseFloat(customMinBull) : null,
            maxBullScore: customMaxBull ? parseFloat(customMaxBull) : null,
            minDownsideRisk: customMinRisk ? parseFloat(customMinRisk) : null,
            minVolumeRatio: customMinVolRatio ? parseFloat(customMinVolRatio) : null,
            aboveMa20: customAboveMa20 ? true : null,
            aboveMa50: customAboveMa50 ? true : null,
            aboveMa200: customAboveMa200 ? true : null
          }
        : undefined;

      const payload: ValidationRunRequest = {
        symbol: symbol.trim().toUpperCase(),
        exchange,
        timeframe,
        period,
        selectedHorizon,
        modelVersion: selectedModel,
        customFilters: customFiltersObj
      };

      const res = await fetch('/api/admin/validation/run', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data: ValidationRunResponse = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to execute validation replay.');
      }

      setValidationResult(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during replay.');
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial test on mount
  useEffect(() => {
    handleRunValidation();
  }, []);

  return (
    <div className="space-y-6 font-mono">
      {/* Disclaimer and Purpose Header */}
      <div className="p-5 bg-[#0b101c] border border-[#182338] rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wider flex items-center gap-2">
                EMPIRICAL VALIDATION LAB & HISTORICAL REPLAY
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                  PHASE 5
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Point-in-time backtesting engine testing production analytical models against exchange historical data.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400">Look-Ahead Protection:</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-bold">
              ZERO LEAKAGE (STRICT T)
            </span>
          </div>
        </div>

        {/* Regulatory & Scientific Disclaimer */}
        <div className="p-3 bg-[#080d16] border border-amber-900/40 rounded-xl flex items-start space-x-2.5 text-xs text-amber-300/90 leading-relaxed">
          <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">SCIENTIFIC & STATISTICAL DISCLAIMER: </span>
            This Validation Lab evaluates how the quantitative algorithms functioned during observed historical market regimes.
            Historical results do not guarantee or predict future price outcomes. Models are evaluated through empirical forward returns,
            standard deviation, and confidence intervals without promotional claims or predictive guarantees.
          </div>
        </div>
      </div>

      {/* Replay Configuration Controls */}
      <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">REPLAY CONTROLS & MODEL PARAMETERS</h3>
          </div>
          <span className="text-xs text-slate-400">Engine Source: Exact Production Scoring Logic</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Symbol */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Symbol</label>
            <div className="relative">
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTCUSDT"
                className="w-full px-3 py-2 rounded-lg bg-[#070b13] border border-[#1e2d47] text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Exchange */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Exchange</label>
            <select
              value={exchange}
              onChange={e => setExchange(e.target.value as ExchangeId)}
              className="w-full px-3 py-2 rounded-lg bg-[#070b13] border border-[#1e2d47] text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
            >
              <option value="BINANCE">Binance (Spot & Futures)</option>
              <option value="BYBIT">Bybit (Linear Perpetual)</option>
            </select>
          </div>

          {/* Timeframe */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Timeframe</label>
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value as Timeframe)}
              className="w-full px-3 py-2 rounded-lg bg-[#070b13] border border-[#1e2d47] text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
            >
              <option value="5m">5m (Intraday Scalp)</option>
              <option value="15m">15m (Short-Term)</option>
              <option value="1h">1h (Swing Standard)</option>
              <option value="4h">4h (Intermediate)</option>
              <option value="1D">1D (Macro Trend)</option>
            </select>
          </div>

          {/* Historical Period */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Historical Period</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as HistoricalPeriod)}
              className="w-full px-3 py-2 rounded-lg bg-[#070b13] border border-[#1e2d47] text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
            >
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="90d">90 Days</option>
              <option value="180d">180 Days</option>
              <option value="365d">365 Days (1 Year)</option>
            </select>
          </div>

          {/* Model Version */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Analytical Model</label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#070b13] border border-[#1e2d47] text-white text-xs font-bold focus:outline-none focus:border-cyan-500"
            >
              <option value="Bull Score Model v1.0">Bull Score Model v1.0</option>
              <option value="Downside Risk Model v1.0">Downside Risk Model v1.0</option>
            </select>
          </div>

          {/* Forward Horizon */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Evaluation Horizon</label>
            <select
              value={selectedHorizon}
              onChange={e => setSelectedHorizon(e.target.value as ValidationHorizon)}
              className="w-full px-3 py-2 rounded-lg bg-[#070b13] border border-[#1e2d47] text-cyan-300 text-xs font-bold focus:outline-none focus:border-cyan-500"
            >
              <option value="15m">+15m</option>
              <option value="1h">+1h</option>
              <option value="4h">+4h</option>
              <option value="12h">+12h</option>
              <option value="24h">+24h (Standard)</option>
              <option value="3d">+3 Days</option>
              <option value="7d">+7 Days</option>
            </select>
          </div>
        </div>

        {/* Custom Multi-Condition Filter Toggle */}
        <div className="pt-2 border-t border-[#182338]">
          <button
            onClick={() => setShowCustomFilter(!showCustomFilter)}
            className="flex items-center space-x-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Custom Confluence Filter Tester</span>
            {showCustomFilter ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showCustomFilter && (
            <div className="mt-3 p-4 bg-[#080d16] border border-[#19253b] rounded-xl grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400">Min Bull Score</label>
                <input
                  type="number"
                  value={customMinBull}
                  onChange={e => setCustomMinBull(e.target.value)}
                  placeholder="e.g. 75"
                  className="w-full mt-1 px-2.5 py-1.5 rounded bg-[#0e1726] border border-[#22334d] text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400">Max Bull Score</label>
                <input
                  type="number"
                  value={customMaxBull}
                  onChange={e => setCustomMaxBull(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full mt-1 px-2.5 py-1.5 rounded bg-[#0e1726] border border-[#22334d] text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400">Min Downside Risk</label>
                <input
                  type="number"
                  value={customMinRisk}
                  onChange={e => setCustomMinRisk(e.target.value)}
                  placeholder="e.g. 60"
                  className="w-full mt-1 px-2.5 py-1.5 rounded bg-[#0e1726] border border-[#22334d] text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400">Min Volume Ratio</label>
                <input
                  type="number"
                  step="0.1"
                  value={customMinVolRatio}
                  onChange={e => setCustomMinVolRatio(e.target.value)}
                  placeholder="e.g. 2.0"
                  className="w-full mt-1 px-2.5 py-1.5 rounded bg-[#0e1726] border border-[#22334d] text-white text-xs"
                />
              </div>

              <div className="flex items-center space-x-2 pt-5">
                <input
                  type="checkbox"
                  id="chkMa20"
                  checked={customAboveMa20}
                  onChange={e => setCustomAboveMa20(e.target.checked)}
                  className="rounded bg-[#0e1726] border-[#22334d] text-cyan-500 focus:ring-0"
                />
                <label htmlFor="chkMa20" className="text-[11px] text-slate-300">Above MA20</label>
              </div>

              <div className="flex items-center space-x-2 pt-5">
                <input
                  type="checkbox"
                  id="chkMa50"
                  checked={customAboveMa50}
                  onChange={e => setCustomAboveMa50(e.target.checked)}
                  className="rounded bg-[#0e1726] border-[#22334d] text-cyan-500 focus:ring-0"
                />
                <label htmlFor="chkMa50" className="text-[11px] text-slate-300">Above MA50</label>
              </div>

              <div className="flex items-center space-x-2 pt-5">
                <input
                  type="checkbox"
                  id="chkMa200"
                  checked={customAboveMa200}
                  onChange={e => setCustomAboveMa200(e.target.checked)}
                  className="rounded bg-[#0e1726] border-[#22334d] text-cyan-500 focus:ring-0"
                />
                <label htmlFor="chkMa200" className="text-[11px] text-slate-300">Above MA200</label>
              </div>
            </div>
          )}
        </div>

        {/* Action Button & Run Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            onClick={handleRunValidation}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Executing Historical Replay...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Historical Validation</span>
              </>
            )}
          </button>

          {validationResult && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Total Candles: <strong className="text-white">{validationResult.metadata.totalCandles}</strong></span>
              </span>
              <span>•</span>
              <span>Signals Evaluated: <strong className="text-white">{validationResult.metadata.totalSignalsEvaluated}</strong></span>
              <span>•</span>
              <span>Derivatives: <strong className={validationResult.metadata.derivativesDataStatus === 'AVAILABLE' ? 'text-emerald-400' : 'text-slate-500'}>{validationResult.metadata.derivativesDataStatus}</strong></span>
              <span>•</span>
              <span>Execution: <strong className="text-white">{validationResult.metadata.executionTimeMs} ms</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-700/60 rounded-xl text-xs text-rose-300 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <div className="font-bold text-white">Validation Replay Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Replay Output Display */}
      {validationResult && validationResult.success && (
        <div className="space-y-6">
          {/* Section 1: Statistical Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Sample & Observations */}
            <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">SAMPLE SIZE (N)</span>
                {validationResult.overallStats.isSmallSample && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                    Small sample size (&lt; 30)
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-white">
                {validationResult.overallStats.sampleSize}
                <span className="text-xs font-normal text-slate-400 ml-2">signals evaluated</span>
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between border-t border-[#182338] pt-2">
                <span>Horizon: <strong className="text-cyan-400">+{validationResult.metadata.selectedHorizon}</strong></span>
                <span>Model: <strong className="text-white">{validationResult.metadata.modelVersionLabel}</strong></span>
              </div>
            </div>

            {/* Card 2: Forward Return Central Tendency */}
            <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">FORWARD RETURN (MEAN / MEDIAN)</span>
                <LineChart className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline space-x-3">
                <div className={`text-2xl font-bold ${validationResult.overallStats.mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {validationResult.overallStats.mean >= 0 ? `+${validationResult.overallStats.mean}%` : `${validationResult.overallStats.mean}%`}
                </div>
                <div className="text-xs text-slate-400">
                  Median: <strong className={validationResult.overallStats.median >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {validationResult.overallStats.median >= 0 ? `+${validationResult.overallStats.median}%` : `${validationResult.overallStats.median}%`}
                  </strong>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between border-t border-[#182338] pt-2">
                <span>Std Dev: <strong className="text-white">±{validationResult.overallStats.stdDev}%</strong></span>
                <span>
                  95% CI Mean:{' '}
                  {validationResult.overallStats.confidenceInterval95Mean ? (
                    <strong className="text-white">
                      [{validationResult.overallStats.confidenceInterval95Mean[0]}%, {validationResult.overallStats.confidenceInterval95Mean[1]}%]
                    </strong>
                  ) : (
                    <span className="text-slate-500">N/A</span>
                  )}
                </span>
              </div>
            </div>

            {/* Card 3: Positive Outcome Distribution */}
            <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">POSITIVE FORWARD OUTCOMES</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline space-x-3">
                <div className="text-2xl font-bold text-emerald-400">
                  {validationResult.overallStats.positiveOutcomePercent}%
                </div>
                <div className="text-xs text-rose-400">
                  Negative: <strong>{validationResult.overallStats.negativeOutcomePercent}%</strong>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between border-t border-[#182338] pt-2">
                <span>
                  95% CI Prop:{' '}
                  {validationResult.overallStats.confidenceInterval95Proportion ? (
                    <strong className="text-white">
                      [{validationResult.overallStats.confidenceInterval95Proportion[0]}%, {validationResult.overallStats.confidenceInterval95Proportion[1]}%]
                    </strong>
                  ) : (
                    <span className="text-slate-500">N/A</span>
                  )}
                </span>
                <span>Neutral: {validationResult.overallStats.neutralOutcomePercent}%</span>
              </div>
            </div>

            {/* Card 4: Favorable vs Adverse Excursion (MFE / MAE) */}
            <div className="p-4 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">EXCURSION (MFE / MAE)</span>
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-baseline space-x-3">
                <div className="text-2xl font-bold text-emerald-400">
                  +{validationResult.overallStats.averageMfe}%
                </div>
                <div className="text-xs text-rose-400">
                  Avg Drawdown: <strong>{validationResult.overallStats.averageMae}%</strong>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between border-t border-[#182338] pt-2">
                <span>Max: <strong className="text-emerald-400">+{validationResult.overallStats.max}%</strong></span>
                <span>Min: <strong className="text-rose-400">{validationResult.overallStats.min}%</strong></span>
              </div>
            </div>
          </div>

          {/* Custom Filter Result Display (if active) */}
          {validationResult.customFilterStats && (
            <div className="p-4 bg-purple-950/20 border border-purple-600/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" /> CUSTOM FILTER CONFLUENCE RESULT
                </span>
                <span className="text-xs text-slate-400">
                  Sample Size: <strong className="text-white">{validationResult.customFilterStats.sampleSize}</strong>
                  {validationResult.customFilterStats.isSmallSample && ' (Small sample size)'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
                <div>
                  <span className="text-slate-400">Mean Forward Return:</span>
                  <div className={`font-bold text-base ${validationResult.customFilterStats.mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {validationResult.customFilterStats.mean >= 0 ? `+${validationResult.customFilterStats.mean}%` : `${validationResult.customFilterStats.mean}%`}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Positive Outcomes %:</span>
                  <div className="font-bold text-base text-emerald-400">
                    {validationResult.customFilterStats.positiveOutcomePercent}%
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Avg MFE (Favorable):</span>
                  <div className="font-bold text-base text-emerald-300">
                    +{validationResult.customFilterStats.averageMfe}%
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Avg MAE (Adverse):</span>
                  <div className="font-bold text-base text-rose-300">
                    {validationResult.customFilterStats.averageMae}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-view Section Navigation */}
          <div className="flex items-center space-x-2 border-b border-[#182338] pb-2 text-xs">
            <button
              onClick={() => setViewSection('buckets')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                viewSection === 'buckets'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Score Bucket Analysis</span>
            </button>

            <button
              onClick={() => setViewSection('indicators')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                viewSection === 'indicators'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Indicator Conditions</span>
            </button>

            <button
              onClick={() => setViewSection('derivatives')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                viewSection === 'derivatives'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>OI + Price Dynamics</span>
            </button>

            <button
              onClick={() => setViewSection('structure')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                viewSection === 'structure'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Market Structure</span>
            </button>

            <button
              onClick={() => setViewSection('snapshots')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                viewSection === 'snapshots'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Historical Signal Snapshots</span>
            </button>
          </div>

          {/* Section: Score Bucket Analysis */}
          {viewSection === 'buckets' && (
            <div className="space-y-6">
              {/* Bull Score Buckets */}
              <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">BULL SCORE BUCKET ANALYSIS</h3>
                  </div>
                  <span className="text-xs text-slate-400">Forward Horizon: +{validationResult.metadata.selectedHorizon}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#182338] text-slate-400">
                        <th className="py-2.5 px-3">Score Bucket</th>
                        <th className="py-2.5 px-3">Sample Count</th>
                        <th className="py-2.5 px-3">Positive Outcome %</th>
                        <th className="py-2.5 px-3">Mean Return</th>
                        <th className="py-2.5 px-3">Median Return</th>
                        <th className="py-2.5 px-3">Avg MFE</th>
                        <th className="py-2.5 px-3">Avg MAE</th>
                        <th className="py-2.5 px-3">Range [Min, Max]</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#152033]">
                      {validationResult.bullScoreBuckets.map((bucket, idx) => (
                        <tr key={idx} className="hover:bg-[#121c2d]/50 transition-colors">
                          <td className="py-3 px-3 font-bold text-white flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                            <span>Bull Score {bucket.bucketRange}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white">{bucket.stats.sampleSize}</span>
                              {bucket.stats.isSmallSample && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                                  Small N
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-emerald-400">
                              {bucket.stats.positiveOutcomePercent}%
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`font-bold ${bucket.stats.mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {bucket.stats.mean >= 0 ? `+${bucket.stats.mean}%` : `${bucket.stats.mean}%`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {bucket.stats.median >= 0 ? `+${bucket.stats.median}%` : `${bucket.stats.median}%`}
                          </td>
                          <td className="py-3 px-3 text-emerald-300 font-bold">
                            +{bucket.stats.averageMfe}%
                          </td>
                          <td className="py-3 px-3 text-rose-300 font-bold">
                            {bucket.stats.averageMae}%
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px]">
                            [{bucket.stats.min}%, {bucket.stats.max}%]
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Downside Risk Buckets */}
              <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-bold text-white">DOWNSIDE RISK SCORE BUCKET ANALYSIS</h3>
                  </div>
                  <span className="text-xs text-slate-400">Forward Horizon: +{validationResult.metadata.selectedHorizon}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#182338] text-slate-400">
                        <th className="py-2.5 px-3">Risk Bucket</th>
                        <th className="py-2.5 px-3">Sample Count</th>
                        <th className="py-2.5 px-3">Negative Outcome %</th>
                        <th className="py-2.5 px-3">Mean Return</th>
                        <th className="py-2.5 px-3">Median Return</th>
                        <th className="py-2.5 px-3">Avg MAE (Drawdown)</th>
                        <th className="py-2.5 px-3">Avg MFE</th>
                        <th className="py-2.5 px-3">Range [Min, Max]</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#152033]">
                      {validationResult.downsideRiskBuckets.map((bucket, idx) => (
                        <tr key={idx} className="hover:bg-[#121c2d]/50 transition-colors">
                          <td className="py-3 px-3 font-bold text-white flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                            <span>Risk Score {bucket.bucketRange}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white">{bucket.stats.sampleSize}</span>
                              {bucket.stats.isSmallSample && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                                  Small N
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-rose-400">
                              {bucket.stats.negativeOutcomePercent}%
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`font-bold ${bucket.stats.mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {bucket.stats.mean >= 0 ? `+${bucket.stats.mean}%` : `${bucket.stats.mean}%`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {bucket.stats.median >= 0 ? `+${bucket.stats.median}%` : `${bucket.stats.median}%`}
                          </td>
                          <td className="py-3 px-3 text-rose-300 font-bold">
                            {bucket.stats.averageMae}%
                          </td>
                          <td className="py-3 px-3 text-emerald-300 font-bold">
                            +{bucket.stats.averageMfe}%
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px]">
                            [{bucket.stats.min}%, {bucket.stats.max}%]
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section: Indicator Conditions */}
          {viewSection === 'indicators' && (
            <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">INDIVIDUAL TECHNICAL INDICATOR VALIDATION</h3>
                </div>
                <span className="text-xs text-slate-400">Evaluated at Horizon: +{validationResult.metadata.selectedHorizon}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#182338] text-slate-400">
                      <th className="py-2.5 px-3">Condition Name</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Sample Count</th>
                      <th className="py-2.5 px-3">Positive Outcome %</th>
                      <th className="py-2.5 px-3">Mean Return</th>
                      <th className="py-2.5 px-3">Median Return</th>
                      <th className="py-2.5 px-3">Avg MFE</th>
                      <th className="py-2.5 px-3">Avg MAE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#152033]">
                    {validationResult.indicatorConditions.map((cond, idx) => (
                      <tr key={idx} className="hover:bg-[#121c2d]/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-cyan-300 font-mono">
                          {cond.conditionName}
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px] max-w-xs">
                          {cond.description}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-white">{cond.stats.sampleSize}</span>
                          {cond.stats.isSmallSample && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                              Small N
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-400">
                          {cond.stats.positiveOutcomePercent}%
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${cond.stats.mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {cond.stats.mean >= 0 ? `+${cond.stats.mean}%` : `${cond.stats.mean}%`}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {cond.stats.median >= 0 ? `+${cond.stats.median}%` : `${cond.stats.median}%`}
                        </td>
                        <td className="py-3 px-3 text-emerald-300 font-bold">
                          +{cond.stats.averageMfe}%
                        </td>
                        <td className="py-3 px-3 text-rose-300 font-bold">
                          {cond.stats.averageMae}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section: OI + Price Dynamics */}
          {viewSection === 'derivatives' && (
            <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">OPEN INTEREST + PRICE CONFLUENCE VALIDATION</h3>
                </div>
                <span className="text-xs text-slate-400">
                  Status:{' '}
                  <strong className={validationResult.metadata.derivativesDataStatus === 'AVAILABLE' ? 'text-emerald-400' : 'text-amber-400'}>
                    {validationResult.metadata.derivativesDataStatus}
                  </strong>
                </span>
              </div>

              {validationResult.metadata.derivativesDataStatus !== 'AVAILABLE' ? (
                <div className="p-6 text-center text-xs text-slate-400 space-y-2 bg-[#080d16] rounded-xl border border-[#152033]">
                  <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-white font-bold">Historical Derivatives Feed Unavailable for this Query</div>
                  <p className="max-w-md mx-auto text-slate-400">
                    Open interest metrics were not captured on exchange API for this spot symbol/timeframe window.
                    Per strict validation integrity guidelines, values are marked N/A rather than simulated.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {validationResult.oiPriceDynamics.map((item, idx) => (
                    <div key={idx} className="p-4 bg-[#080d16] border border-[#182338] rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{item.combination}</span>
                        <span className="text-xs text-slate-400">N = {item.stats.sampleSize}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{item.description}</p>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#141d2e] text-xs">
                        <div>
                          <span className="text-slate-400">Mean Return</span>
                          <div className={`font-bold ${item.stats.mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.stats.mean >= 0 ? `+${item.stats.mean}%` : `${item.stats.mean}%`}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Positive %</span>
                          <div className="font-bold text-emerald-400">
                            {item.stats.positiveOutcomePercent}%
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Avg MFE</span>
                          <div className="font-bold text-emerald-300">
                            +{item.stats.averageMfe}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section: Market Structure */}
          {viewSection === 'structure' && (
            <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <LineChart className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">MARKET STRUCTURE EMPIRICAL VALIDATION</h3>
                </div>
                <span className="text-xs text-slate-400">Strict Confirmation Look-Ahead Protected</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#182338] text-slate-400">
                      <th className="py-2.5 px-3">Structure Classification</th>
                      <th className="py-2.5 px-3">Sample Count</th>
                      <th className="py-2.5 px-3">Positive Outcome %</th>
                      <th className="py-2.5 px-3">Mean Return</th>
                      <th className="py-2.5 px-3">Median Return</th>
                      <th className="py-2.5 px-3">Avg Favorable Excursion (MFE)</th>
                      <th className="py-2.5 px-3">Avg Drawdown (MAE)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#152033]">
                    {validationResult.marketStructureResults.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#121c2d]/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">
                          {item.structureType}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-white">{item.stats.sampleSize}</span>
                          {item.stats.isSmallSample && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                              Small N
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-400">
                          {item.stats.positiveOutcomePercent}%
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${item.stats.mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.stats.mean >= 0 ? `+${item.stats.mean}%` : `${item.stats.mean}%`}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {item.stats.median >= 0 ? `+${item.stats.median}%` : `${item.stats.median}%`}
                        </td>
                        <td className="py-3 px-3 text-emerald-300 font-bold">
                          +{item.stats.averageMfe}%
                        </td>
                        <td className="py-3 px-3 text-rose-300 font-bold">
                          {item.stats.averageMae}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section: Historical Signal Snapshots Table */}
          {viewSection === 'snapshots' && (
            <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">HISTORICAL SIGNAL SNAPSHOTS (POINT-IN-TIME LOGS)</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={snapshotFilter}
                      onChange={e => setSnapshotFilter(e.target.value)}
                      placeholder="Filter by structure or score..."
                      className="pl-8 pr-3 py-1.5 rounded-lg bg-[#070b13] border border-[#1e2d47] text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#182338] text-slate-400">
                      <th className="py-2 px-3">Date / Time (UTC)</th>
                      <th className="py-2 px-3">Signal Price</th>
                      <th className="py-2 px-3">Bull Score</th>
                      <th className="py-2 px-3">Downside Risk</th>
                      <th className="py-2 px-3">RSI 14</th>
                      <th className="py-2 px-3">Volume Ratio</th>
                      <th className="py-2 px-3">Market Structure</th>
                      <th className="py-2 px-3">Forward Return (+{validationResult.metadata.selectedHorizon})</th>
                      <th className="py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#152033]">
                    {validationResult.recentSnapshots
                      .filter(s => {
                        if (!snapshotFilter) return true;
                        const q = snapshotFilter.toLowerCase();
                        return (
                          s.marketStructure.toLowerCase().includes(q) ||
                          s.signal.toLowerCase().includes(q) ||
                          s.bullScore.toString().includes(q)
                        );
                      })
                      .map((snap, idx) => {
                        const horizonOutcome = snap.outcomes[validationResult.metadata.selectedHorizon];
                        return (
                          <tr key={idx} className="hover:bg-[#121c2d]/50 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                              {new Date(snap.timestamp).toISOString().replace('T', ' ').substring(0, 16)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white">
                              ${snap.price.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded font-bold ${snap.bullScore >= 70 ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/40' : snap.bullScore <= 35 ? 'bg-rose-950 text-rose-300 border border-rose-700/40' : 'bg-slate-800 text-slate-300'}`}>
                                {snap.bullScore}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded font-bold ${snap.downsideRisk >= 65 ? 'bg-rose-950 text-rose-300 border border-rose-700/40' : 'bg-slate-800 text-slate-300'}`}>
                                {snap.downsideRisk}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 font-mono">
                              {snap.RSI14}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 font-mono">
                              {snap.volumeRatio}x
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                              {snap.marketStructure}
                            </td>
                            <td className="py-2.5 px-3">
                              {horizonOutcome ? (
                                <span className={`font-bold ${horizonOutcome.percentageReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {horizonOutcome.percentageReturn >= 0 ? `+${horizonOutcome.percentageReturn}%` : `${horizonOutcome.percentageReturn}%`}
                                </span>
                              ) : (
                                <span className="text-slate-500">Pending</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => setSelectedSnapshot(snap)}
                                className="px-2 py-1 rounded bg-[#152033] hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 text-[10px] font-bold border border-[#23344e] transition-all"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Inspector Modal for Signal Snapshot */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b101c] border border-[#1d2b42] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl font-mono">
            <div className="flex items-center justify-between border-b border-[#182338] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-cyan-400" />
                <h3 className="text-base font-bold text-white">POINT-IN-TIME SIGNAL INSPECTOR</h3>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-[#141d2e] rounded"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#080d16] rounded-xl border border-[#152033]">
                <span className="text-slate-500 block text-[10px]">TIMESTAMP</span>
                <strong className="text-white">
                  {new Date(selectedSnapshot.timestamp).toISOString().replace('T', ' ').substring(0, 16)}
                </strong>
              </div>
              <div className="p-3 bg-[#080d16] rounded-xl border border-[#152033]">
                <span className="text-slate-500 block text-[10px]">SIGNAL PRICE</span>
                <strong className="text-cyan-400">${selectedSnapshot.price.toLocaleString()}</strong>
              </div>
              <div className="p-3 bg-[#080d16] rounded-xl border border-[#152033]">
                <span className="text-slate-500 block text-[10px]">BULL SCORE</span>
                <strong className="text-emerald-400">{selectedSnapshot.bullScore} / 100</strong>
              </div>
              <div className="p-3 bg-[#080d16] rounded-xl border border-[#152033]">
                <span className="text-slate-500 block text-[10px]">DOWNSIDE RISK</span>
                <strong className="text-rose-400">{selectedSnapshot.downsideRisk} / 100</strong>
              </div>
            </div>

            {/* Indicator Details at Timestamp T */}
            <div className="p-4 bg-[#080d16] rounded-xl border border-[#152033] space-y-2 text-xs">
              <span className="text-slate-400 font-bold block">Point-in-Time Technical Indicator Values:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-300">
                <div>RSI 6: <strong className="text-white">{selectedSnapshot.RSI6}</strong></div>
                <div>RSI 14: <strong className="text-white">{selectedSnapshot.RSI14}</strong></div>
                <div>Volume Ratio: <strong className="text-white">{selectedSnapshot.volumeRatio}x</strong></div>
                <div>MA 20: <strong className="text-white">${selectedSnapshot.MA20}</strong></div>
                <div>MA 50: <strong className="text-white">${selectedSnapshot.MA50}</strong></div>
                <div>MA 200: <strong className="text-white">${selectedSnapshot.MA200}</strong></div>
                <div>BB Upper: <strong className="text-white">${selectedSnapshot.BBUpper}</strong></div>
                <div>BB Lower: <strong className="text-white">${selectedSnapshot.BBLower}</strong></div>
                <div>Structure: <strong className="text-white">{selectedSnapshot.marketStructure}</strong></div>
              </div>
            </div>

            {/* Forward Horizon Progression */}
            <div className="space-y-2 text-xs">
              <span className="text-slate-400 font-bold block">Measured Forward Outcomes:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['15m', '1h', '4h', '12h', '24h', '3d', '7d'] as ValidationHorizon[]).map(h => {
                  const out = selectedSnapshot.outcomes[h];
                  if (!out) return null;
                  return (
                    <div key={h} className="p-2.5 bg-[#080d16] border border-[#19253b] rounded-lg">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>+{h}</span>
                        <span>MFE: +{out.mfe}%</span>
                      </div>
                      <div className={`text-sm font-bold mt-1 ${out.percentageReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {out.percentageReturn >= 0 ? `+${out.percentageReturn}%` : `${out.percentageReturn}%`}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        ${out.futurePrice.toLocaleString()} (MAE: {out.mae}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
