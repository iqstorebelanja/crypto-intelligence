import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Radio,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import { GlobalAlertAdminConfig } from '../../types';

interface AdminAlertsConfigProps {
  token: string | null;
}

export const AdminAlertsConfig: React.FC<AdminAlertsConfigProps> = ({ token }) => {
  const [config, setConfig] = useState<GlobalAlertAdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [maxAlertsPerUser, setMaxAlertsPerUser] = useState<number>(20);
  const [minAlertCooldownMinutes, setMinAlertCooldownMinutes] = useState<number>(5);
  const [maxNotificationsPerHour, setMaxNotificationsPerHour] = useState<number>(60);
  const [maxTelegramMessagesPerHour, setMaxTelegramMessagesPerHour] = useState<number>(30);
  const [systemWideAlertsEnabled, setSystemWideAlertsEnabled] = useState<boolean>(true);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/alerts/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch alert engine config');
      const json: GlobalAlertAdminConfig = await res.json();
      setConfig(json);
      setMaxAlertsPerUser(json.maxAlertsPerUser);
      setMinAlertCooldownMinutes(json.minAlertCooldownMinutes);
      setMaxNotificationsPerHour(json.maxNotificationsPerHour);
      setMaxTelegramMessagesPerHour(json.maxTelegramMessagesPerHour);
      setSystemWideAlertsEnabled(json.systemWideAlertsEnabled);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMsg(null);
      const res = await fetch('/api/admin/alerts/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          maxAlertsPerUser,
          minAlertCooldownMinutes,
          maxNotificationsPerHour,
          maxTelegramMessagesPerHour,
          systemWideAlertsEnabled
        })
      });
      if (!res.ok) throw new Error('Failed to update alert engine config');
      setMsg('Global alert parameters updated and active across engine');
      setTimeout(() => setMsg(null), 4000);
      fetchConfig();
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
        Loading global alert engine configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-xs max-w-4xl">
      <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#182338] pb-3">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Global Alert Dispatcher & Rate Safeguards</h3>
          </div>
          {msg && (
            <span className="text-[11px] text-emerald-400 font-bold">{msg}</span>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Master Kill Switch */}
          <div className="p-4 bg-[#090e18] border border-[#162236] rounded-lg flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 font-bold text-white text-xs">
                <Radio className={`w-4 h-4 ${systemWideAlertsEnabled ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
                <span>System-Wide Alert Engine Dispatch</span>
              </div>
              <p className="text-[11px] text-slate-400">
                When disabled, all scheduled alert condition evaluations and notification dispatches (in-app and Telegram) are immediately paused.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSystemWideAlertsEnabled(!systemWideAlertsEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                systemWideAlertsEnabled
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900'
                  : 'bg-rose-950/80 text-rose-300 border-rose-600/60 hover:bg-rose-900'
              }`}
            >
              {systemWideAlertsEnabled ? 'SYSTEM ACTIVE' : 'PAUSED (MUTED)'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>MAX ALERTS PER USER ACCOUNT</span>
                <span className="text-cyan-300 font-bold">{maxAlertsPerUser} rules</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxAlertsPerUser}
                onChange={(e) => setMaxAlertsPerUser(parseInt(e.target.value) || 20)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">Maximum concurrent active alerts any individual account may configure.</p>
            </div>

            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>MINIMUM ALERT COOLDOWN (MINUTES)</span>
                <span className="text-cyan-300 font-bold">{minAlertCooldownMinutes} mins</span>
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={minAlertCooldownMinutes}
                onChange={(e) => setMinAlertCooldownMinutes(parseInt(e.target.value) || 5)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">Minimum quiet window enforced between repeated triggers of the same alert rule.</p>
            </div>

            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>MAX IN-APP NOTIFICATIONS / HOUR</span>
                <span className="text-cyan-300 font-bold">{maxNotificationsPerHour}/hr</span>
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={maxNotificationsPerHour}
                onChange={(e) => setMaxNotificationsPerHour(parseInt(e.target.value) || 60)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">Throttling ceiling to prevent notification flood in fast market conditions.</p>
            </div>

            <div className="p-3 bg-[#090e18] border border-[#162236] rounded-lg space-y-1.5">
              <label className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>MAX TELEGRAM DISPATCHES / HOUR</span>
                <span className="text-cyan-300 font-bold">{maxTelegramMessagesPerHour}/hr</span>
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={maxTelegramMessagesPerHour}
                onChange={(e) => setMaxTelegramMessagesPerHour(parseInt(e.target.value) || 30)}
                className="w-full bg-[#0d1424] border border-[#21304a] rounded px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500">Guards against Telegram Bot API rate limits (HTTP 429 Too Many Requests).</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Global Alert Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
