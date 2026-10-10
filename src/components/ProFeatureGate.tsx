import React from 'react';
import { Lock, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import { User } from '../types';
import { clientEntitlementService } from '../services/entitlementService';

interface ProFeatureGateProps {
  user: User | null;
  featureName: string;
  description?: string;
  onUpgradeClick?: () => void;
  children: React.ReactNode;
  symbol?: string;
  compact?: boolean;
}

export const ProFeatureGate: React.FC<ProFeatureGateProps> = ({
  user,
  featureName,
  description,
  onUpgradeClick,
  children,
  symbol,
  compact = false
}) => {
  const isTrial = clientEntitlementService.isTrialActive(user);
  const isPro = clientEntitlementService.isPro(user);

  // If user has PRO or Active Trial, render full feature content directly
  if (isPro || isTrial) {
    return <>{children}</>;
  }

  // If it's a signal and symbol is BTC or ETH, Free accounts are allowed
  if (symbol && clientEntitlementService.canAccessSignal(user, symbol)) {
    return <>{children}</>;
  }

  const isExpiredTrial = user?.trialStatus === 'EXPIRED';

  // Compact Gate (e.g. for table rows, small widgets, or headers)
  if (compact) {
    return (
      <div className="flex items-center justify-between p-2 rounded-lg bg-[#0a0f1d] border border-cyan-900/30 text-xs">
        <div className="flex items-center space-x-2">
          <Lock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono font-bold text-slate-300 text-[11px]">{featureName}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
            PRO
          </span>
        </div>
        <button
          type="button"
          onClick={onUpgradeClick}
          className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95"
          aria-label={`Unlock ${featureName} with PRO`}
        >
          <span>Unlock PRO</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  }

  // Full Institutional Gate Card
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0d1424] to-[#070b14] border border-[#1b253b] p-6 text-center shadow-xl">
      {/* Background radial accent */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md mx-auto space-y-3">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>PRO INTELLIGENCE</span>
        </div>

        <h4 className="text-lg font-bold font-mono text-white tracking-tight flex items-center justify-center space-x-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          <span>{featureName}</span>
        </h4>

        <p className="text-xs text-slate-400 leading-relaxed">
          {description ||
            `Advanced quantitative intelligence, sub-second scores, and multi-timeframe confluence are reserved for PRO accounts.`}
        </p>

        {isExpiredTrial && (
          <div className="text-[11px] font-mono text-amber-400/90 flex items-center justify-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Your 7-day PRO trial has ended. Upgrade to continue receiving institutional alpha.</span>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={onUpgradeClick}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center space-x-2"
          >
            <span>Upgrade to PRO</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[10px] text-slate-500 font-mono pt-1">
          Analytical tools, not financial advice.
        </p>
      </div>
    </div>
  );
};
