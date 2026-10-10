import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  UserX,
  VolumeX,
  Flag,
  Play,
  Sparkles,
  Bot,
  Zap,
  RotateCcw
} from 'lucide-react';
import { ModerationReport, DailyCleanupStatus, TestResult } from '../../types';

interface AdminCommunityModerationProps {
  token: string | null;
}

export const AdminCommunityModeration: React.FC<AdminCommunityModerationProps> = ({ token }) => {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [cleanupStatus, setCleanupStatus] = useState<DailyCleanupStatus | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState<boolean>(true);
  const [isTriggeringCleanup, setIsTriggeringCleanup] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<{
    moderationRequestsToday: number;
    moderationTokensToday: number;
    estimatedCostUsd: number;
    ruleInterceptionsCount: number;
  }>({
    moderationRequestsToday: 0,
    moderationTokensToday: 0,
    estimatedCostUsd: 0,
    ruleInterceptionsCount: 0
  });

  // Automated Phase 9 Engine Tests State
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<{
    totalTests: number;
    passedCount: number;
    failedCount: number;
    allPassed: boolean;
    results: TestResult[];
  } | null>(null);

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const fetchModerationData = useCallback(async () => {
    if (!token) return;
    setIsLoadingReports(true);
    try {
      const res = await fetch('/api/community/admin/reports', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        if (data.dailyCleanupStatus) setCleanupStatus(data.dailyCleanupStatus);
        if (data.telemetry) setTelemetry(data.telemetry);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingReports(false);
    }
  }, [token]);

  useEffect(() => {
    fetchModerationData();
  }, [fetchModerationData]);

  // Trigger Manual Daily Cleanup (Idempotent)
  const handleTriggerCleanup = async () => {
    if (!token) return;
    setIsTriggeringCleanup(true);
    try {
      const res = await fetch('/api/community/admin/trigger-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ force: true })
      });
      if (res.ok) {
        const data = await res.json();
        setCleanupStatus(data.cleanupResult);
        setActionSuccessMessage(`Daily cleanup completed: ${data.cleanupResult.deletedMessagesCount} messages purged.`);
        setTimeout(() => setActionSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTriggeringCleanup(false);
    }
  };

  // Run Phase 9 Test Suite
  const handleRunPhase9Tests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/admin/phase9/tests');
      if (res.ok) {
        const json = await res.json();
        setTestResults(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Perform moderation action on a report
  const handleReportAction = async (
    reportId: string,
    action: 'HIDE' | 'RESTORE' | 'WARN' | 'MUTE' | 'BAN' | 'DISMISS',
    durationMinutes?: number
  ) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/community/admin/reports/${reportId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, durationMinutes, notes: `Admin manual action: ${action}` })
      });
      if (res.ok) {
        setActionSuccessMessage(`Action '${action}' successfully executed.`);
        setTimeout(() => setActionSuccessMessage(null), 3000);
        fetchModerationData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredReports = reports.filter(r => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'RESOLVED') return r.status === 'ACTIONED' || (r.status as string) === 'RESOLVED';
    return r.status === activeFilter;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Success banner */}
      {actionSuccessMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccessMessage}</span>
          </div>
        </div>
      )}

      {/* Row 1: Daily Ephemeral Cleanup & AI Moderation Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A: Ephemeral Cleanup Partition Monitor */}
        <div className="p-4 bg-[#0b101b] border border-[#1b253b] rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-400 font-bold">
              <Clock className="w-4 h-4" />
              <span className="uppercase tracking-wider">00:00 UTC Ephemeral Partition</span>
            </div>
            <button
              onClick={handleTriggerCleanup}
              disabled={isTriggeringCleanup}
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-all"
            >
              <RotateCcw className={`w-3 h-3 ${isTriggeringCleanup ? 'animate-spin' : ''}`} />
              <span>Trigger Cleanup</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#070b12] p-2.5 rounded-xl border border-[#182338]">
              <span className="text-slate-500 block mb-0.5">Active Partition</span>
              <span className="text-slate-200 font-bold text-sm">
                {cleanupStatus?.currentDayKey || 'UTC LIVE'}
              </span>
            </div>
            <div className="bg-[#070b12] p-2.5 rounded-xl border border-[#182338]">
              <span className="text-slate-500 block mb-0.5">Last Run Status</span>
              <span className="text-emerald-400 font-bold text-sm flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{cleanupStatus?.status || 'IDLE'}</span>
              </span>
            </div>
            <div className="bg-[#070b12] p-2.5 rounded-xl border border-[#182338]">
              <span className="text-slate-500 block mb-0.5">Purged Messages</span>
              <span className="text-cyan-300 font-bold text-sm">
                {cleanupStatus?.deletedMessagesCount ?? 0}
              </span>
            </div>
            <div className="bg-[#070b12] p-2.5 rounded-xl border border-[#182338]">
              <span className="text-slate-500 block mb-0.5">Server Policy</span>
              <span className="text-slate-300 font-bold text-xs">
                00:00 UTC Daily (Server-Side)
              </span>
            </div>
          </div>
        </div>

        {/* Card B: AI Moderation Assistant Telemetry (Separated from AI Trader) */}
        <div className="p-4 bg-[#0b101b] border border-[#1b253b] rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-cyan-400 font-bold">
              <Bot className="w-4 h-4" />
              <span className="uppercase tracking-wider">AI Moderation Assistant</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
              Zero User Quota Impact
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#070b12] p-2.5 rounded-xl border border-[#182338]">
              <span className="text-slate-500 block mb-0.5">Rule Interceptions (0 AI Cost)</span>
              <span className="text-emerald-400 font-bold text-sm">
                {telemetry.ruleInterceptionsCount} Intercepted
              </span>
            </div>
            <div className="bg-[#070b12] p-2.5 rounded-xl border border-[#182338]">
              <span className="text-slate-500 block mb-0.5">AI Ambiguity Queries</span>
              <span className="text-cyan-300 font-bold text-sm">
                {telemetry.moderationRequestsToday} Calls
              </span>
            </div>
            <div className="bg-[#070b12] p-2.5 rounded-xl border border-[#182338]">
              <span className="text-slate-500 block mb-0.5">AI Tokens Utilized</span>
              <span className="text-indigo-300 font-bold text-sm">
                {telemetry.moderationTokensToday.toLocaleString()}
              </span>
            </div>
            <div className="bg-[#070b12] p-2.5 rounded-xl border border-[#182338]">
              <span className="text-slate-500 block mb-0.5">Estimated Daily Cost</span>
              <span className="text-amber-300 font-bold text-sm">
                ${telemetry.estimatedCostUsd.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Moderation Reports Queue */}
      <div className="p-4 bg-[#0b101b] border border-[#1b253b] rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#182338] pb-3">
          <div className="flex items-center space-x-2">
            <Flag className="w-4 h-4 text-yellow-400" />
            <h3 className="font-bold text-white uppercase tracking-wider">
              Community Moderation Queue ({filteredReports.length})
            </h3>
          </div>

          <div className="flex items-center space-x-1 bg-[#070b12] p-1 rounded-xl border border-[#182338]">
            {(['PENDING', 'RESOLVED', 'DISMISSED', 'ALL'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  activeFilter === f
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {isLoadingReports ? (
          <div className="py-8 text-center text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
            <span>Loading moderation queue...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            No reports in queue with status '{activeFilter}'.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map(report => (
              <div
                key={report.id}
                className="p-3.5 bg-[#080d16] border border-[#182338] rounded-xl space-y-3"
              >
                {/* Header: Status, reason, timestamp */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      report.status === 'PENDING'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700/50'
                        : report.status === 'ACTIONED' || (report.status as string) === 'RESOLVED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                        : 'bg-slate-900 text-slate-400 border border-slate-700/50'
                    }`}>
                      {report.status}
                    </span>
                    <span className="text-yellow-400 font-bold">{report.reason}</span>
                    <span className="text-slate-500">by @{report.reportedByUserName || (report as any).reporterUserName}</span>
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {new Date(report.createdAt).toLocaleTimeString()} UTC
                  </span>
                </div>

                {/* Message snippet */}
                <div className="p-2.5 bg-[#0c121e] border border-[#1d2b42] rounded-lg">
                  <span className="text-slate-500 text-[10px] block mb-1">
                    Reported Message (Author: @{report.reportedUserId || (report as any).targetUserName}):
                  </span>
                  <p className="font-sans text-slate-300 text-xs italic">
                    "{report.messageSnippet || (report as any).messageContent}"
                  </p>
                </div>

                {/* AI Moderation Verdict */}
                {(report.aiModerationResult || (report as any).aiVerdict) && (
                  <div className="p-2.5 bg-[#0d1424] border border-cyan-900/40 rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center space-x-2 text-cyan-300">
                      <Bot className="w-3.5 h-3.5" />
                      <span className="font-bold">AI Verdict:</span>
                      <span>{(report.aiModerationResult || (report as any).aiVerdict).category}</span>
                      <span className="text-slate-400">({(report.aiModerationResult || (report as any).aiVerdict).confidence}% confidence)</span>
                    </div>
                    <div className="text-slate-400">
                      Recommendation: <span className="text-amber-300 font-bold">{(report.aiModerationResult || (report as any).aiVerdict).recommendedAction}</span>
                    </div>
                  </div>
                )}

                {/* Admin Actions Bar */}
                {report.status === 'PENDING' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#182338]">
                    <button
                      onClick={() => handleReportAction(report.id, 'HIDE')}
                      className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg flex items-center space-x-1"
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>Hide Message</span>
                    </button>
                    <button
                      onClick={() => handleReportAction(report.id, 'WARN')}
                      className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded-lg flex items-center space-x-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Warn Author</span>
                    </button>
                    <button
                      onClick={() => handleReportAction(report.id, 'MUTE', 60)}
                      className="px-2.5 py-1 bg-orange-950/60 hover:bg-orange-900 text-orange-300 border border-orange-800/60 rounded-lg flex items-center space-x-1"
                    >
                      <VolumeX className="w-3 h-3" />
                      <span>Mute 1h</span>
                    </button>
                    <button
                      onClick={() => handleReportAction(report.id, 'BAN', 1440)}
                      className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 rounded-lg flex items-center space-x-1"
                    >
                      <UserX className="w-3 h-3" />
                      <span>Temp Ban 24h</span>
                    </button>
                    <button
                      onClick={() => handleReportAction(report.id, 'DISMISS')}
                      className="px-2.5 py-1 bg-[#121c2e] hover:bg-[#1a2942] text-slate-300 border border-[#1b253b] rounded-lg ml-auto"
                    >
                      Dismiss Report
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 3: Phase 9 Automated Test Suite Runner */}
      <div className="p-4 bg-[#0b101b] border border-[#1b253b] rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white uppercase tracking-wider">
              Phase 9 Engine Automated Verification Tests
            </h3>
          </div>

          <button
            onClick={handleRunPhase9Tests}
            disabled={isRunningTests}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-md active:scale-95 transition-all"
          >
            {isRunningTests ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Run All Phase 9 Tests</span>
          </button>
        </div>

        {testResults && (
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-[#080d16] border border-[#182338] flex items-center justify-between font-bold">
              <span className="text-slate-300">
                Test Summary: {testResults.passedCount} / {testResults.totalTests} Passed
              </span>
              <span className={testResults.allPassed ? 'text-emerald-400' : 'text-rose-400'}>
                {testResults.allPassed ? 'ALL SYSTEMS OPERATIONAL' : `${testResults.failedCount} TESTS FAILED`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto no-scrollbar">
              {testResults.results.map((res, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-[#070b12] border border-[#182338] flex items-start justify-between text-[11px]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      {res.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      )}
                      <span className="font-bold text-slate-200">{res.name}</span>
                    </div>
                    <p className="text-slate-400 text-[10px] pl-5">{res.details}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono flex-shrink-0 pl-2">
                    {res.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
