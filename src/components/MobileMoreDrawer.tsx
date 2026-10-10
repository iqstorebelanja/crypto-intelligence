import React from 'react';
import {
  X,
  Bot,
  ShieldAlert,
  Layers,
  Waves,
  Compass,
  Star,
  Bell,
  Radio,
  Shield,
  User as UserIcon,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Sparkles
} from 'lucide-react';
import { NavTab } from './MarketHeader';
import { User } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../utils/theme';
import { PWAInstallBanner } from './PWAInstallBanner';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  unacknowledgedAlertsCount?: number;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigate,
  user,
  onOpenAuth,
  onLogout,
  unacknowledgedAlertsCount = 0
}) => {
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const handleItemClick = (tab: NavTab) => {
    onNavigate(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#0c121e] border-t border-[#1b253b] rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe shadow-2xl font-mono text-xs z-10 animate-in slide-in-from-bottom duration-300">
        {/* Drag Handle & Header */}
        <div className="sticky top-0 bg-[#0c121e]/95 backdrop-blur-md px-5 pt-3 pb-3 border-b border-[#182338] flex items-center justify-between z-20">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-4 bg-cyan-400 rounded-full" />
            <span className="font-bold text-sm text-white uppercase tracking-wider">
              Navigation & Tools
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#182338]"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* FEATURED: AI TRADER (High Prominence) */}
          <div>
            <button
              onClick={() => handleItemClick('ai_trader')}
              className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all border ${
                activeTab === 'ai_trader'
                  ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-md shadow-purple-900/30'
                  : 'bg-gradient-to-r from-purple-950/30 to-[#0d1424] border-purple-800/40 hover:border-purple-500/50 text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">AI TRADER</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/80 text-purple-300 font-bold border border-purple-500/30">
                      INTELLIGENCE
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Macro analysis, whale radar & quantitative Q&A
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-400" />
            </button>

            {/* FEATURED: PRO UPGRADE & PRICING */}
            <button
              onClick={() => handleItemClick('pricing')}
              className={`w-full mt-2 p-3.5 rounded-2xl flex items-center justify-between transition-all border ${
                activeTab === 'pricing'
                  ? 'bg-gradient-to-r from-amber-950/40 to-cyan-950/40 border-amber-500 text-amber-200 shadow-md'
                  : 'bg-gradient-to-r from-[#0d1627] to-[#0a101f] border-[#1d2a44] hover:border-amber-500/50 text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">PRO UPGRADE & PRICING</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                      PLANS
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Compare Free vs PRO & institutional suite
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </button>
            {/* PWA INSTALL ACTION */}
            <div className="mt-2">
              <PWAInstallBanner variant="drawer-item" />
            </div>
          </div>

          {/* SECTION 1: MARKET INTELLIGENCE */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Market Intelligence
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Crash Risk */}
              <button
                onClick={() => handleItemClick('crash_risk')}
                className={`p-3 rounded-xl border flex items-center space-x-2.5 transition-all text-left ${
                  activeTab === 'crash_risk'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 font-bold'
                    : 'bg-[#080d16] border-[#182338] text-slate-300 active:bg-[#121c2e]'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-xs">Crash Risk</div>
                  <div className="text-[10px] text-slate-500 font-sans">Downside radar</div>
                </div>
              </button>

              {/* Derivatives */}
              <button
                onClick={() => handleItemClick('derivatives')}
                className={`p-3 rounded-xl border flex items-center space-x-2.5 transition-all text-left ${
                  activeTab === 'derivatives'
                    ? 'bg-purple-950/40 border-purple-500/50 text-purple-300 font-bold'
                    : 'bg-[#080d16] border-[#182338] text-slate-300 active:bg-[#121c2e]'
                }`}
              >
                <Layers className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-xs">Derivatives</div>
                  <div className="text-[10px] text-slate-500 font-sans">OI & funding</div>
                </div>
              </button>

              {/* Whales */}
              <button
                onClick={() => handleItemClick('whales')}
                className={`p-3 rounded-xl border flex items-center space-x-2.5 transition-all text-left ${
                  activeTab === 'whales'
                    ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-bold'
                    : 'bg-[#080d16] border-[#182338] text-slate-300 active:bg-[#121c2e]'
                }`}
              >
                <Waves className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-xs">Whales</div>
                  <div className="text-[10px] text-slate-500 font-sans">Order flow spikes</div>
                </div>
              </button>

              {/* Market Structure */}
              <button
                onClick={() => handleItemClick('structure')}
                className={`p-3 rounded-xl border flex items-center space-x-2.5 transition-all text-left ${
                  activeTab === 'structure'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-bold'
                    : 'bg-[#080d16] border-[#182338] text-slate-300 active:bg-[#121c2e]'
                }`}
              >
                <Compass className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-xs">Structure</div>
                  <div className="text-[10px] text-slate-500 font-sans">Support/Resistance</div>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 2: TOOLS */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Quantitative Tools
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Watchlist */}
              <button
                onClick={() => handleItemClick('watchlist')}
                className={`p-3 rounded-xl border flex items-center space-x-2.5 transition-all text-left ${
                  activeTab === 'watchlist'
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 font-bold'
                    : 'bg-[#080d16] border-[#182338] text-slate-300 active:bg-[#121c2e]'
                }`}
              >
                <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-xs">Watchlist</div>
                  <div className="text-[10px] text-slate-500 font-sans">Saved assets</div>
                </div>
              </button>

              {/* Alerts */}
              <button
                onClick={() => handleItemClick('alerts')}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all text-left relative ${
                  activeTab === 'alerts'
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 font-bold'
                    : 'bg-[#080d16] border-[#182338] text-slate-300 active:bg-[#121c2e]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Bell className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-xs">Alerts</div>
                    <div className="text-[10px] text-slate-500 font-sans">Price triggers</div>
                  </div>
                </div>
                {unacknowledgedAlertsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                    {unacknowledgedAlertsCount}
                  </span>
                )}
              </button>

              {/* Data Quality & Validation Lab */}
              <button
                onClick={() => handleItemClick('data_quality')}
                className={`col-span-2 p-3 rounded-xl border flex items-center justify-between transition-all text-left ${
                  activeTab === 'data_quality'
                    ? 'bg-blue-950/40 border-blue-500/50 text-blue-300 font-bold'
                    : 'bg-[#080d16] border-[#182338] text-slate-300 active:bg-[#121c2e]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Radio className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-xs">Data Quality & Telemetry</div>
                    <div className="text-[10px] text-slate-500 font-sans">
                      Exchange feeds, latency & freshness monitors
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* SECTION 3: THEME & DISPLAY PREFERENCES */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Display & Theme
            </div>
            <ThemeToggle variant="segmented" className="w-full" />
          </div>

          {/* SECTION 4: ACCOUNT / PROFILE */}
          <div className="pt-2 border-t border-[#182338]">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Account & Security
            </div>
            {user ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleItemClick('account')}
                  className="w-full p-3 rounded-xl bg-[#080d16] hover:bg-[#0f1726] border border-[#182338] hover:border-cyan-500/50 flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover border border-cyan-500/40 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                        {user.name || user.email}
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono">
                        <span>@{user.username || 'analyst'}</span>
                        <span>•</span>
                        <span className="text-cyan-400 font-bold uppercase">
                          {user.role === 'admin'
                            ? 'Admin'
                            : user.trialStatus === 'ACTIVE' && user.trialEndsAt && user.trialEndsAt > Date.now()
                            ? 'PRO TRIAL'
                            : user.isPro || user.tier === 'PRO'
                            ? 'PRO'
                            : 'FREE'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 flex-shrink-0" />
                </button>
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => handleItemClick('account')}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <span>Manage Profile, Security & Sessions</span>
                  </button>
                  <button
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="px-2 py-1 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 text-[10px] flex items-center space-x-1 hover:bg-rose-900/60"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-md text-center"
              >
                Sign In / Register
              </button>
            )}
          </div>

          {/* SECTION 5: ADMIN DASHBOARD (Accessible to Authorized Admin Users Only) */}
          {user?.role === 'admin' && (
            <div className="pt-1">
              <button
                onClick={() => handleItemClick('admin')}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                  activeTab === 'admin'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300 font-bold'
                    : 'bg-amber-950/20 border-amber-600/40 text-amber-400'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-bold text-xs flex items-center space-x-1.5">
                      <span>Admin Console & Validation Lab</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                        ADMIN
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Telemetry, algorithms, ad quotas & rules
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
