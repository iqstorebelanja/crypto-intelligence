import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Bell,
  Bot,
  Cpu,
  FileText,
  Lock,
  Radio,
  Server,
  Shield,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Users
} from 'lucide-react';
import { User } from '../../types';
import { AdminSystemHealth } from './AdminSystemHealth';
import { AdminScoringConfig } from './AdminScoringConfig';
import { AdminScannerSymbols } from './AdminScannerSymbols';
import { AdminAlertsConfig } from './AdminAlertsConfig';
import { AdminAiMonitor } from './AdminAiMonitor';
import { AdminUserManagement } from './AdminUserManagement';
import { AdminLogsAudit } from './AdminLogsAudit';
import { AdminValidationLab } from './AdminValidationLab';
import { AdminMarketDataEngine } from './AdminMarketDataEngine';
import { AdminSignalEngine } from './AdminSignalEngine';

export type AdminTab =
  | 'health'
  | 'market-engine'
  | 'signal-engine'
  | 'scoring'
  | 'validation'
  | 'scanner'
  | 'alerts'
  | 'ai'
  | 'users'
  | 'logs';

interface AdminDashboardProps {
  user: User | null;
  token: string | null;
  onSwitchToDemoAdmin?: () => void;
  initialTab?: AdminTab;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  token,
  onSwitchToDemoAdmin,
  initialTab = 'health'
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  const isAdmin = user && user.role === 'admin';

  if (!user || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-[#0d1424] border border-[#1d2b42] rounded-2xl font-mono text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-950/60 border border-rose-700/60 flex items-center justify-center text-rose-400">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white tracking-wider">
            ADMINISTRATIVE ACCESS REQUIRED
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The Production Hardening, System Health, and Engine Calibration console is restricted
            to authenticated users with the <span className="text-amber-400 font-bold">admin</span> role.
          </p>
        </div>

        <div className="p-4 bg-[#080d16] border border-[#152033] rounded-xl text-left text-xs space-y-1.5 text-slate-400">
          <div className="flex justify-between">
            <span>Current Account:</span>
            <span className="text-white font-bold">{user ? user.email : 'Unauthenticated (Guest)'}</span>
          </div>
          <div className="flex justify-between">
            <span>Assigned Role:</span>
            <span className="text-rose-400 font-bold">{user ? user.role.toUpperCase() : 'NONE'}</span>
          </div>
          <div className="flex justify-between">
            <span>Server Authorization:</span>
            <span className="text-rose-400 font-bold">REJECTED (HTTP 403)</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/score')}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#141d2e] hover:bg-[#1a253a] border border-[#23334e] text-slate-300 text-xs font-bold transition-all"
          >
            Return to Market Radar
          </button>

          {onSwitchToDemoAdmin && (
            <button
              onClick={onSwitchToDemoAdmin}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all"
            >
              Sign In as Demo Admin (admin@cryptointelligence.ai)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Admin Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#0b101c] border border-[#182338] rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white tracking-wider">
                ADMIN CONSOLE & TELEMETRY
              </h1>
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40 text-[10px] font-bold">
                PHASE 4A PRODUCTION
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              System monitoring, scoring engine versioning, market parameters, and audit trails.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/score')}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#121927] hover:bg-[#192336] border border-[#1f2b42] text-slate-300 text-xs font-bold transition-all self-start sm:self-center"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to Radar</span>
        </button>
      </div>

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar border-b border-[#182338] pb-2 text-xs">
        <button
          onClick={() => setActiveTab('health')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'health'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          <span>System Health & Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('market-engine')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'market-engine'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="flex items-center gap-1.5">
            Market Data Engine
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50 font-bold">
              P6
            </span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('signal-engine')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'signal-engine'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-amber-400" />
          <span className="flex items-center gap-1.5">
            Signal Intelligence Engine
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50 font-bold">
              P7
            </span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('scoring')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'scoring'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Scoring Engine Calibration</span>
        </button>

        <button
          onClick={() => setActiveTab('validation')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'validation'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="flex items-center gap-1.5">
            Validation Lab
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50 font-bold">
              P5
            </span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'scanner'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-purple-400" />
          <span>Scanner & Managed Symbols</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'alerts'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <span>Global Alert Dispatcher</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'ai'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Telemetry & Errors</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'users'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm shadow-sky-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-sky-400" />
          <span>User Directory & RBAC</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
            activeTab === 'logs'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-rose-400" />
          <span>Logs & Audit Trail</span>
        </button>
      </div>

      {/* Render Active Submodule */}
      {activeTab === 'health' && <AdminSystemHealth token={token} />}
      {activeTab === 'market-engine' && <AdminMarketDataEngine token={token} />}
      {activeTab === 'signal-engine' && <AdminSignalEngine token={token} />}
      {activeTab === 'scoring' && <AdminScoringConfig token={token} />}
      {activeTab === 'validation' && <AdminValidationLab token={token} />}
      {activeTab === 'scanner' && <AdminScannerSymbols token={token} />}
      {activeTab === 'alerts' && <AdminAlertsConfig token={token} />}
      {activeTab === 'ai' && <AdminAiMonitor token={token} />}
      {activeTab === 'users' && <AdminUserManagement token={token} currentUserId={user.id} />}
      {activeTab === 'logs' && <AdminLogsAudit token={token} />}
    </div>
  );
};
