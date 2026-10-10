import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Check,
  X as XIcon,
  ShieldCheck,
  TrendingUp,
  Waves,
  BarChart2,
  Users,
  Lock,
  ArrowRight,
  Info,
  Clock,
  HelpCircle
} from 'lucide-react';
import { User, SubscriptionPlanConfig, SubscriptionFeatureComparisonItem } from '../types';
import { clientEntitlementService } from '../services/entitlementService';
import { formatCurrency, clientSubscriptionService } from '../services/subscriptionService';
import { ProUpgradeModal } from './ProUpgradeModal';

interface PricingViewProps {
  user: User | null;
  token: string | null;
  onUserUpdated?: (user: User) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  user,
  token,
  onUserUpdated,
  onNavigateToTab
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [comparison, setComparison] = useState<SubscriptionFeatureComparisonItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>(undefined);

  const isPro = clientEntitlementService.isPro(user);
  const isTrial = clientEntitlementService.isTrialActive(user);
  const isExpiredTrial = user?.trialStatus === 'EXPIRED';
  const trialDetails = clientEntitlementService.getTrialDetails(user);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/subscription/plans')
      .then(res => res.json())
      .then(data => {
        if (data.plans) setPlans(data.plans);
        if (data.comparison) setComparison(data.comparison);
      })
      .catch(err => {
        console.error('Failed to load pricing plans:', err);
        setComparison(clientSubscriptionService.getFeatureComparison());
      })
      .finally(() => setIsLoading(false));
  }, []);

  const freePlan = plans.find(p => p.planId === 'FREE') || {
    planId: 'FREE' as const,
    displayName: 'Free Analyst',
    billingPeriod: 'FREE' as const,
    price: 0,
    currency: 'USD',
    locale: 'en-US',
    description: 'Foundational crypto intelligence for spot and derivatives markets.',
    features: [
      'Basic market overview and multi-exchange order books',
      'BTC & ETH institutional signal intelligence',
      'Spot & perpetual technical indicators (RSI, MA, Bollinger)',
      'AI Quant Trader with 15-second rewarded ad verification',
      'Standard scanner with up to 50 active pairs',
      'Up to 3 price and volatility alerts',
      'Watchlist with up to 5 tracked assets'
    ],
    isActive: true,
    sortOrder: 1
  };

  const monthlyPlan = plans.find(p => p.billingPeriod === 'MONTHLY') || {
    planId: 'PRO_MONTHLY' as const,
    displayName: 'PRO Monthly',
    billingPeriod: 'MONTHLY' as const,
    price: 29,
    currency: 'USD',
    locale: 'en-US',
    description: 'Complete institutional quantitative suite billed monthly.',
    features: [
      'Full 100+ asset signal intelligence & structural breakout alerts',
      'Multi-timeframe confluence analysis (5m, 15m, 1h, 4h, 1D)',
      'Bull Potential & Downside Risk sub-second score breakdown',
      'Whale Radar & on-chain exchange transfer analytics',
      'CVD order flow aggression delta & liquidation heatmaps',
      'PRO Alpha Community forum access (daily 00:00 UTC resets)',
      'Instant AI Quant Trader with ZERO 15-second ad delays',
      'Up to 25 custom analytical alerts & unlimited watchlists'
    ],
    isActive: true,
    sortOrder: 2
  };

  const yearlyPlan = plans.find(p => p.billingPeriod === 'YEARLY') || {
    planId: 'PRO_YEARLY' as const,
    displayName: 'PRO Annual',
    billingPeriod: 'YEARLY' as const,
    price: 290,
    currency: 'USD',
    locale: 'en-US',
    description: 'Maximum alpha commitment with 2 months free equivalent.',
    features: [
      'Everything in PRO Monthly',
      '2 months free savings ($58 annual reduction)',
      'Priority market-data stream routing and lowest latency feeds',
      'Institutional API export and historical signal replay',
      'Early access to new exchange connector integrations'
    ],
    isActive: true,
    sortOrder: 3,
    savingsBadge: 'Save 17%'
  };

  const activeProPlan = billingPeriod === 'YEARLY' ? yearlyPlan : monthlyPlan;

  const handleOpenUpgrade = (context?: string) => {
    setUpgradeContext(context);
    setIsUpgradeModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4 pt-4">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>TRANSPARENT INSTITUTIONAL PLANS</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono text-white tracking-tight">
          Quant Intelligence For Every Trader
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Access high-conviction market signals, multi-timeframe confluence, and institutional order flow. Choose between our foundational free tier or unlock full quantitative coverage.
        </p>

        {/* Status Callout Banner */}
        {isTrial ? (
          <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 max-w-xl mx-auto text-center space-y-1">
            <div className="flex items-center justify-center space-x-2 text-cyan-300 font-mono font-bold text-xs">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>You are currently enjoying your 7-Day PRO Trial</span>
            </div>
            <p className="text-xs text-slate-300">
              {trialDetails.remainingDays} days remaining ({trialDetails.remainingHours}h) until your trial completes. Full institutional intelligence is currently active.
            </p>
          </div>
        ) : isExpiredTrial ? (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 max-w-xl mx-auto text-center space-y-1">
            <div className="flex items-center justify-center space-x-2 text-amber-300 font-mono font-bold text-xs">
              <Info className="w-4 h-4 text-amber-400" />
              <span>Your 7-Day PRO Trial has ended</span>
            </div>
            <p className="text-xs text-slate-300">
              You are now on the Free Plan. BTC and ETH signals, basic scanner, and live prices remain available. Upgrade to PRO to re-enable altcoin intelligence and order flow.
            </p>
          </div>
        ) : isPro ? (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 max-w-xl mx-auto text-center space-y-1">
            <div className="flex items-center justify-center space-x-2 text-emerald-300 font-mono font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Active PRO Subscription</span>
            </div>
            <p className="text-xs text-slate-300">
              Subscription Source: <span className="font-mono font-bold uppercase">{user?.subscriptionSource || 'Active'}</span>. You have unrestricted access to all quantitative intelligence tools.
            </p>
          </div>
        ) : null}

        {/* Monthly vs Annual Toggle */}
        <div className="flex justify-center pt-2">
          <div className="inline-flex p-1 bg-[#0d1424] border border-[#1b253b] rounded-2xl shadow-inner">
            <button
              type="button"
              onClick={() => setBillingPeriod('MONTHLY')}
              className={`px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                billingPeriod === 'MONTHLY'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('YEARLY')}
              className={`px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-2 ${
                billingPeriod === 'YEARLY'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards: Mobile Stacked, Desktop Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* FREE CARD */}
        <div className="flex flex-col justify-between rounded-3xl bg-[#0c1424] border border-[#1b253b] p-6 sm:p-8 shadow-xl relative">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-mono text-white">{freePlan.displayName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Foundational market scanning</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                FREE
              </span>
            </div>

            <div className="pt-2">
              <span className="text-4xl font-extrabold font-mono text-white">$0</span>
              <span className="text-xs text-slate-400 ml-1 font-mono">/forever</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              Essential directional context on BTC and ETH with multi-exchange spot order books.
            </p>

            <div className="pt-4 border-t border-[#162238] space-y-2.5">
              <div className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                Included Features
              </div>
              {freePlan.features.map((feat, idx) => (
                <div key={idx} className="flex items-start space-x-2.5 text-xs text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8">
            <button
              type="button"
              disabled={!isPro && !isTrial}
              onClick={() => onNavigateToTab?.('signals')}
              className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all text-center ${
                !isPro && !isTrial
                  ? 'bg-slate-800 text-slate-400 cursor-default'
                  : 'bg-[#142038] hover:bg-[#1a2c4e] text-slate-200'
              }`}
            >
              {!isPro && !isTrial ? 'Current Plan' : 'View Free Features'}
            </button>
          </div>
        </div>

        {/* PRO CARD */}
        <div className="flex flex-col justify-between rounded-3xl bg-gradient-to-b from-[#0f1b33] to-[#091122] border-2 border-cyan-500/50 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Accent glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-mono text-white flex items-center space-x-2">
                  <span>{activeProPlan.displayName}</span>
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </h3>
                <p className="text-xs text-cyan-300/80 mt-0.5">Sub-second quant signals</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-600/50 font-mono text-xs font-bold">
                PRO ALPHA
              </span>
            </div>

            <div className="pt-2">
              <span className="text-4xl font-extrabold font-mono text-white">
                {formatCurrency(activeProPlan.price, activeProPlan.currency, activeProPlan.locale)}
              </span>
              <span className="text-xs text-slate-400 ml-1 font-mono">
                {billingPeriod === 'YEARLY' ? '/year' : '/month'}
              </span>
              {billingPeriod === 'YEARLY' && (
                <div className="text-[11px] font-mono text-emerald-400 font-bold mt-1">
                  Equivalent to $24.16/mo (Save $58 annually)
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              Institutional cross-exchange arbitrage feeds, whale movements, order flow aggression, and alpha community.
            </p>

            <div className="pt-4 border-t border-[#1e2f4f] space-y-2.5">
              <div className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                Full Quantitative Suite
              </div>
              {activeProPlan.features.map((feat, idx) => (
                <div key={idx} className="flex items-start space-x-2.5 text-xs text-slate-200">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 relative z-10">
            {isTrial ? (
              <button
                type="button"
                onClick={() => handleOpenUpgrade('PRO Trial Upgrade')}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>View PRO Plans (Trial Active)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : isPro ? (
              <button
                type="button"
                disabled
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-950 border border-emerald-600/50 text-emerald-300 font-mono text-xs font-bold uppercase tracking-wider cursor-default flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Plan Active</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenUpgrade('Pro Upgrade Page')}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>Upgrade to PRO</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feature Comparison Table (Section 12) */}
      <div className="max-w-4xl mx-auto pt-6 space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold font-mono text-white">
            Feature Comparison Matrix
          </h2>
          <p className="text-xs text-slate-400">
            Compare capabilities across Free and PRO subscriptions
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#1b253b] bg-[#090f1d] shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b253b] bg-[#0c1424]">
                <th className="p-3.5 font-mono text-slate-400 font-bold">Feature</th>
                <th className="p-3.5 font-mono text-slate-400 font-bold text-center w-36">FREE</th>
                <th className="p-3.5 font-mono text-cyan-300 font-bold text-center w-36 bg-cyan-950/30">
                  PRO
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141e33]">
              {comparison.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#0d1627] transition-colors">
                  <td className="p-3.5 text-slate-200 font-medium">
                    <div>{row.feature}</div>
                    {row.tooltip && (
                      <div className="text-[10px] text-slate-500 mt-0.5">{row.tooltip}</div>
                    )}
                  </td>
                  <td className="p-3.5 text-center font-mono">
                    {row.freeSupported === true ? (
                      <span className="inline-flex items-center text-emerald-400 font-bold space-x-1">
                        <Check className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{row.freeValue}</span>
                      </span>
                    ) : row.freeSupported === 'LIMITED' ? (
                      <span className="inline-flex items-center text-amber-400 text-[11px] font-bold">
                        {row.freeValue}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-slate-500 space-x-1">
                        <XIcon className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-[11px]">{row.freeValue}</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-center font-mono bg-cyan-950/10">
                    <span className="inline-flex items-center text-cyan-300 font-bold space-x-1">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px]">{row.proValue}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytical Disclaimer (Section 5) */}
      <div className="max-w-2xl mx-auto text-center pt-4 space-y-1 text-slate-500 text-[11px] font-mono">
        <p>Analytical tools, not financial advice.</p>
        <p>Market data feeds derived from direct exchange WebSocket and REST order books.</p>
      </div>

      {/* Reusable Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        user={user}
        token={token}
        onUserUpdated={onUserUpdated}
        featureContext={upgradeContext}
      />
    </div>
  );
};
