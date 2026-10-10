import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  TrendingUp,
  Waves,
  BarChart2,
  Users,
  Lock,
  ArrowRight,
  Info,
  Check,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { User, SubscriptionPlanConfig } from '../types';
import { clientEntitlementService } from '../services/entitlementService';
import { formatCurrency, clientSubscriptionService } from '../services/subscriptionService';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  token: string | null;
  onUserUpdated?: (user: User) => void;
  featureContext?: string;
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
  onUserUpdated,
  featureContext
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'DETAILS' | 'CHECKOUT_INFO'>('DETAILS');
  const [checkoutFeedback, setCheckoutFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load active plans on mount
  useEffect(() => {
    if (isOpen) {
      setCheckoutStep('DETAILS');
      setCheckoutFeedback(null);
      setIsLoadingPlans(true);
      fetch('/api/subscription/plans')
        .then(res => res.json())
        .then(data => {
          if (data.plans) setPlans(data.plans);
        })
        .catch(err => console.error('Failed to load plans:', err))
        .finally(() => setIsLoadingPlans(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPro = clientEntitlementService.isPro(user);
  const isTrial = clientEntitlementService.isTrialActive(user);
  const trialDetails = clientEntitlementService.getTrialDetails(user);

  const monthlyPlan = plans.find(p => p.billingPeriod === 'MONTHLY') || {
    planId: 'PRO_MONTHLY' as const,
    displayName: 'PRO Monthly',
    billingPeriod: 'MONTHLY' as const,
    price: 29,
    currency: 'USD',
    locale: 'en-US',
    description: 'Billed monthly',
    features: [],
    isActive: true,
    sortOrder: 1
  };

  const yearlyPlan = plans.find(p => p.billingPeriod === 'YEARLY') || {
    planId: 'PRO_YEARLY' as const,
    displayName: 'PRO Annual',
    billingPeriod: 'YEARLY' as const,
    price: 290,
    currency: 'USD',
    locale: 'en-US',
    description: 'Billed annually',
    features: [],
    isActive: true,
    sortOrder: 2,
    savingsBadge: 'Save 17%'
  };

  const selectedPlan = billingPeriod === 'YEARLY' ? yearlyPlan : monthlyPlan;

  const handleStartCheckout = async () => {
    setIsProcessing(true);
    setCheckoutFeedback(null);
    try {
      const resp = await clientSubscriptionService.initiateCheckout(selectedPlan.planId, token);
      setCheckoutStep('CHECKOUT_INFO');
      setCheckoutFeedback(resp.message);
    } catch (err: any) {
      setCheckoutFeedback(err.message || 'Failed to initiate checkout.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestProToggle = async (grant: boolean) => {
    if (!token) {
      setCheckoutFeedback('Authentication required.');
      return;
    }
    setIsProcessing(true);
    setCheckoutFeedback(null);
    try {
      const endpoint = grant ? '/api/community/test/grant-pro' : '/api/community/test/revoke-pro';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setCheckoutFeedback(grant ? 'PRO test entitlement activated!' : 'PRO test entitlement revoked (Free Plan).');
        if (onUserUpdated && data.user) {
          onUserUpdated(data.user);
        }
      } else {
        setCheckoutFeedback(data.error || 'Failed to update test entitlement.');
      }
    } catch (err: any) {
      setCheckoutFeedback(err.message || 'Network error.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-[#090e1a] border border-[#1e2d4a] rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Subtle accent glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
          aria-label="Close upgrade modal"
        >
          <X className="w-5 h-5" />
        </button>

        {checkoutStep === 'DETAILS' ? (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold mb-3 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>INSTITUTIONAL QUANT INTELLIGENCE</span>
              </div>

              <h3 id="upgrade-modal-title" className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                Unlock Full PRO Intelligence
              </h3>

              {featureContext ? (
                <p className="text-xs text-amber-400 mt-2 font-mono">
                  Access to <span className="font-bold underline">{featureContext}</span> requires active PRO entitlement.
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
                  Cross-exchange market signals, multi-timeframe confluence, and quantitative risk modeling.
                </p>
              )}
            </div>

            {/* Current user status indicator */}
            <div className="p-3.5 rounded-2xl bg-[#0e172a] border border-[#1e293b] mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Current Plan:</span>
                <span className="font-mono font-bold text-white uppercase">
                  {user?.role === 'admin'
                    ? 'Admin Access'
                    : isTrial
                    ? 'PRO Trial (Active)'
                    : isPro
                    ? 'PRO Subscriber'
                    : user?.trialStatus === 'EXPIRED'
                    ? 'Free Plan (Trial Expired)'
                    : 'Free Analyst'}
                </span>
              </div>
              {isTrial && (
                <span className="text-amber-400 font-mono text-[11px] font-bold">
                  {trialDetails.remainingDays} days remaining ({trialDetails.remainingHours}h)
                </span>
              )}
            </div>

            {/* Monthly vs Annual Plan Selector */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex p-1 bg-[#0b1322] border border-[#1d2a44] rounded-xl">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('MONTHLY')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    billingPeriod === 'MONTHLY'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('YEARLY')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
                    billingPeriod === 'YEARLY'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Annual</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-bold">
                    Save 17%
                  </span>
                </button>
              </div>
            </div>

            {/* Price display banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-[#0d1627] to-amber-950/40 border border-cyan-500/30 mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-cyan-300 font-bold uppercase">
                  {selectedPlan.displayName}
                </div>
                <div className="text-[11px] text-slate-400">
                  {billingPeriod === 'YEARLY' ? 'Equivalent to $24.16/mo billed annually' : 'Flexible monthly renewal'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-white">
                  {formatCurrency(selectedPlan.price, selectedPlan.currency, selectedPlan.locale)}
                  <span className="text-xs font-normal text-slate-400">
                    {billingPeriod === 'YEARLY' ? '/year' : '/month'}
                  </span>
                </div>
                {billingPeriod === 'YEARLY' && (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">2 months free</span>
                )}
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {[
                {
                  icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
                  title: '100+ Asset Signal Engine',
                  desc: 'Multi-timeframe confluence & structural breakout signals on all coins.'
                },
                {
                  icon: <Zap className="w-4 h-4 text-cyan-400" />,
                  title: 'Bull & Downside Risk Scores',
                  desc: 'Sub-second quantitative regime classification across spot and perpetual pairs.'
                },
                {
                  icon: <Waves className="w-4 h-4 text-blue-400" />,
                  title: 'Whale Flow & Radar',
                  desc: 'Exchange inflow/outflow analytics and large wallet cluster tracking.'
                },
                {
                  icon: <BarChart2 className="w-4 h-4 text-purple-400" />,
                  title: 'Order Flow & CVD Divergence',
                  desc: 'Aggressive buyer/seller delta and liquidation squeeze maps.'
                },
                {
                  icon: <Users className="w-4 h-4 text-amber-400" />,
                  title: 'PRO Alpha Community',
                  desc: 'Verified trader channels with 00:00 UTC resets and alpha feeds.'
                },
                {
                  icon: <Sparkles className="w-4 h-4 text-pink-400" />,
                  title: 'Zero-Ad AI Quant Trader',
                  desc: 'Instant AI queries with ZERO 15-second rewarded ad delays and higher quota.'
                }
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#0c1424] border border-[#1b253b] space-y-1">
                  <div className="flex items-center space-x-2">
                    {item.icon}
                    <span className="text-xs font-bold text-white font-mono">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Analytical Disclaimer */}
            <p className="text-[10px] text-slate-500 font-mono text-center mb-6">
              Analytical tools, not financial advice.
            </p>

            {/* Feedback message */}
            {checkoutFeedback && (
              <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono text-center">
                {checkoutFeedback}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleStartCheckout}
                disabled={isProcessing}
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                <span>Upgrade to PRO ({formatCurrency(selectedPlan.price, selectedPlan.currency)})</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-6 rounded-xl bg-[#0c1424] hover:bg-[#131d33] border border-[#1b253b] text-slate-300 font-mono font-bold text-xs tracking-wider uppercase transition-all"
              >
                Maybe Later
              </button>
            </div>

            {/* Reviewer / QA quick test toggle */}
            <div className="mt-6 pt-4 border-t border-[#162238] flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>QA Entitlement Testing:</span>
              {!isPro ? (
                <button
                  type="button"
                  onClick={() => handleTestProToggle(true)}
                  disabled={isProcessing}
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  Activate Test PRO Entitlement
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTestProToggle(false)}
                  disabled={isProcessing}
                  className="text-rose-400 hover:text-rose-300 underline"
                >
                  Revoke PRO (Test Free Plan)
                </button>
              )}
            </div>
          </>
        ) : (
          /* Informational Checkout Step (Section 23 - Payment Disabled State) */
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold">
              <span>PRO SUBSCRIPTION CHECKOUT</span>
            </div>

            <h4 className="text-xl font-bold font-mono text-white">
              Payment Gateway Integration Notice
            </h4>

            <div className="p-4 rounded-2xl bg-[#0c1424] border border-[#1b253b] text-left text-xs space-y-3 max-w-lg mx-auto">
              <div className="flex items-start space-x-2 text-slate-300">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p>
                  Direct payment processing (via RevenueCat / Stripe / App Store) is currently scheduled for an upcoming release.
                </p>
              </div>
              <div className="flex items-start space-x-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Your account has NOT been charged.</strong> No financial transaction was executed.
                </p>
              </div>
              <div className="flex items-start space-x-2 text-slate-300">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Selected Plan: <strong>{selectedPlan.displayName} ({formatCurrency(selectedPlan.price, selectedPlan.currency)})</strong>
                </p>
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row justify-center gap-3">
              <button
                type="button"
                onClick={() => setCheckoutStep('DETAILS')}
                className="py-2.5 px-5 rounded-xl bg-[#0c1424] hover:bg-[#131d33] border border-[#1b253b] text-slate-300 font-mono font-bold text-xs uppercase"
              >
                Back to Plans
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs uppercase shadow-md"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Backwards compatibility alias
export const UpgradeModal = ProUpgradeModal;
