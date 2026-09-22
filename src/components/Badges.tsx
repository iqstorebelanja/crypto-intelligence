import { Activity, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Star, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';
import { AnalyticalSignal, BullClassification, DownsideRiskClassification } from '../types';

export const ScoreBadge: React.FC<{ score: number; classification?: BullClassification; compact?: boolean }> = ({
  score,
  classification,
  compact = false
}) => {
  let colorBg = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30';
  if (score < 30) colorBg = 'bg-slate-900/60 text-slate-400 border-slate-700/40';
  else if (score < 50) colorBg = 'bg-slate-800/60 text-slate-300 border-slate-600/40';
  else if (score < 70) colorBg = 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30';
  else if (score >= 85) colorBg = 'bg-emerald-900/60 text-emerald-300 border-emerald-400/50 shadow-sm shadow-emerald-500/10';

  return (
    <div className="inline-flex flex-col items-start">
      <div className={`px-2 py-0.5 rounded border font-mono font-bold text-xs tracking-wider flex items-center space-x-1 ${colorBg}`}>
        <TrendingUp className="w-3 h-3 opacity-80" />
        <span>{score}</span>
        <span className="text-[9px] font-sans font-normal opacity-70">/100</span>
      </div>
      {!compact && classification && (
        <span className="text-[10px] text-slate-400 mt-0.5 tracking-tight">{classification}</span>
      )}
    </div>
  );
};

export const RiskBadge: React.FC<{
  score?: number;
  risk?: number;
  classification?: DownsideRiskClassification;
  compact?: boolean;
}> = ({ score, risk, classification, compact = false }) => {
  const finalScore = score !== undefined ? score : (risk ?? 0);
  let colorBg = 'bg-slate-900/60 text-slate-400 border-slate-700/40';
  if (finalScore >= 85) colorBg = 'bg-rose-950/80 text-rose-300 border-rose-500/60 shadow-sm shadow-rose-500/10';
  else if (finalScore >= 70) colorBg = 'bg-rose-950/50 text-rose-400 border-rose-500/40';
  else if (finalScore >= 50) colorBg = 'bg-amber-950/50 text-amber-400 border-amber-500/40';
  else if (finalScore >= 30) colorBg = 'bg-yellow-950/30 text-yellow-300 border-yellow-500/30';

  return (
    <div className="inline-flex flex-col items-start">
      <div className={`px-2 py-0.5 rounded border font-mono font-bold text-xs tracking-wider flex items-center space-x-1 ${colorBg}`}>
        <ShieldAlert className="w-3 h-3 opacity-80" />
        <span>{finalScore}</span>
        <span className="text-[9px] font-sans font-normal opacity-70">/100</span>
      </div>
      {!compact && classification && (
        <span className="text-[10px] text-slate-400 mt-0.5 tracking-tight">{classification}</span>
      )}
    </div>
  );
};

export const SignalBadge: React.FC<{ signal: AnalyticalSignal }> = ({ signal }) => {
  if (signal === 'Bullish conditions') {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Bullish conditions</span>
      </span>
    );
  }
  if (signal === 'Bearish conditions') {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-950/50 border border-rose-500/30 text-rose-400 text-[11px] font-medium tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        <span>Bearish conditions</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800/50 border border-slate-700 text-slate-300 text-[11px] font-medium tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      <span>Neutral conditions</span>
    </span>
  );
};

export const DataFreshness: React.FC<{ seconds: number; status: 'LIVE' | 'DATA DELAYED' | 'UNAVAILABLE' }> = ({
  seconds,
  status
}) => {
  if (status === 'DATA DELAYED' || seconds > 45) {
    return (
      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 border border-amber-600/40 text-amber-300">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        <span>DATA DELAYED ({seconds}s)</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1 text-[11px] font-mono text-slate-400">
      <Clock className="w-3 h-3 text-slate-500" />
      <span>Updated {seconds}s ago</span>
    </span>
  );
};

export const MarketStatus: React.FC<{ isHealthy: boolean; latencyMs: number }> = ({ isHealthy, latencyMs }) => {
  return (
    <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-[#0b1019] border border-[#1b253b] text-[11px] font-mono">
      <div className="flex items-center space-x-1.5">
        <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
        <span className="text-slate-300 font-semibold">BINANCE SPOT</span>
      </div>
      <span className="text-slate-500">|</span>
      <span className={latencyMs < 100 ? 'text-emerald-400' : 'text-amber-400'}>{latencyMs}ms</span>
    </div>
  );
};

export const WatchlistButton: React.FC<{
  isSaved: boolean;
  onToggle?: () => void;
  onClick?: () => void;
}> = ({ isSaved, onToggle, onClick }) => {
  const handleClick = () => {
    if (onToggle) onToggle();
    else if (onClick) onClick();
  };

  return (
    <button
      onClick={e => {
        e.stopPropagation();
        handleClick();
      }}
      title={isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
      className={`p-1.5 rounded transition-colors ${
        isSaved
          ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/30'
          : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800/40'
      }`}
    >
      <Star className={`w-4 h-4 ${isSaved ? 'fill-amber-400' : ''}`} />
    </button>
  );
};
