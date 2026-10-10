import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
  X
} from 'lucide-react';
import {
  Alert,
  AlertConditionType,
  AlertEvent,
  AlertEventStatus,
  AlertSeverity,
  ExchangeId,
  NormalizedCoinData,
  UnifiedAlert,
  UnifiedAlertCategory,
  User,
  UserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES
} from '../types';
import { soundAlert, SoundChimeType } from '../utils/audioAlert';

interface AlertsManagerProps {
  user: User | null;
  coins: NormalizedCoinData[];
  onOpenAuth: () => void;
  onSelectCoin: (coin: NormalizedCoinData | string) => void;
  prefillSymbol?: string | null;
  onClosePrefill?: () => void;
  onOpenUpgradeModal?: (context?: string) => void;
}

type AlertViewTab = 'feed' | 'rules' | 'preferences';
type CategoryFilterGroup = 'all' | 'signals' | 'whale' | 'risk' | 'technical' | 'orderFlow' | 'health';

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  user,
  coins,
  onOpenAuth,
  onSelectCoin,
  prefillSymbol,
  onClosePrefill,
  onOpenUpgradeModal
}) => {
  // Navigation & Sub-tabs
  const [activeView, setActiveView] = useState<AlertViewTab>('feed');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterGroup>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExchange, setSelectedExchange] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Data states
  const [events, setEvents] = useState<UnifiedAlert[]>([]);
  const [customRules, setCustomRules] = useState<Alert[]>([]);
  const [preferences, setPreferences] = useState<UserNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modals
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(Boolean(prefillSymbol));
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(() => soundAlert.isSoundEnabled());
  const [soundVolume, setSoundVolume] = useState(() => soundAlert.getVolume());
  const [soundChime, setSoundChime] = useState<SoundChimeType>(() => soundAlert.getChimeStyle());

  // Browser Push permission state
  const [pushPermission, setPushPermission] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });

  // Telegram test state
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isTestingAlert, setIsTestingAlert] = useState(false);

  // Form states for creating custom rule
  const [formSymbol, setFormSymbol] = useState(prefillSymbol || 'BTC/USDT');
  const [formExchange, setFormExchange] = useState<ExchangeId>('BINANCE');
  const [formCondition, setFormCondition] = useState<AlertConditionType>('PRICE_ABOVE');
  const [formTarget, setFormTarget] = useState<string>('');
  const [formRecurring, setFormRecurring] = useState<boolean>(true);
  const [formCooldown, setFormCooldown] = useState<number>(15);
  const [formNotes, setFormNotes] = useState<string>('');
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);
  const [ruleModalError, setRuleModalError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Show status banner notification
  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4500);
  };

  // Fetch Unified Alert Events
  const fetchAlertEvents = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('categoryGroup', categoryFilter);
      if (selectedExchange !== 'ALL') params.set('exchange', selectedExchange);
      if (searchQuery.trim()) params.set('symbol', searchQuery.trim());
      if (selectedSeverity !== 'ALL') params.set('severity', selectedSeverity);
      if (unreadOnly) params.set('unreadOnly', 'true');

      const res = await fetch(`/api/alerts/events?${params.toString()}`, { headers });
      if (res.ok) {
        const data: UnifiedAlert[] = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.warn('Error fetching unified alert events:', err);
    }
  }, [categoryFilter, selectedExchange, searchQuery, selectedSeverity, unreadOnly, token]);

  // Fetch Custom Watch Rules
  const fetchCustomRules = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts', { headers });
      if (res.ok) {
        const data = await res.json();
        setCustomRules(data);
      }
    } catch {
      // Ignored
    }
  }, [token]);

  // Fetch User Notification Preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/notifications/preferences', { headers });
      if (res.ok) {
        const data: UserNotificationPreferences = await res.json();
        setPreferences(data);
        if (data.soundEnabled !== undefined) setSoundEnabled(data.soundEnabled);
        if (data.soundVolume !== undefined) setSoundVolume(data.soundVolume);
        if (data.soundChime) setSoundChime(data.soundChime);
      }
    } catch {
      // Ignored
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchAlertEvents(), fetchCustomRules(), fetchPreferences()]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchAlertEvents, fetchCustomRules, fetchPreferences]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchAlertEvents(), fetchCustomRules()]);
    setIsRefreshing(false);
    showFeedback('Alert stream refreshed', 'info');
  };

  // Sound Quick Toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundAlert.setSoundEnabled(next);
    if (next) {
      soundAlert.testSound(soundChime, soundVolume);
    }
    // Update preferences in background
    fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ soundEnabled: next })
    }).catch(() => {});
  };

  // Trigger Instant Test Alert
  const handleTriggerTestAlert = async (cat?: UnifiedAlertCategory) => {
    setIsTestingAlert(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({ category: cat || 'Bull Signal' })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.alert) {
          setEvents(prev => [data.alert, ...prev]);
          if (soundEnabled) {
            soundAlert.playAlertChime(data.alert.severity, soundChime, soundVolume);
          }
          showFeedback(`Test alert dispatched: ${data.alert.title}`, 'success');
        }
      }
    } catch (err) {
      showFeedback(`Test alert error: ${(err as Error).message}`, 'error');
    } finally {
      setIsTestingAlert(false);
    }
  };

  // Mark single alert as read
  const handleMarkRead = async (alertId: string, currentRead: boolean) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/events/${alertId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ read: !currentRead })
      });

      if (res.ok) {
        setEvents(prev =>
          prev.map(ev => (ev.id === alertId ? { ...ev, read: !currentRead } : ev))
        );
      }
    } catch {
      // Ignored
    }
  };

  // Update Alert Event Status (Acknowledge / Dismiss)
  const handleUpdateStatus = async (alertId: string, status: AlertEventStatus) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/events/${alertId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        setEvents(prev =>
          prev.map(ev =>
            ev.id === alertId ? { ...ev, status, read: true } : ev
          )
        );
        showFeedback(status === 'ACKNOWLEDGED' ? 'Alert acknowledged' : 'Alert dismissed', 'info');
      }
    } catch {
      // Ignored
    }
  };

  // Mark all alerts as read
  const handleMarkAllRead = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts/events/mark-all-read', {
        method: 'POST',
        headers
      });

      if (res.ok) {
        setEvents(prev => prev.map(ev => ({ ...ev, read: true })));
        showFeedback('All alerts marked as read', 'success');
      }
    } catch {
      // Ignored
    }
  };

  // Acknowledge all alerts
  const handleAcknowledgeAll = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts/events/acknowledge-all', {
        method: 'POST',
        headers
      });

      if (res.ok) {
        setEvents(prev =>
          prev.map(ev => ({ ...ev, status: 'ACKNOWLEDGED', read: true }))
        );
        showFeedback('All alerts acknowledged', 'success');
      }
    } catch {
      // Ignored
    }
  };

  // Clear dismissed alerts
  const handleClearDismissed = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts/events/clear', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode: 'dismissed' })
      });

      if (res.ok) {
        setEvents(prev => prev.filter(ev => ev.status !== 'DISMISSED'));
        showFeedback('Cleared dismissed alerts', 'info');
      }
    } catch {
      // Ignored
    }
  };

  // Save Preferences
  const handleSavePreferences = async (updated: Partial<UserNotificationPreferences>) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const merged = { ...preferences, ...updated };
      setPreferences(merged);

      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated)
      });

      if (res.ok) {
        const saved = await res.json();
        setPreferences(saved);
        showFeedback('Notification preferences updated successfully', 'success');
      }
    } catch (err) {
      showFeedback(`Failed to save preferences: ${(err as Error).message}`, 'error');
    }
  };

  // Request browser push notification permission
  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showFeedback('Browser push notifications not supported in this browser', 'error');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted') {
        new Notification('Crypto Intelligence AI', {
          body: 'Push notifications successfully activated for market alerts.',
          icon: '/favicon.ico'
        });
        handleSavePreferences({ browserPushEnabled: true });
        showFeedback('Push notifications activated!', 'success');
      } else {
        showFeedback('Push notification permission denied by browser', 'error');
      }
    } catch (err) {
      showFeedback(`Permission error: ${(err as Error).message}`, 'error');
    }
  };

  // Test Telegram connection
  const handleTestTelegram = async () => {
    if (!preferences.telegramBotToken || !preferences.telegramChatId) {
      showFeedback('Please provide both Bot Token and Chat ID to test', 'error');
      return;
    }
    setIsTestingTelegram(true);
    try {
      const res = await fetch('/api/notifications/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: preferences.telegramBotToken,
          chatId: preferences.telegramChatId
        })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Telegram connection test passed! Check your Telegram chat.', 'success');
      } else {
        showFeedback(`Telegram test failed: ${data.message || 'Check Bot Token/Chat ID'}`, 'error');
      }
    } catch (err) {
      showFeedback(`Telegram error: ${(err as Error).message}`, 'error');
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // Create Custom Rule Submit
  const handleCreateRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setRuleModalError('Network offline — reconnecting... Alert creation is temporarily paused.');
      return;
    }
    if (!user) {
      onOpenAuth();
      return;
    }

    setIsSubmittingRule(true);
    setRuleModalError(null);
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
        setCustomRules(prev => [created, ...prev]);
        setShowCreateRuleModal(false);
        setFormNotes('');
        setRuleModalError(null);
        showFeedback(`Watch alert rule created for ${formSymbol}`, 'success');
        if (onClosePrefill) onClosePrefill();
      } else {
        const err = await res.json();
        const msg = err.code === 'PRO_REQUIRED' || err.error?.includes('PRO')
          ? 'Advanced Alerts are available with PRO.'
          : (err.error || 'Failed to create rule');
        setRuleModalError(msg);
        showFeedback(msg, 'error');
      }
    } catch (err) {
      const msg = `Error creating rule: ${(err as Error).message}`;
      setRuleModalError(msg);
      showFeedback(msg, 'error');
    } finally {
      setIsSubmittingRule(false);
    }
  };

  // Toggle Custom Rule Active
  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/${ruleId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: !currentActive })
      });

      if (res.ok) {
        setCustomRules(prev =>
          prev.map(r => (r.id === ruleId ? { ...r, isActive: !currentActive } : r))
        );
        showFeedback(currentActive ? 'Alert paused' : 'Alert resumed', 'info');
      }
    } catch {
      // Ignored
    }
  };

  // Delete Custom Rule
  const handleDeleteRule = async (ruleId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/${ruleId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setCustomRules(prev => prev.filter(r => r.id !== ruleId));
        showFeedback('Alert rule deleted', 'info');
      }
    } catch {
      // Ignored
    }
  };

  // Categorized counts for tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilterGroup, number> = {
      all: events.length,
      signals: 0,
      whale: 0,
      risk: 0,
      technical: 0,
      orderFlow: 0,
      health: 0
    };

    for (const ev of events) {
      const cat = ev.category;
      if (['Bull Signal', 'Bearish Signal', 'Breakout', 'Breakdown', 'Retest'].includes(cat)) {
        counts.signals++;
      } else if (['Whale Activity', 'Large Exchange Deposit', 'Large Exchange Withdrawal'].includes(cat)) {
        counts.whale++;
      } else if (['Downside Risk threshold', 'Liquidation', 'BTC Market Condition'].includes(cat)) {
        counts.risk++;
      } else if (['Bull Score threshold', 'RSI', 'Volume Spike', 'Open Interest', 'Funding', 'Market Structure'].includes(cat)) {
        counts.technical++;
      } else if (['Order Flow', 'CVD Divergence'].includes(cat)) {
        counts.orderFlow++;
      } else if (cat === 'Data/Exchange health') {
        counts.health++;
      }
    }

    return counts;
  }, [events]);

  const unreadCount = useMemo(() => {
    return events.filter(e => !e.read).length;
  }, [events]);

  // Relative Time Formatter
  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour === 1) return '1 hour ago';
    if (diffHour < 24) return `${diffHour} hours ago`;
    if (diffDay === 1) return '1 day ago';
    return `${diffDay} days ago`;
  };

  // Render Category Indicator Dot / Icon
  const renderCategoryIcon = (category: UnifiedAlertCategory, severity: AlertSeverity) => {
    switch (category) {
      case 'Bull Signal':
      case 'Breakout':
        return <span className="text-emerald-400 text-sm">🟢</span>;
      case 'Bearish Signal':
      case 'Breakdown':
      case 'Downside Risk threshold':
        return <span className="text-rose-400 text-sm">🔴</span>;
      case 'Whale Activity':
      case 'Large Exchange Deposit':
      case 'Large Exchange Withdrawal':
        return <span className="text-cyan-400 text-sm">🐋</span>;
      case 'Liquidation':
        return <span className="text-purple-400 text-sm">🟣</span>;
      case 'Order Flow':
      case 'CVD Divergence':
        return <span className="text-amber-400 text-sm">⚡</span>;
      case 'Data/Exchange health':
        return <span className="text-blue-400 text-sm">🛡️</span>;
      default:
        return severity === 'CRITICAL' ? (
          <span className="text-rose-400 text-sm">🔴</span>
        ) : (
          <span className="text-amber-400 text-sm">🟡</span>
        );
    }
  };

  return (
    <div className="space-y-5 font-mono">
      {/* Toast Feedback Notification */}
      {statusMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl border shadow-xl flex items-center space-x-2 text-xs backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <Bell className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TOP HEADER: UNIFIED ALERT CENTER */}
      <div className="p-4 sm:p-5 bg-[#090e18] border border-[#172338] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-black/20">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  UNIFIED ALERT CENTER
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                    {unreadCount} UNREAD
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time notification engine across Signals, Whales, Risk, Liquidations, and Technical indicators
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Quick Sound Chime Toggle */}
          <button
            onClick={toggleSound}
            className={`px-3 py-1.5 rounded-xl border text-xs flex items-center space-x-1.5 transition-all ${
              soundEnabled
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle audio alert chime"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
          </button>

          {/* Quick Trigger Test Alert */}
          <button
            onClick={() => handleTriggerTestAlert()}
            disabled={isTestingAlert}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs flex items-center space-x-1.5 transition-all active:scale-95"
            title="Fire immediate simulated alert to verify sound and notification flow"
          >
            <Play className={`w-3 h-3 text-cyan-400 ${isTestingAlert ? 'animate-spin' : ''}`} />
            <span>Test Alert</span>
          </button>

          {/* Refresh Stream */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white transition-colors"
            title="Refresh alert feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Preferences Button */}
          <button
            onClick={() => {
              fetchPreferences();
              setActiveView('preferences');
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs flex items-center space-x-1.5 transition-all ${
              activeView === 'preferences'
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Preferences</span>
          </button>

          {/* Create Alert Rule Button */}
          <button
            onClick={() => setShowCreateRuleModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-cyan-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>CREATE RULE</span>
          </button>
        </div>
      </div>

      {/* VIEW SWITCHER TABS: Alert Feed | My Watch Rules | Notification Preferences */}
      <div className="flex items-center justify-between border-b border-[#182338] pb-1 overflow-x-auto">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => setActiveView('feed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              activeView === 'feed'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>ALERTS FEED</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px]">
              {events.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('rules')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              activeView === 'rules'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>MY WATCH RULES</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
              {customRules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('preferences')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              activeView === 'preferences'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>PREFERENCES</span>
          </button>
        </div>

        {activeView === 'feed' && events.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 px-2.5 py-1 rounded-lg hover:bg-cyan-950/40 transition-colors"
            >
              Mark all read
            </button>
            <button
              onClick={handleAcknowledgeAll}
              className="text-[11px] text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Acknowledge all
            </button>
            <button
              onClick={handleClearDismissed}
              className="text-[11px] text-slate-500 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-950/20 transition-colors"
              title="Clear dismissed alerts"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: UNIFIED ALERTS FEED */}
      {activeView === 'feed' && (
        <div className="space-y-4">
          {/* CATEGORY FILTER PILLS (per prompt: [ All ] [ Signals ] [ Whale ] [ Risk ] [ Technical ] etc.) */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            {[
              { id: 'all', label: 'All', count: categoryCounts.all },
              { id: 'signals', label: 'Signals', count: categoryCounts.signals },
              { id: 'whale', label: 'Whale', count: categoryCounts.whale },
              { id: 'risk', label: 'Risk', count: categoryCounts.risk },
              { id: 'technical', label: 'Technical', count: categoryCounts.technical },
              { id: 'orderFlow', label: 'Order Flow', count: categoryCounts.orderFlow },
              { id: 'health', label: 'Health', count: categoryCounts.health }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id as CategoryFilterGroup)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center space-x-1.5 transition-all select-none ${
                  categoryFilter === tab.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                    : 'bg-[#0a0f1c] border border-[#162238] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    categoryFilter === tab.id
                      ? 'bg-cyan-950 text-cyan-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* SECONDARY FILTER & SEARCH BAR */}
          <div className="p-3 bg-[#0a0f1b] border border-[#17243c] rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5 flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search symbol (e.g. BTC, ETH) or keyword..."
                className="w-full bg-transparent border-none text-white placeholder-slate-500 outline-none text-xs"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2.5 flex-wrap">
              {/* Exchange Filter */}
              <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                <span>Exchange:</span>
                <select
                  value={selectedExchange}
                  onChange={e => setSelectedExchange(e.target.value)}
                  className="bg-[#101726] border border-[#1e2c45] text-slate-200 rounded-lg px-2 py-1 outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Exchanges</option>
                  <option value="BINANCE">Binance</option>
                  <option value="OKX">OKX</option>
                  <option value="BYBIT">Bybit</option>
                  <option value="KRAKEN">Kraken</option>
                  <option value="GATE">Gate</option>
                  <option value="PIONEX">Pionex</option>
                </select>
              </div>

              {/* Severity Filter */}
              <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                <span>Severity:</span>
                <select
                  value={selectedSeverity}
                  onChange={e => setSelectedSeverity(e.target.value)}
                  className="bg-[#101726] border border-[#1e2c45] text-slate-200 rounded-lg px-2 py-1 outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {/* Unread Only Toggle */}
              <button
                onClick={() => setUnreadOnly(!unreadOnly)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center space-x-1.5 transition-colors ${
                  unreadOnly
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 font-bold'
                    : 'bg-[#101726] border-[#1e2c45] text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Unread only</span>
                {unreadOnly && <Check className="w-3 h-3 text-rose-400" />}
              </button>
            </div>
          </div>

          {/* ALERT LIST / FEED */}
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-cyan-400" />
              <p className="text-xs">Connecting to unified alert stream...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#090d18] border border-[#141f32] text-center space-y-3">
              <Bell className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">No alerts match current filters</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No market alerts matching this category or exchange have been triggered yet.
              </p>
              <div className="flex items-center justify-center space-x-2 pt-2">
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setSelectedExchange('ALL');
                    setSelectedSeverity('ALL');
                    setSearchQuery('');
                    setUnreadOnly(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Reset Filters
                </button>
                <button
                  onClick={() => handleTriggerTestAlert()}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold"
                >
                  Trigger Sample Alert
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(ev => {
                const targetCoin = coins.find(
                  c => c.symbol.toUpperCase() === ev.symbol.toUpperCase() ||
                       c.symbol.replace('/', '').toUpperCase() === ev.symbol.replace('/', '').toUpperCase()
                );

                return (
                  <div
                    key={ev.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      !ev.read
                        ? 'bg-[#0a1120] border-[#1f3050] shadow-md shadow-cyan-950/20'
                        : 'bg-[#080d18] border-[#141d2e] opacity-90 hover:opacity-100'
                    }`}
                  >
                    {/* Header Row: Symbol, Category Icon, Exchange, Timeframe, Timestamp */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Prompt layout: [Category Icon] [Symbol] [Exchange • Timeframe] [Relative Time] */}
                        <div className="flex items-center space-x-2 flex-wrap text-xs">
                          {/* Colored category indicator dot / icon */}
                          {renderCategoryIcon(ev.category, ev.severity)}

                          {/* Symbol */}
                          <span
                            onClick={() => onSelectCoin(targetCoin || ev.symbol)}
                            className="font-bold text-white text-sm hover:text-cyan-400 cursor-pointer transition-colors"
                          >
                            {ev.symbol}
                          </span>

                          {/* Exchange badge */}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#121c2e] text-slate-300 border border-[#1e2e48]">
                            {ev.exchange || 'BINANCE'}
                          </span>

                          {/* Timeframe if available */}
                          {ev.timeframe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                              {ev.timeframe}
                            </span>
                          )}

                          {/* Severity badge */}
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                              ev.severity === 'CRITICAL'
                                ? 'bg-rose-950/80 border-rose-600/50 text-rose-300'
                                : ev.severity === 'HIGH'
                                ? 'bg-amber-950/80 border-amber-600/50 text-amber-300'
                                : ev.severity === 'MEDIUM'
                                ? 'bg-cyan-950/80 border-cyan-600/50 text-cyan-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {ev.severity}
                          </span>

                          {/* Unread indicator */}
                          {!ev.read && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title="Unread" />
                          )}
                        </div>

                        {/* Prompt layout headline: Title */}
                        <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                          {ev.title}
                        </h3>

                        {/* Prompt layout message */}
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">
                          {ev.message}
                        </p>

                        {/* Evidence Chips / Metric Row */}
                        {ev.evidence && ev.evidence.length > 0 && (
                          <div className="flex items-center space-x-2 flex-wrap pt-1 gap-y-1">
                            {ev.evidence.map((item, idx) => (
                              <div
                                key={idx}
                                className="text-[11px] px-2 py-0.5 rounded-lg bg-[#0e1728] border border-[#1c2c47] text-slate-300 flex items-center space-x-1"
                              >
                                <span className="text-slate-400">{item.label}:</span>
                                <span className="font-bold text-white">{item.value}</span>
                              </div>
                            ))}
                            {ev.modelVersion && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Model: {ev.modelVersion}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right column: Relative timestamp and action buttons */}
                      <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                        <span
                          className="text-[11px] text-slate-400 font-mono"
                          title={new Date(ev.timestamp).toLocaleString()}
                        >
                          {formatRelativeTime(ev.timestamp)}
                        </span>

                        <div className="flex items-center space-x-1.5">
                          {/* Inspect Coin */}
                          <button
                            onClick={() => onSelectCoin(targetCoin || ev.symbol)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center space-x-1 transition-colors"
                            title="Inspect Coin Chart & Details"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3 text-cyan-400" />
                          </button>

                          {/* Acknowledge / Mark Read */}
                          {ev.status === 'TRIGGERED' ? (
                            <button
                              onClick={() => handleUpdateStatus(ev.id, 'ACKNOWLEDGED')}
                              className="px-2 py-1 rounded-lg border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50 text-[11px] transition-colors"
                              title="Acknowledge alert"
                            >
                              Ack
                            </button>
                          ) : (
                            <button
                              onClick={() => handleMarkRead(ev.id, ev.read)}
                              className="p-1 rounded-lg text-slate-500 hover:text-slate-300"
                              title={ev.read ? 'Mark unread' : 'Mark read'}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Dismiss */}
                          <button
                            onClick={() => handleUpdateStatus(ev.id, 'DISMISSED')}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                            title="Dismiss alert"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MY WATCH RULES */}
      {activeView === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Configured Market Watch Rules
              </h2>
              <p className="text-xs text-slate-400">
                Server-side condition monitors evaluating live order books, price action, and quantitative scores
              </p>
            </div>
            <button
              onClick={() => setShowCreateRuleModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-cyan-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD RULE</span>
            </button>
          </div>

          {customRules.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[#090d18] border border-[#141f32] text-center space-y-3">
              <Sliders className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">No custom watch rules created yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Set custom price levels, RSI thresholds, Bull Score minimums, or breakout conditions to receive proactive alerts.
              </p>
              <button
                onClick={() => setShowCreateRuleModal(true)}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold"
              >
                + Create Your First Rule
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customRules.map(rule => {
                const targetCoin = coins.find(c => c.symbol === rule.symbol);
                return (
                  <div
                    key={rule.id}
                    className={`p-4 rounded-xl border transition-all ${
                      rule.isActive
                        ? 'bg-[#090f1b] border-[#18263e]'
                        : 'bg-[#070b13]/60 border-[#121a28] opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            onClick={() => targetCoin && onSelectCoin(targetCoin)}
                            className="font-bold text-white hover:text-cyan-400 cursor-pointer"
                          >
                            {rule.symbol}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#131d2f] text-slate-400 border border-slate-700/50">
                            {rule.exchange || 'BINANCE'}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                              rule.isActive
                                ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                                : 'bg-slate-900 border-slate-700 text-slate-500'
                            }`}
                          >
                            {rule.isActive ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>

                        <div className="text-xs text-cyan-300 font-bold">
                          {rule.conditionType.replace(/_/g, ' ')}
                          {(rule.targetValue != null || rule.threshold != null) && (
                            <span className="text-white ml-1">
                              {rule.conditionType.includes('PRICE') && rule.targetValue != null
                                ? `$${rule.targetValue.toLocaleString()}`
                                : String(rule.targetValue ?? rule.threshold ?? '')}
                            </span>
                          )}
                        </div>

                        {rule.notes && (
                          <div className="text-[11px] text-slate-400 font-sans">
                            Note: {rule.notes}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 pt-1 flex items-center space-x-3">
                          <span>Cooldown: {rule.cooldownMinutes}m</span>
                          {targetCoin && (
                            <span>Current: ${targetCoin.price.toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleToggleRule(rule.id, Boolean(rule.isActive))}
                          className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                            rule.isActive
                              ? 'border-slate-700 text-slate-400 hover:text-amber-400'
                              : 'border-cyan-700/50 text-cyan-400 hover:bg-cyan-950/40'
                          }`}
                        >
                          {rule.isActive ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-colors"
                          title="Delete rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: NOTIFICATION PREFERENCES */}
      {activeView === 'preferences' && (
        <div className="p-5 bg-[#090e18] border border-[#172338] rounded-2xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Settings className="w-4 h-4 text-purple-400" />
              <span>USER NOTIFICATION PREFERENCES</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure alert dispatch channels, audio chime synthesizers, minimum severity filters, and quiet hours.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* COLUMN 1: DELIVERY CHANNELS */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                1. Delivery Channels
              </h3>

              {/* Sound Audio Alerts */}
              <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1a2942] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Audio Alert Chimes</div>
                      <div className="text-[11px] text-slate-400 font-sans">
                        Web Audio API synthesized tonal alerts
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.soundEnabled}
                    onChange={e => {
                      const enabled = e.target.checked;
                      setSoundEnabled(enabled);
                      soundAlert.setSoundEnabled(enabled);
                      handleSavePreferences({ soundEnabled: enabled });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {preferences.soundEnabled && (
                  <div className="space-y-2.5 pt-2 border-t border-[#16233a] text-xs">
                    {/* Style selector */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Chime Profile:</span>
                      <div className="flex items-center space-x-1">
                        {(['chime', 'radar', 'ping', 'pulse'] as SoundChimeType[]).map(style => (
                          <button
                            key={style}
                            onClick={() => {
                              setSoundChime(style);
                              soundAlert.setChimeStyle(style);
                              soundAlert.testSound(style, soundVolume);
                              handleSavePreferences({ soundChime: style });
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border transition-colors ${
                              soundChime === style
                                ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Volume Slider */}
                    <div className="flex items-center justify-between space-x-3">
                      <span className="text-slate-400">Volume ({soundVolume}%):</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={soundVolume}
                        onChange={e => {
                          const vol = parseInt(e.target.value);
                          setSoundVolume(vol);
                          soundAlert.setVolume(vol);
                        }}
                        onMouseUp={() => handleSavePreferences({ soundVolume })}
                        onTouchEnd={() => handleSavePreferences({ soundVolume })}
                        className="w-36 accent-cyan-500 cursor-pointer"
                      />
                      <button
                        onClick={() => soundAlert.testSound(soundChime, soundVolume)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-400 font-bold"
                        title="Preview audio tone"
                      >
                        Play
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Web / Browser Push Notifications */}
              <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1a2942] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Radio className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Browser Push Notifications</div>
                      <div className="text-[11px] text-slate-400 font-sans">
                        Desktop & mobile system notifications
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.browserPushEnabled}
                    onChange={e => {
                      if (e.target.checked && pushPermission !== 'granted') {
                        handleRequestPushPermission();
                      } else {
                        handleSavePreferences({ browserPushEnabled: e.target.checked });
                      }
                    }}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                </div>

                {pushPermission !== 'granted' && (
                  <button
                    onClick={handleRequestPushPermission}
                    className="w-full py-1.5 rounded-lg bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs font-bold hover:bg-blue-900/60 transition-colors"
                  >
                    Request Browser Permission
                  </button>
                )}
              </div>

              {/* Telegram Bot Notification Bridge */}
              <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1a2942] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Send className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Telegram Alert Bot</div>
                      <div className="text-[11px] text-slate-400 font-sans">
                        Receive instant alerts directly in Telegram
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.telegramEnabled}
                    onChange={e => handleSavePreferences({ telegramEnabled: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-[#16233a] text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Bot Token</label>
                    <input
                      type="password"
                      value={preferences.telegramBotToken || ''}
                      onChange={e => setPreferences(p => ({ ...p, telegramBotToken: e.target.value }))}
                      onBlur={() => handleSavePreferences({ telegramBotToken: preferences.telegramBotToken })}
                      placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="w-full bg-[#101726] border border-[#1e2a40] rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Chat ID</label>
                    <input
                      type="text"
                      value={preferences.telegramChatId || ''}
                      onChange={e => setPreferences(p => ({ ...p, telegramChatId: e.target.value }))}
                      onBlur={() => handleSavePreferences({ telegramChatId: preferences.telegramChatId })}
                      placeholder="e.g. 987654321"
                      className="w-full bg-[#101726] border border-[#1e2a40] rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    onClick={handleTestTelegram}
                    disabled={isTestingTelegram}
                    className="px-3 py-1.5 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300 text-xs font-bold hover:bg-sky-900/60 transition-colors flex items-center space-x-1.5"
                  >
                    <Send className={`w-3 h-3 ${isTestingTelegram ? 'animate-spin' : ''}`} />
                    <span>Send Test Telegram Ping</span>
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMN 2: FILTERS, QUIET HOURS & RATE LIMITS */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                2. Categories & Filtering Rules
              </h3>

              {/* Minimum Severity Filter */}
              <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1a2942] space-y-2">
                <label className="block text-xs font-bold text-white">Minimum Severity Filter</label>
                <p className="text-[11px] text-slate-400 font-sans">
                  Alerts with severity lower than this threshold will be muted
                </p>
                <select
                  value={preferences.minSeverity}
                  onChange={e => handleSavePreferences({ minSeverity: e.target.value as AlertSeverity })}
                  className="w-full bg-[#101726] border border-[#1e2a40] text-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-500"
                >
                  <option value="LOW">LOW (All alerts pass through)</option>
                  <option value="MEDIUM">MEDIUM (Moderate and high alerts only)</option>
                  <option value="HIGH">HIGH (High conviction & strong triggers only)</option>
                  <option value="CRITICAL">CRITICAL (Liquidations & extreme events only)</option>
                </select>
              </div>

              {/* Category Toggles */}
              <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1a2942] space-y-3">
                <div className="text-xs font-bold text-white">Enabled Alert Categories</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'signals', label: 'Signals & Breakouts' },
                    { key: 'whale', label: 'Whale Movements' },
                    { key: 'risk', label: 'Downside Risk' },
                    { key: 'technical', label: 'Technical & RSI' },
                    { key: 'orderFlow', label: 'Order Flow & CVD' },
                    { key: 'health', label: 'Exchange Feed Health' }
                  ].map(cat => (
                    <label
                      key={cat.key}
                      className="flex items-center space-x-2 p-2 rounded-lg bg-[#0e1626] border border-[#162238] cursor-pointer hover:border-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(preferences.categoryFilters[cat.key as keyof typeof preferences.categoryFilters])}
                        onChange={e => {
                          const updated = {
                            ...preferences.categoryFilters,
                            [cat.key]: e.target.checked
                          };
                          handleSavePreferences({ categoryFilters: updated });
                        }}
                        className="w-3.5 h-3.5 accent-cyan-500 rounded"
                      />
                      <span className="text-[11px] text-slate-300 font-sans">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1a2942] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Quiet Hours</div>
                    <div className="text-[11px] text-slate-400 font-sans">
                      Mute non-critical alerts during specified time window
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.quietHoursEnabled}
                    onChange={e => handleSavePreferences({ quietHoursEnabled: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {preferences.quietHoursEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={preferences.quietHoursStart}
                        onChange={e => handleSavePreferences({ quietHoursStart: e.target.value })}
                        className="w-full bg-[#101726] border border-[#1e2a40] rounded-lg px-2.5 py-1.5 text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">End Time</label>
                      <input
                        type="time"
                        value={preferences.quietHoursEnd}
                        onChange={e => handleSavePreferences({ quietHoursEnd: e.target.value })}
                        className="w-full bg-[#101726] border border-[#1e2a40] rounded-lg px-2.5 py-1.5 text-white outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CUSTOM ALERT RULE */}
      {showCreateRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0c121e] border border-[#1e2c45] rounded-3xl p-5 sm:p-6 shadow-2xl font-mono text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-[#182338] pb-3">
              <div className="flex items-center space-x-2 text-cyan-400">
                <Bell className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">CREATE WATCH ALERT RULE</h3>
              </div>
              <button
                onClick={() => {
                  setShowCreateRuleModal(false);
                  if (onClosePrefill) onClosePrefill();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {ruleModalError && (
              <div className="mb-4 p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold">{ruleModalError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenUpgradeModal) onOpenUpgradeModal('Advanced Analytical Alerts');
                    else window.location.href = '/pricing';
                  }}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-[11px] font-bold shadow-sm transition-all active:scale-95"
                >
                  Upgrade to PRO
                </button>
              </div>
            )}

            <form onSubmit={handleCreateRuleSubmit} className="space-y-3.5 text-xs">
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
                    <option value="BYBIT">Bybit (Perpetuals)</option>
                    <option value="OKX">OKX</option>
                    <option value="KRAKEN">Kraken</option>
                    <option value="GATE">Gate.io</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Condition Trigger</label>
                <select
                  value={formCondition}
                  onChange={e => setFormCondition(e.target.value as AlertConditionType)}
                  className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="PRICE_ABOVE">Price Rises Above Target ($)</option>
                  <option value="PRICE_BELOW">Price Drops Below Target ($)</option>
                  <option value="RSI_ABOVE">RSI(14) Crosses Above (e.g. 70)</option>
                  <option value="RSI_BELOW">RSI(14) Crosses Below (e.g. 30)</option>
                  <option value="BULL_SCORE_ABOVE">Bull Score Reaches Target (e.g. 75)</option>
                  <option value="DOWNSIDE_RISK_ABOVE">Downside Risk Exceeds Target (e.g. 65)</option>
                  <option value="BREAKOUT_DETECTED">Market Structure Breakout</option>
                  <option value="BREAKDOWN_DETECTED">Market Structure Breakdown</option>
                  <option value="OI_SPIKE">Open Interest Surge (&gt;= X%)</option>
                </select>
              </div>

              {!['BREAKOUT_DETECTED', 'BREAKDOWN_DETECTED'].includes(formCondition) && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {formCondition.includes('PRICE')
                      ? 'Target Price ($ USD)'
                      : formCondition.includes('RSI')
                      ? 'RSI Threshold (0-100)'
                      : 'Score Threshold (0-100)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formTarget}
                    onChange={e => setFormTarget(e.target.value)}
                    placeholder="Enter threshold value..."
                    className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="formRecurring"
                    checked={formRecurring}
                    onChange={e => setFormRecurring(e.target.checked)}
                    className="rounded bg-[#111928] border-[#1e2a40] text-cyan-500"
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

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Notes / Plan (Optional)</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. Look for retest confirmation on 15m..."
                  className="w-full bg-[#111928] border border-[#1e2a40] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#182338]">
                <button
                  type="button"
                  onClick={() => setShowCreateRuleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRule}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all"
                >
                  {isSubmittingRule ? 'Saving Rule...' : 'Save Watch Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
