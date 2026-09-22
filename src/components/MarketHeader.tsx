import {
  Activity,
  Bell,
  Bot,
  Clock,
  Compass,
  Layers,
  LogOut,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Star,
  TrendingUp,
  User as UserIcon,
  Waves
} from 'lucide-react';
import React from 'react';
import { DataFreshness, MarketStatus } from './Badges';
import { ExchangeId, MarketOverview, NormalizedCoinData, User } from '../types';
import { MarketSentimentIndex } from './MarketSentimentIndex';

export type NavTab =
  | 'score'
  | 'crash_risk'
  | 'derivatives'
  | 'structure'
  | 'watchlist'
  | 'alerts'
  | 'data_quality'
  | 'whales'
  | 'ai_trader'
  | 'coin_detail'
  | 'admin';

interface MarketHeaderProps {
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
}

export const MarketHeader: React.FC<MarketHeaderProps> = ({
  activeTab,
  setActiveTab,
  activeExchange,
  setActiveExchange,
  overview,
  coins,
  user,
  onOpenAuth,
  onLogout,
  onRefresh,
  isRefreshing,
  unacknowledgedAlertsCount = 0
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#080d16]/95 backdrop-blur-md border-b border-[#182338]">
      {/* Top Telemetry Strip */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#121c2d] text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div
            onClick={() => setActiveTab('score')}
            className="flex items-center space-x-2 cursor-pointer hover:opacity-90 transition-opacity"
            title="Return to Main Dashboard"
          >
            <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 rotate-45 shadow-sm shadow-cyan-400/50" />
            <span className="font-bold text-sm text-white tracking-widest">
              CRYPTO INTELLIGENCE AI
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] uppercase bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
              PHASE 2 MULTI-SOURCE
            </span>
          </div>

          {/* Exchange Selector Toggle */}
          <div className="flex items-center bg-[#0d1424] border border-[#1d2b42] rounded-lg p-0.5 text-[11px] overflow-x-auto">
            <button
              onClick={() => setActiveExchange('ALL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all whitespace-nowrap ${
                activeExchange === 'ALL'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="All Supported Exchanges (Binance + OKX + Pionex + Bybit)"
            >
              All Exchanges
            </button>
            <button
              onClick={() => setActiveExchange('BINANCE')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all whitespace-nowrap ${
                activeExchange === 'BINANCE'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Binance
            </button>
            <button
              onClick={() => setActiveExchange('OKX')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all whitespace-nowrap ${
                activeExchange === 'OKX'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              OKX
            </button>
            <button
              onClick={() => setActiveExchange('PIONEX')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all whitespace-nowrap ${
                activeExchange === 'PIONEX'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pionex
            </button>
            <button
              onClick={() => setActiveExchange('BYBIT')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all whitespace-nowrap ${
                activeExchange === 'BYBIT'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bybit
            </button>
          </div>

          <div className="hidden lg:flex items-center space-x-2 text-slate-400">
            <MarketStatus
              isHealthy={overview?.systemHealth.isHealthy ?? true}
              latencyMs={overview?.systemHealth.latencyMs ?? 48}
            />
          </div>
        </div>

        {/* Center: Market Sentiment Index Gauge (Aggregating Global RSI, Fear & Greed, and 24h Momentum) */}
        <div className="flex items-center">
          <MarketSentimentIndex
            sentiment={overview?.sentiment}
            overview={overview}
            coins={coins}
          />
        </div>

        {/* Status & User */}
        <div className="flex items-center space-x-2.5">
          <DataFreshness
            seconds={overview?.btcCondition.freshnessSeconds ?? 2}
            status={overview?.btcCondition.dataStatus ?? 'LIVE'}
          />

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh market data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {user ? (
            <div className="flex items-center space-x-2 bg-[#0d1422] border border-[#1d2a42] rounded-lg px-2.5 py-1">
              <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] text-slate-300 max-w-[120px] truncate">
                {user.name || user.email}
              </span>
              <button
                onClick={onLogout}
                className="text-slate-500 hover:text-rose-400 pl-1"
                title="Logout"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all active:scale-95"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between overflow-x-auto no-scrollbar">
        <nav className="flex items-center space-x-1 sm:space-x-1.5 text-xs font-mono">
          {/* SCORE Tab */}
          <button
            onClick={() => setActiveTab('score')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold transition-all ${
              activeTab === 'score'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>SCORE</span>
          </button>

          {/* CRASH RISK Tab */}
          <button
            onClick={() => setActiveTab('crash_risk')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold transition-all ${
              activeTab === 'crash_risk'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>CRASH RISK</span>
          </button>

          {/* DERIVATIVES Tab (Phase 2) */}
          <button
            onClick={() => setActiveTab('derivatives')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold transition-all ${
              activeTab === 'derivatives'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>DERIVATIVES</span>
          </button>

          {/* STRUCTURE Tab (Phase 2) */}
          <button
            onClick={() => setActiveTab('structure')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold transition-all ${
              activeTab === 'structure'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>STRUCTURE</span>
          </button>

          {/* WATCHLIST Tab */}
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold transition-all ${
              activeTab === 'watchlist'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
            <span>WATCHLIST</span>
          </button>

          {/* ALERTS Tab (Phase 2) */}
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold transition-all relative ${
              activeTab === 'alerts'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-cyan-400" />
            <span>ALERTS</span>
            {unacknowledgedAlertsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1 right-1" />
            )}
          </button>

          {/* DATA QUALITY Tab (Phase 2) */}
          <button
            onClick={() => setActiveTab('data_quality')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold transition-all ${
              activeTab === 'data_quality'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span>DATA QUALITY</span>
          </button>

          {/* WHALES Tab (Phase 3) */}
          <button
            onClick={() => setActiveTab('whales')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold transition-all ${
              activeTab === 'whales'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-indigo-400" />
            <span>WHALES</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
              P3
            </span>
          </button>

          {/* AI TRADER Tab (Phase 3) */}
          <button
            onClick={() => setActiveTab('ai_trader')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-semibold transition-all ${
              activeTab === 'ai_trader'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span>AI TRADER</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-700/50">
              P3
            </span>
          </button>

          {/* ADMIN Tab (Phase 4A) - Visible for all, fully enabled with RBAC enforcement */}
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold transition-all ${
              activeTab === 'admin'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                : user?.role === 'admin'
                ? 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/40 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>ADMIN</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
              P4A
            </span>
          </button>
        </nav>

        {/* Regulatory disclaimer chip */}
        <div className="hidden xl:flex items-center text-[10px] text-slate-500 font-mono">
          <span>ANALYTICAL PLATFORM • NOT AN EXECUTION BOT</span>
        </div>
      </div>
    </header>
  );
};
