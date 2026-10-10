import React from 'react';
import {
  RefreshCw,
  Bell,
  User as UserIcon
} from 'lucide-react';
import { ExchangeId, MarketOverview, NormalizedCoinData, User } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { NavTab } from './MarketHeader';
import { SearchableExchangeSelector } from './SearchableExchangeSelector';

interface MobileHeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeExchange: ExchangeId;
  setActiveExchange: (ex: ExchangeId) => void;
  overview: MarketOverview | null;
  coins?: NormalizedCoinData[];
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  unacknowledgedAlertsCount?: number;
  onOpenMore?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeTab,
  setActiveTab,
  activeExchange,
  setActiveExchange,
  overview,
  user,
  onOpenAuth,
  onLogout,
  onRefresh,
  isRefreshing,
  unacknowledgedAlertsCount = 0,
  onOpenMore
}) => {
  return (
    <header className="block lg:hidden sticky top-0 z-40 bg-[#080d16]/95 backdrop-blur-md border-b border-[#182338]">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        {/* Brand & Exchange selector */}
        <div className="flex items-center space-x-2 min-w-0 flex-shrink">
          <button
            onClick={() => setActiveTab('score')}
            className="flex items-center space-x-1.5 focus:outline-none flex-shrink-0 min-h-[38px] cursor-pointer"
            title="Return to Main Dashboard"
          >
            <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 rotate-45 shadow-sm shadow-cyan-400/50 flex-shrink-0" />
            <span className="font-bold text-xs tracking-wider text-white font-mono hidden sm:inline">
              CRYPTO INTEL
            </span>
            <span className="font-bold text-xs tracking-wider text-white font-mono sm:hidden">
              CI
            </span>
          </button>

          {/* Searchable Global Exchange / Broker Selector (Phase 11) */}
          <SearchableExchangeSelector
            activeExchange={activeExchange}
            onSelectExchange={setActiveExchange}
            variant="mobile"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 active:text-cyan-400 transition-colors"
            title="Refresh market data"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Notifications quick button */}
          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-11 h-11 flex items-center justify-center rounded-lg relative text-slate-400 active:text-cyan-400 transition-colors ${
              activeTab === 'notifications' ? 'text-cyan-300' : ''
            }`}
            title="Notification Center"
            aria-label="Notification Center"
          >
            <Bell className="w-4 h-4" />
            {unacknowledgedAlertsCount > 0 && (
              <span className="absolute top-1 right-1 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white font-mono font-bold text-[9px] flex items-center justify-center shadow-md shadow-rose-950 animate-pulse">
                {unacknowledgedAlertsCount > 99 ? '99+' : unacknowledgedAlertsCount}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <div className="w-11 h-11 flex items-center justify-center">
            <ThemeToggle variant="compact" className="w-9 h-9 !rounded-lg flex items-center justify-center" />
          </div>

          {/* User profile / Auth button */}
          {user ? (
            <button
              onClick={() => {
                if (onOpenMore) onOpenMore();
                else setActiveTab('score');
              }}
              className="w-11 h-11 rounded-lg bg-[#0d1424] border border-[#1d2b42] text-cyan-400 flex items-center justify-center"
              title={user.name || user.email}
              aria-label="User profile and settings"
            >
              <UserIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="min-h-[44px] px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold font-mono transition-all flex items-center justify-center"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
