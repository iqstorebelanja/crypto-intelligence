import {
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Send,
  Sliders,
  Trash2,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Alert, AlertConditionType, AlertEvent, ExchangeId, NormalizedCoinData, User } from '../types';
import { soundAlert } from '../utils/audioAlert';

interface AlertsManagerProps {
  user: User | null;
  coins: NormalizedCoinData[];
  onOpenAuth: () => void;
  onSelectCoin: (coin: NormalizedCoinData) => void;
  prefillSymbol?: string | null;
  onClosePrefill?: () => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  user,
  coins,
  onOpenAuth,
  onSelectCoin,
  prefillSymbol,
  onClosePrefill
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(Boolean(prefillSymbol));
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  // Telegram states
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState<string | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  // Form states
  const [formSymbol, setFormSymbol] = useState(prefillSymbol || 'BTC/USDT');
  const [formExchange, setFormExchange] = useState<ExchangeId>('BINANCE');
  const [formCondition, setFormCondition] = useState<AlertConditionType>('PRICE_ABOVE');
  const [formTarget, setFormTarget] = useState<string>('');
  const [formRecurring, setFormRecurring] = useState<boolean>(true);
  const [formCooldown, setFormCooldown] = useState<number>(15);
  const [formNotes, setFormNotes] = useState<string>('');

  const token = localStorage.getItem('auth_token');

  const fetchTelegramConfig = async () => {
    try {
      const res = await fetch('/api/notifications/telegram/config');
      if (res.ok) {
        const data = await res.json();
        setTelegramEnabled(Boolean(data.enabled));
        setTelegramConfigured(Boolean(data.isConfigured));
        if (data.chatId) setTelegramChatId(data.chatId);
      }
    } catch {
      // Ignore
    }
  };

