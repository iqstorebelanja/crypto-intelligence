import React, { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Compass,
  ExternalLink,
  Filter,
  Layers,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
  CheckCircle2,
  X
} from 'lucide-react';
import { Notification, User } from '../types';
import { clientNotificationService } from '../services/notificationService';

interface NotificationCenterProps {
  user: User | null;
  token: string | null;
  onNavigate: (path: string) => void;
  onOpenUpgradeModal?: (context?: string) => void;
}

type FilterCategoryGroup = 'all' | 'unread' | 'signals' | 'whale' | 'risk' | 'system';

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  user,
  token,
  onNavigate,
  onOpenUpgradeModal
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterCategoryGroup>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userTimeZone, setUserTimeZone] = useState<string>('UTC');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      setUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      setUserTimeZone('UTC');
    }
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await clientNotificationService.getNotifications(token, {
        categoryGroup: activeFilter === 'unread' ? undefined : activeFilter,
        unreadOnly: activeFilter === 'unread'
      });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // keep existing
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [token, activeFilter]);

  const handleMarkRead = async (id: string, currentRead: boolean) => {
    const success = await clientNotificationService.markRead(token, id, !currentRead);
    if (success) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: !currentRead } : n))
      );
      setUnreadCount(prev => (!currentRead ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const handleMarkAllRead = async () => {
    const success = await clientNotificationService.markAllRead(token);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      setStatusMessage('All notifications marked as read.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await clientNotificationService.deleteNotification(token, id);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const filteredNotifications = useMemo(() => {
    let result = notifications;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        n =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.symbol && n.symbol.toLowerCase().includes(q)) ||
          (n.exchange && n.exchange.toLowerCase().includes(q))
      );
    }
    return result;
  }, [notifications, searchQuery]);

  const formatTimestamp = (ts: number): string => {
    try {
      const date = new Date(ts);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: userTimeZone,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    } catch {
      return new Date(ts).toISOString();
    }
  };

  const getCategoryIcon = (category: string, severity: string) => {
    const cat = category.toUpperCase();
    if (cat.includes('SIGNAL') || cat.includes('BREAKOUT') || cat.includes('BREAKDOWN')) {
      return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
    if (cat.includes('WHALE')) {
      return <Waves className="w-4 h-4 text-indigo-400" />;
    }
    if (cat.includes('RISK') || cat.includes('LIQUIDATION')) {
      return <ShieldAlert className="w-4 h-4 text-rose-400" />;
    }
    if (cat.includes('ORDER_FLOW') || cat.includes('CVD')) {
      return <Compass className="w-4 h-4 text-cyan-400" />;
    }
    if (severity === 'CRITICAL') {
      return <Zap className="w-4 h-4 text-rose-400" />;
    }
    return <Bell className="w-4 h-4 text-slate-400" />;
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-950/80 text-rose-300 border-rose-600/60 animate-pulse';
      case 'HIGH':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/60';
      case 'MEDIUM':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 font-mono text-xs space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#18263e] pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-950/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  NOTIFICATION CENTER
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500 text-slate-950">
                    {unreadCount > 99 ? '99+' : unreadCount} Unread
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Real-time alert delivery logs and event stream across market engines.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] border border-[#27354f] text-slate-300 hover:text-white font-bold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-1.5"
            title="Mark all notifications as read"
          >
            <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mark All Read</span>
          </button>

          <button
            type="button"
            onClick={loadNotifications}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] border border-[#27354f] text-slate-300 hover:text-white font-bold transition-all flex items-center space-x-1.5"
            title="Refresh stream"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-600/40 text-cyan-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#0a1120] border border-[#18263e] rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sub-Tabs / Category Filter */}
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread (${unreadCount})` },
                { id: 'signals', label: 'Signals' },
                { id: 'whale', label: 'Whales' },
                { id: 'risk', label: 'Risk & Liq' },
                { id: 'system', label: 'System' }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  activeFilter === tab.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search symbol, exchange..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#060b13] border border-[#1b2b46] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-[#131e33]">
          <span>
            Displaying {filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}
          </span>
          <span className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Timezone: {userTimeZone}</span>
          </span>
        </div>
      </div>

      {/* Notifications List */}
      {isLoading && notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-[#0a1120] border border-[#18263e] rounded-2xl text-slate-400 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          <span>Synchronizing notification stream...</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-[#0a1120] border border-[#18263e] rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#111c30] border border-[#1e2f4e] flex items-center justify-center text-slate-500">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">No Notifications in this View</h3>
          <p className="text-xs text-slate-400 max-w-sm font-sans">
            Alerts triggered by Signal Engine, Whale Radar, or Custom Thresholds will appear here with instant deep links.
          </p>
          <button
            onClick={() => onNavigate('/alerts')}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all active:scale-95"
          >
            Configure Alert Rules →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all ${
                !item.read
                  ? 'bg-[#0d1628] border-cyan-500/40 shadow-lg shadow-cyan-950/20'
                  : 'bg-[#0a1120] border-[#18263e] hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className="p-2 rounded-xl bg-[#111d33] border border-[#1d2d4d] shrink-0 mt-0.5">
                    {getCategoryIcon(String(item.category), item.severity)}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block mr-1" />
                      )}
                      {item.symbol && (
                        <span className="font-bold text-white text-xs">{item.symbol}</span>
                      )}
                      {item.exchange && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#111f36] border border-[#213559] text-cyan-300 font-bold">
                          {item.exchange}
                        </span>
                      )}
                      {item.timeframe && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold">
                          {item.timeframe}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${getSeverityBadgeClass(item.severity)}`}>
                        {item.severity}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100">{item.title}</h4>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      {item.message}
                    </p>

                    {item.snapshot?.triggerPrice && (
                      <div className="text-[11px] text-slate-400 pt-1">
                        Trigger Price:{' '}
                        <span className="text-cyan-300 font-bold">
                          ${item.snapshot.triggerPrice.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                  {item.deepLink && (
                    <button
                      type="button"
                      onClick={() => onNavigate(item.deepLink!)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-600/40 text-cyan-300 hover:text-white font-bold transition-all active:scale-95 flex items-center space-x-1"
                      title="Inspect relevant context"
                    >
                      <span>Inspect</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleMarkRead(item.id, item.read)}
                    className="p-1.5 rounded-lg bg-[#0e1726] hover:bg-[#1a2842] border border-[#1c2c47] text-slate-400 hover:text-white transition-all"
                    title={item.read ? 'Mark as Unread' : 'Mark as Read'}
                  >
                    <Check className={`w-3.5 h-3.5 ${item.read ? 'text-slate-500' : 'text-cyan-400'}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg bg-[#0e1726] hover:bg-rose-950/40 border border-[#1c2c47] hover:border-rose-700/50 text-slate-400 hover:text-rose-400 transition-all"
                    title="Delete notification"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
