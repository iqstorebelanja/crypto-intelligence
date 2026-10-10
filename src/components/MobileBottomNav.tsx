import React from 'react';
import {
  TrendingUp,
  SlidersHorizontal,
  Sparkles,
  Users,
  MoreHorizontal
} from 'lucide-react';
import { NavTab } from './MarketHeader';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  onOpenMore: () => void;
  isMoreOpen: boolean;
  unacknowledgedAlertsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  onOpenMore,
  isMoreOpen,
  unacknowledgedAlertsCount = 0
}) => {
  // Determine if active route belongs to "More" category
  const isMoreActive =
    isMoreOpen ||
    [
      'crash_risk',
      'derivatives',
      'structure',
      'watchlist',
      'alerts',
      'data_quality',
      'whales',
      'ai_trader',
      'admin',
      'account',
      'pricing'
    ].includes(activeTab);

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="block lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080d16]/95 backdrop-blur-lg border-t border-[#182338] pb-safe font-mono shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
    >
      <div className="grid grid-cols-5 h-14 max-w-md mx-auto items-center">
        {/* 1. HOME */}
        <button
          onClick={() => {
            onNavigate('score');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`h-full flex flex-col items-center justify-center space-y-1 transition-colors select-none ${
            activeTab === 'score' && !isMoreOpen
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Home"
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        {/* 2. SCAN */}
        <button
          onClick={() => {
            onNavigate('score');
            // Smoothly scroll down to scanner section on mobile
            setTimeout(() => {
              const el = document.getElementById('market-scanner-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }}
          className={`h-full flex flex-col items-center justify-center space-y-1 transition-colors select-none ${
            activeTab === 'score' && !isMoreOpen
              ? 'text-slate-300 hover:text-cyan-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Scanner"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-[10px] tracking-tight">Scan</span>
        </button>

        {/* 3. SIGNALS (Phase 7 Signal Engine) */}
        <button
          onClick={() => onNavigate('signals')}
          className={`h-full flex flex-col items-center justify-center space-y-1 transition-colors select-none ${
            activeTab === 'signals' && !isMoreOpen
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Signals"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4" />
            <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
          </div>
          <span className="text-[10px] tracking-tight">Signals</span>
        </button>

        {/* 4. COMMUNITY (PRO Forum) */}
        <button
          onClick={() => onNavigate('community')}
          className={`h-full flex flex-col items-center justify-center space-y-1 transition-colors select-none ${
            activeTab === 'community' && !isMoreOpen
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Community"
        >
          <div className="relative">
            <Users className="w-4 h-4" />
            <span className="absolute -top-1 -right-2 text-[7px] font-bold px-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40">
              PRO
            </span>
          </div>
          <span className="text-[10px] tracking-tight">Community</span>
        </button>

        {/* 5. MORE */}
        <button
          onClick={onOpenMore}
          className={`h-full flex flex-col items-center justify-center space-y-1 transition-colors select-none relative ${
            isMoreActive ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="More Menu"
        >
          <div className="relative">
            <MoreHorizontal className="w-4 h-4" />
            {unacknowledgedAlertsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-1 animate-ping" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};