  const saveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramStatusMsg(null);
    try {
      const res = await fetch('/api/notifications/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramBotToken || undefined,
          chatId: telegramChatId,
          enabled: telegramEnabled
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTelegramConfigured(data.isConfigured);
        setTelegramEnabled(data.enabled);
        setTelegramStatusMsg('Telegram settings successfully saved!');
        setTimeout(() => setTelegramStatusMsg(null), 4000);
      } else {
        const err = await res.json();
        setTelegramStatusMsg(`Error: ${err.error || 'Failed to save'}`);
      }
    } catch (err) {
      setTelegramStatusMsg(`Error: ${(err as Error).message}`);
    }
  };

  const testTelegramNotification = async () => {
    setIsTestingTelegram(true);
    setTelegramStatusMsg(null);
    try {
      const res = await fetch('/api/notifications/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramBotToken || undefined,
          chatId: telegramChatId || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setTelegramStatusMsg('Test alert dispatched to Telegram successfully!');
      } else {
        setTelegramStatusMsg(`Test failed: ${data.message || 'Check Token and Chat ID'}`);
      }
    } catch (err) {
      setTelegramStatusMsg(`Test failed: ${(err as Error).message}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const fetchAlertsAndEvents = async () => {
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [alertsRes, eventsRes] = await Promise.all([
        fetch('/api/alerts', { headers }),
        fetch('/api/alerts/events', { headers })
      ]);

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data);
      }
      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setEvents(evData);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsAndEvents();
  }, [user]);

  useEffect(() => {
    if (prefillSymbol) {
      setFormSymbol(prefillSymbol);
      setShowCreateModal(true);
      const matched = coins.find(c => c.symbol === prefillSymbol);
      if (matched && !formTarget) {
        setFormTarget(matched.price.toString());
      }
    }
  }, [prefillSymbol, coins]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundAlert.setSoundEnabled(next);
    if (next) soundAlert.playAlertChime();
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          symbol: formSymbol,
          exchange: formExchange,
          timeframe: '1h',
          conditionType: formCondition,
          targetValue: formTarget !== '' ? parseFloat(formTarget) : undefined,
          isRecurring: formRecurring,
          cooldownMinutes: formCooldown,
          notes: formNotes
        })
      });

      if (res.ok) {
        const created = await res.json();
        setAlerts(prev => [created, ...prev]);
        setShowCreateModal(false);
        setFormNotes('');
        if (onClosePrefill) onClosePrefill();
      }
    } catch (err) {
      console.error('Error creating alert:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAlert = async (alertId: string, currentActive: boolean) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: !currentActive })
      });

      if (res.ok) {
        setAlerts(prev =>
          prev.map(a => (a.id === alertId ? { ...a, isActive: !currentActive } : a))
        );
      }
    } catch (err) {
      console.error('Error updating alert:', err);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (err) {
      console.error('Error deleting alert:', err);
    }
  };

  const handleUpdateEventStatus = async (eventId: string, status: 'ACKNOWLEDGED' | 'DISMISSED') => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/events/${eventId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        setEvents(prev =>
          prev.map(ev => (ev.id === eventId ? { ...ev, status } : ev))
        );
      }
    } catch (err) {
      console.error('Error updating event:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Strip */}
      <div className="p-4 bg-[#0a0f1a] border border-[#1a263c] rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                PRICE & QUANTITATIVE ALERTS ENGINE
              </h2>
              <p className="text-xs text-slate-400">
                Server-side condition monitoring across Price, RSI, Bull Score, Market Structure, and Open Interest
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Telegram Bot Config Button */}
          <button
            onClick={() => {
              fetchTelegramConfig();
              setShowTelegramModal(true);
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center space-x-1.5 transition-colors ${
              telegramConfigured && telegramEnabled
                ? 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Configure Telegram Bot Notifications"
          >
            <Send className="w-3.5 h-3.5 text-blue-400" />
            <span>Telegram {telegramConfigured && telegramEnabled ? 'Active' : 'Setup'}</span>
          </button>

          {/* Sound toggle */}
          <button
            onClick={toggleSound}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center space-x-2 transition-colors ${
              soundEnabled
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title="Toggle alert sound chime"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
          </button>

          <button
            onClick={fetchAlertsAndEvents}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono flex items-center space-x-1.5 shadow-lg shadow-cyan-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE ALERT</span>
          </button>
        </div>
      </div>

      {/* Grid: Active Alerts (Left) + Triggered History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Alerts */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <span>Configured Watch Alerts</span>
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px]">
                {alerts.length}
              </span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Evaluated every market scan</span>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#090d16] border border-[#141e30] text-center space-y-3">
              <Bell className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">No active alerts configured</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Set price, RSI, structural breakout, or open interest triggers to be informed when market conditions shift.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-mono font-bold"
              >
                + Create Your First Alert
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {alerts.map(alert => {
                const targetCoin = coins.find(c => c.symbol === alert.symbol);
                return (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      alert.isActive
                        ? 'bg-[#090f1b] border-[#18263e] hover:border-cyan-500/40'
                        : 'bg-[#070b13]/60 border-[#121a28] opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            onClick={() => targetCoin && onSelectCoin(targetCoin)}
                            className="font-mono font-bold text-white hover:text-cyan-400 cursor-pointer"
                          >
                            {alert.symbol}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#131d2f] text-slate-400 border border-slate-700/50">
                            {alert.exchange || 'BINANCE'}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              alert.isActive
                                ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                                : 'bg-slate-900 border-slate-700 text-slate-500'
                            }`}
                          >
                            {alert.isActive ? 'ACTIVE' : 'PAUSED'}
                          </span>
                          {alert.isRecurring && (
                            <span className="text-[10px] font-mono text-cyan-400">● Recurring</span>
                          )}
                        </div>

                        <div className="text-xs font-mono text-cyan-300 font-semibold flex items-center space-x-1.5 flex-wrap">
                          <span>{alert.conditionType.replace(/_/g, ' ')}</span>
                          {alert.percentThreshold != null && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-[10px]">
                              {alert.direction === 'DOWN' ? '-' : alert.direction === 'ANY' ? '±' : '+'}{alert.percentThreshold}%
                            </span>
                          )}
                          {(alert.targetValue != null || alert.threshold != null) && (
                            <span className="text-white">
                              {alert.conditionType.includes('PRICE') && alert.targetValue != null
                                ? `$${alert.targetValue.toLocaleString()}`
                                : String(alert.targetValue ?? alert.threshold ?? '')}
                            </span>
                          )}
                        </div>

                        {alert.notes && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            Note: {alert.notes}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-3 pt-1">
                          <span>Cooldown: {alert.cooldownMinutes}m</span>
                          {alert.lastTriggeredAt && (
                            <span>
                              Last triggered: {new Date(alert.lastTriggeredAt).toLocaleTimeString()}
                            </span>
                          )}
                          {targetCoin && (
                            <span className="text-slate-400">
                              Current Price: ${targetCoin.price.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleAlert(alert.id, Boolean(alert.isActive ?? alert.enabled))}
                          className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                            (alert.isActive ?? alert.enabled)
                              ? 'border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400/50'
                              : 'border-cyan-700/50 text-cyan-400 hover:bg-cyan-950/40'
                          }`}
                        >
                          {(alert.isActive ?? alert.enabled) ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Delete Alert"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Triggered Alert Events History */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <span>Alert Events History</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                {events.length}
              </span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Live Triggers</span>
          </div>

          {events.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#090d16] border border-[#141e30] text-center space-y-2 text-xs text-slate-500 font-mono">
              <Clock className="w-6 h-6 text-slate-600 mx-auto" />
              <div>No alert events triggered recently.</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {events.map(ev => {
                const targetCoin = coins.find(c => c.symbol === ev.symbol);
                return (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-[#0b101c] border border-[#172236] space-y-2 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          onClick={() => targetCoin && onSelectCoin(targetCoin)}
                          className="font-bold text-white hover:text-cyan-400 cursor-pointer"
                        >
                          {ev.symbol}
                        </span>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                          {ev.exchange}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border ${
                            ev.status === 'TRIGGERED'
                              ? 'bg-rose-950/60 border-rose-600/50 text-rose-300'
                              : ev.status === 'ACKNOWLEDGED'
                              ? 'bg-cyan-950/60 border-cyan-600/50 text-cyan-300'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          {ev.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(ev.timestamp || ev.triggeredAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {ev.conditionDescription || ev.message || ev.condition}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-[#131b2b] pt-1.5">
                      <span>
                        Trigger: {ev.triggerPrice != null ? `$${ev.triggerPrice.toLocaleString()}` : String(ev.actualValue ?? '—')}
                      </span>
                      <div className="flex items-center space-x-2">
                        {ev.status === 'TRIGGERED' && (
                          <button
                            onClick={() => handleUpdateEventStatus(ev.id, 'ACKNOWLEDGED')}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateEventStatus(ev.id, 'DISMISSED')}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Alert */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0c121e] border border-[#1e2c45] rounded-3xl p-5 sm:p-6 shadow-2xl font-mono text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-[#182338] pb-3">
              <div className="flex items-center space-x-2 text-cyan-400">
                <Bell className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">CONFIGURE MARKET ALERT</h3>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  if (onClosePrefill) onClosePrefill();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-3.5 text-xs">
              {/* Symbol & Exchange */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Pair / Symbol</label>
                  <select
                    value={formSymbol}
                    onChange={e => {
                      setFormSymbol(e.target.value);
                      const matched = coins.find(c => c.symbol === e.target.value);
                      if (matched) setFormTarget(matched.price.toString());
                    }}
                    className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                  >
                    {coins.map(c => (
                      <option key={c.symbol} value={c.symbol}>
                        {c.symbol} (${c.price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Exchange Source</label>
                  <select
                    value={formExchange}
                    onChange={e => setFormExchange(e.target.value as ExchangeId)}
                    className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="BINANCE">Binance (Spot & Futures)</option>
                    <option value="BYBIT">Bybit (Linear Perpetual)</option>
                  </select>
                </div>
              </div>

              {/* Condition Type */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Condition Trigger</label>
                <select
                  value={formCondition}
                  onChange={e => setFormCondition(e.target.value as AlertConditionType)}
                  className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="PRICE_ABOVE">Price Rises Above Target ($)</option>
                  <option value="PRICE_BELOW">Price Drops Below Target ($)</option>
                  <option value="RSI_ABOVE">RSI (14) Crosses Above (e.g. 70)</option>
                  <option value="RSI_BELOW">RSI (14) Crosses Below (e.g. 30)</option>
                  <option value="BULL_SCORE_ABOVE">Bull Score Reaches Target (e.g. 75)</option>
                  <option value="BULL_SCORE_BELOW">Bull Score Slips Below Target (e.g. 40)</option>
                  <option value="DOWNSIDE_RISK_ABOVE">Downside Risk Exceeds Target (e.g. 65)</option>
                  <option value="BREAKOUT_DETECTED">Market Structure Breakout Detected</option>
                  <option value="BREAKDOWN_DETECTED">Market Structure Breakdown Detected</option>
                  <option value="RETEST_DETECTED">Structure Support/Resistance Retest</option>
                  <option value="OI_SPIKE">Open Interest 24h Surge (&gt;= X%)</option>
                  <option value="FUNDING_FLIP">Funding Rate Expansion / Flip</option>
                </select>
              </div>

              {/* Target Value if applicable */}
              {!['BREAKOUT_DETECTED', 'BREAKDOWN_DETECTED', 'RETEST_DETECTED', 'FUNDING_FLIP'].includes(formCondition) && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {formCondition.includes('PRICE')
                      ? 'Target Price ($ USD)'
                      : formCondition.includes('RSI')
                      ? 'RSI Threshold (0-100)'
                      : formCondition.includes('SCORE') || formCondition.includes('RISK')
                      ? 'Score Threshold (0-100)'
                      : 'Threshold Value (%)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formTarget}
                    onChange={e => setFormTarget(e.target.value)}
                    placeholder="Enter target threshold..."
                    className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    required
                  />
                </div>
              )}

              {/* Recurring & Cooldown */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="formRecurring"
                    checked={formRecurring}
                    onChange={e => setFormRecurring(e.target.checked)}
                    className="rounded bg-[#111928] border-[#1e2a40] text-cyan-500 focus:ring-0"
                  />
                  <label htmlFor="formRecurring" className="text-[11px] text-slate-300">
                    Recurring Trigger
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Cooldown (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={formCooldown}
                    onChange={e => setFormCooldown(parseInt(e.target.value) || 15)}
                    className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-1.5 text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. Watch for key retest or daily close"
                  className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-lg shadow-cyan-600/20"
                >
                  {isSubmitting ? 'Saving...' : 'Save Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Telegram Notifications Configuration Modal (Phase 3) */}
      {showTelegramModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c121e] border border-blue-900/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#1b253b] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">TELEGRAM ALERTS DISPATCHER</h3>
                  <p className="text-[11px] text-slate-400">Instant real-time mobile push notifications when market rules trigger</p>
                </div>
              </div>
              <button
                onClick={() => setShowTelegramModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveTelegramConfig} className="space-y-3.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#080d16] border border-[#1b253b]">
                <div>
                  <span className="font-bold text-white block">Telegram Dispatch Active</span>
                  <span className="text-[11px] text-slate-400">Send triggered alerts directly to your Telegram chat</span>
                </div>
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={e => setTelegramEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Telegram Bot Token:</label>
                <input
                  type="password"
                  value={telegramBotToken}
                  onChange={e => setTelegramBotToken(e.target.value)}
                  placeholder={telegramConfigured ? '••••••••••••••••••••••••' : 'e.g. 123456789:ABCDefgh-ijKLMNopqrSTUvwxyz'}
                  className="w-full bg-[#080d16] border border-[#1b253b] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Create a bot via @BotFather on Telegram to obtain an HTTP API token.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Telegram Chat ID / Channel ID:</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value)}
                  placeholder="e.g. 987654321 or -100123456789"
                  className="w-full bg-[#080d16] border border-[#1b253b] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Your Telegram user ID or group chat ID (find yours via @userinfobot or @RawDataBot).
                </span>
              </div>

              {telegramStatusMsg && (
                <div className={`p-2.5 rounded-xl text-[11px] border ${
                  telegramStatusMsg.startsWith('Error') || telegramStatusMsg.startsWith('Test failed')
                    ? 'bg-rose-950/40 border-rose-800/40 text-rose-300'
                    : 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                }`}>
                  {telegramStatusMsg}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#1b253b]">
                <button
                  type="button"
                  onClick={testTelegramNotification}
                  disabled={isTestingTelegram}
                  className="px-3 py-1.5 rounded-xl bg-[#080d16] border border-blue-500/40 text-blue-300 hover:bg-blue-950/40 font-semibold disabled:opacity-50 transition-all flex items-center space-x-1.5"
                >
                  <Send className="w-3 h-3" />
                  <span>{isTestingTelegram ? 'Sending Test...' : 'Send Test Notification'}</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowTelegramModal(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-600/20"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
