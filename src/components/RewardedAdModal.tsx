import React, { useEffect, useState, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Lock,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Timer,
  X,
  Zap
} from 'lucide-react';
import { rewardedAdClient, AdCreativeData } from '../services/rewardedAdClient';
import { AIQuotaStatus, RewardedAdSession } from '../types';

interface RewardedAdModalProps {
  isOpen: boolean;
  quota: AIQuotaStatus | null;
  token: string | null;
  onRewardVerified: (sessionId: string) => void;
  onClose: () => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  quota,
  token,
  onRewardVerified,
  onClose
}) => {
  const [phase, setPhase] = useState<'PROMPT' | 'PLAYING' | 'VERIFYING' | 'SUCCESS' | 'ERROR'>('PROMPT');
  const [session, setSession] = useState<RewardedAdSession | null>(null);
  const [creative, setCreative] = useState<AdCreativeData | null>(null);
  const [countdown, setCountdown] = useState<number>(15);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEarlyCloseWarning, setIsEarlyCloseWarning] = useState<boolean>(false);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('PROMPT');
      setCountdown(15);
      setErrorMessage(null);
      setIsEarlyCloseWarning(false);
    } else {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartAd = async () => {
    setErrorMessage(null);
    setPhase('PLAYING');

    const init = await rewardedAdClient.loadAd(token);
    if (!init.success || !init.session || !init.creative) {
      setPhase('ERROR');
      setErrorMessage(init.error || 'Rewarded ad is currently unavailable. Please try again shortly.');
      return;
    }

    setSession(init.session);
    setCreative(init.creative);
    setCountdown(init.creative.durationSeconds || 15);

    // Notify server of start
    await rewardedAdClient.startAd(init.session.sessionId, token);

    // Start 15s timer
    const totalDuration = init.creative.durationSeconds || 15;
    let remaining = totalDuration;

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(async () => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        // Complete & verify
        setPhase('VERIFYING');
        try {
          const verifyRes = await rewardedAdClient.verifyReward(
            init.session!.sessionId,
            init.session!.verificationToken,
            token
          );

          if (verifyRes.success) {
            setPhase('SUCCESS');
            setTimeout(() => {
              onRewardVerified(init.session!.sessionId);
            }, 1200);
          } else {
            setPhase('ERROR');
            setErrorMessage(verifyRes.error || 'Server reward verification failed.');
          }
        } catch (err) {
          setPhase('ERROR');
          setErrorMessage((err as Error).message);
        }
      }
    }, 1000);
  };

  const handleRequestClose = () => {
    if (phase === 'PLAYING') {
      setIsEarlyCloseWarning(true);
    } else {
      onClose();
    }
  };

  const handleConfirmEarlyClose = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setIsEarlyCloseWarning(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0b0f19] border border-cyan-900/50 rounded-2xl shadow-2xl overflow-hidden font-mono">
        {/* Top Header / Mode Banner */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#080d16] border-b border-[#182338]">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-sm tracking-wider text-white">AI TRADER GATE</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
              FREE TIER
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/50">
              TEST MODE
            </span>
            <button
              onClick={handleRequestClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Phase 1: PROMPT */}
        {phase === 'PROMPT' && (
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 mx-auto flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-wide">
                15-Second Rewarded Sponsor Gate
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                Free access requires a 15-second rewarded advertisement before each AI Trader request.
                After the ad finishes, your AI Trader analysis will begin immediately.
              </p>
            </div>

            {/* Quota Summary Box */}
            <div className="p-4 bg-[#080d16] border border-[#1b253b] rounded-xl flex items-center justify-between text-xs">
              <div className="text-left">
                <span className="text-slate-400 block text-[10px]">Remaining AI Requests Today</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {quota?.remainingQuota ?? 5} / {quota?.dailyLimit ?? 5}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">Ad Gate Status</span>
                <span className="text-cyan-300 font-bold">15s Ad Required</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleStartAd}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Watch 15s Ad & Unlock Request</span>
              </button>

              <div className="text-[11px] text-slate-400 flex items-center justify-center space-x-1.5">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Want instant, ad-free AI analysis? Upgrade to PRO.</span>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: PLAYING AD */}
        {phase === 'PLAYING' && creative && (
          <div className="p-6 space-y-5">
            {/* Progress and Countdown Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-cyan-300">
                  <Timer className="w-4 h-4 animate-spin text-cyan-400" />
                  <span className="font-bold">Advertisement Playing</span>
                </div>
                <div className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/50 text-xs">
                  {countdown}s remaining
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[#182338] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 transition-all duration-1000 ease-linear"
                  style={{
                    width: `${((15 - countdown) / 15) * 100}%`
                  }}
                />
              </div>
            </div>

            {/* Simulated Partner Creative Window */}
            <div className="p-5 bg-gradient-to-b from-[#0f172a] to-[#070b14] border border-cyan-800/40 rounded-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/40 font-bold uppercase tracking-wider">
                  {creative.badge}
                </span>
                <span className="text-[10px] text-slate-500 font-sans">
                  Sponsor: {creative.sponsor}
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white text-base">
                  {creative.title}
                </h4>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  {creative.tagline}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-[11px]">
                <a
                  href={creative.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 underline"
                >
                  <span>{creative.ctaText}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-[10px] text-slate-500">
                  Rewarding 1 AI Trader Query
                </span>
              </div>
            </div>

            <p className="text-center text-[10px] text-slate-500">
              * Reward is granted upon complete 15-second verification. Do not close early.
            </p>
          </div>
        )}

        {/* Phase 3: VERIFYING */}
        {phase === 'VERIFYING' && (
          <div className="p-8 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm">Verifying Ad Reward...</h4>
              <p className="text-xs text-slate-400">
                Contacting server-side reward validator to unlock your AI request.
              </p>
            </div>
          </div>
        )}

        {/* Phase 4: SUCCESS */}
        {phase === 'SUCCESS' && (
          <div className="p-8 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-emerald-300 text-base">Reward Verified!</h4>
              <p className="text-xs text-slate-300">
                Starting AI market analysis now...
              </p>
            </div>
          </div>
        )}

        {/* Phase 5: ERROR */}
        {phase === 'ERROR' && (
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-rose-300 text-sm">Ad Verification Error</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {errorMessage || 'Failed to complete ad reward.'}
              </p>
            </div>

            <div className="pt-2 flex justify-center space-x-3">
              <button
                onClick={handleStartAd}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Ad</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[#182338] text-slate-300 hover:text-white rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Early Close Warning Prompt Overlay */}
        {isEarlyCloseWarning && (
          <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center space-y-4 z-20">
            <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-600/50 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm">Forfeit AI Request Reward?</h4>
              <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                If you close now, your AI Trader request will not be unlocked. You must watch the full 15 seconds to receive the reward.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setIsEarlyCloseWarning(false)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs"
              >
                Continue Watching
              </button>
              <button
                onClick={handleConfirmEarlyClose}
                className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs"
              >
                Close & Forfeit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
