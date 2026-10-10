import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Shield,
  Send,
  Smile,
  Sparkles,
  Lock,
  AlertTriangle,
  Flag,
  Trash2,
  Edit2,
  CornerUpLeft,
  X,
  Search,
  RefreshCw,
  Clock,
  Radio,
  CheckCircle,
  TrendingUp,
  CircleDollarSign,
  Layers,
  Coins,
  Crosshair,
  Waves,
  Newspaper,
  BarChart2,
  Users,
  Info,
  Check,
  ExternalLink
} from 'lucide-react';
import {
  CommunityChannel,
  CommunityChannelId,
  CommunityMessage,
  StickerItem,
  StickerPack,
  User
} from '../types';

interface CommunityForumProps {
  user: User | null;
  onOpenAuth: () => void;
  token: string | null;
  onOpenUpgradeModal?: (context?: string) => void;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  general: <MessageSquare className="w-4 h-4 text-cyan-400" />,
  bitcoin: <CircleDollarSign className="w-4 h-4 text-amber-400" />,
  ethereum: <Layers className="w-4 h-4 text-indigo-400" />,
  altcoins: <Coins className="w-4 h-4 text-purple-400" />,
  'technical-analysis': <TrendingUp className="w-4 h-4 text-emerald-400" />,
  'trading-setup': <Crosshair className="w-4 h-4 text-rose-400" />,
  'whale-watch': <Waves className="w-4 h-4 text-blue-400" />,
  'market-news': <Newspaper className="w-4 h-4 text-yellow-400" />,
  'market-discussion': <BarChart2 className="w-4 h-4 text-teal-400" />,
  'crypto-memes': <Sparkles className="w-4 h-4 text-pink-400" />
};

const QUICK_REACTIONS = ['👍', '🚀', '🔥', '💎', '🐂', '🐻', '🎯', '⚡'];

// Malicious link protection and safe URL rendering (Phase 18)
const renderSafeMessageContent = (content: string) => {
  if (!content) return null;
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = content.split(urlRegex);

  return parts.map((part, idx) => {
    if (part.match(/^https?:\/\//i)) {
      let safeHref = part;
      try {
        const parsed = new URL(part);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return <span key={idx}>{part}</span>;
        }
        safeHref = parsed.toString();
      } catch {
        return <span key={idx}>{part}</span>;
      }

      return (
        <a
          key={idx}
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline underline-offset-2 break-all font-mono"
          title="External link — open with caution"
        >
          {part}
          <ExternalLink className="w-2.5 h-2.5 inline-block opacity-70 shrink-0" />
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
  });
};

export const CommunityForum: React.FC<CommunityForumProps> = ({
  user,
  onOpenAuth,
  token,
  onOpenUpgradeModal
}) => {
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<CommunityChannelId>('general');
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [dayKeyUTC, setDayKeyUTC] = useState<string>('');
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(true);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [replyTarget, setReplyTarget] = useState<CommunityMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<CommunityMessage | null>(null);
  const [stickerPacks, setStickerPacks] = useState<StickerPack[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CommunityMessage[] | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reporting state
  const [reportingMessage, setReportingMessage] = useState<CommunityMessage | null>(null);
  const [reportReason, setReportReason] = useState<string>('Spam');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  // PRO Entitlement state
  const [entitlement, setEntitlement] = useState<{ hasAccess: boolean; tier: string; isPro: boolean } | null>(null);
  const [isCheckingEntitlement, setIsCheckingEntitlement] = useState<boolean>(true);
  const [isTogglingPro, setIsTogglingPro] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check PRO Entitlement status
  const checkEntitlement = useCallback(async () => {
    setIsCheckingEntitlement(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/community/entitlement', { headers });
      if (res.ok) {
        const data = await res.json();
        setEntitlement(data.entitlement);
      } else {
        setEntitlement({ hasAccess: false, tier: 'FREE', isPro: false });
      }
    } catch (err) {
      setEntitlement({ hasAccess: false, tier: 'FREE', isPro: false });
    } finally {
      setIsCheckingEntitlement(false);
    }
  }, [token]);

  useEffect(() => {
    checkEntitlement();
  }, [checkEntitlement, user]);

  // Load channels and stickers
  useEffect(() => {
    fetch('/api/community/channels')
      .then(res => res.json())
      .then(data => {
        if (data.channels) setChannels(data.channels);
        if (data.onlineMembers) setOnlineCount(data.onlineMembers);
      })
      .catch(() => {});

    fetch('/api/community/stickers')
      .then(res => res.json())
      .then(data => {
        if (data.packs) setStickerPacks(data.packs);
      })
      .catch(() => {});
  }, []);

  // Fetch messages for active channel
  const fetchMessages = useCallback(async (channelId: CommunityChannelId) => {
    if (!token) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/community/messages?channelId=${channelId}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        if (data.dayKeyUTC) setDayKeyUTC(data.dayKeyUTC);
      } else if (res.status === 403) {
        setEntitlement({ hasAccess: false, tier: 'FREE', isPro: false });
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [token]);

  useEffect(() => {
    if (entitlement?.hasAccess) {
      fetchMessages(activeChannelId);
    }
  }, [activeChannelId, entitlement?.hasAccess, fetchMessages]);

  // Realtime updates via Server-Sent Events (SSE) with auto-fallback
  useEffect(() => {
    if (!token || !entitlement?.hasAccess) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/community/events?token=${token}`);

      eventSource.addEventListener('NEW_MESSAGE', (e: any) => {
        const newMsg: CommunityMessage = JSON.parse(e.data);
        if (newMsg.channelId === activeChannelId) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      });

      eventSource.addEventListener('EDIT_MESSAGE', (e: any) => {
        const updatedMsg: CommunityMessage = JSON.parse(e.data);
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
      });

      eventSource.addEventListener('DELETE_MESSAGE', (e: any) => {
        const { id } = JSON.parse(e.data);
        setMessages(prev => prev.filter(m => m.id !== id));
      });

      eventSource.addEventListener('REACTION_UPDATE', (e: any) => {
        const { messageId, reactions } = JSON.parse(e.data);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
      });

      eventSource.addEventListener('DAILY_CLEANUP', () => {
        fetchMessages(activeChannelId);
      });
    } catch (err) {
      // Fallback to polling
    }

    // Secondary poll safety every 4 seconds
    const interval = setInterval(() => {
      fetchMessages(activeChannelId);
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [token, entitlement?.hasAccess, activeChannelId, fetchMessages]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (!isLoadingMessages && !searchResults) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoadingMessages, searchResults]);

  // Toggle Test PRO entitlement (for demo reviewer / testing)
  const handleToggleProTest = async (grant: boolean) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setIsTogglingPro(true);
    try {
      const res = await fetch('/api/community/test-grant-pro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ grant })
      });
      if (res.ok) {
        await checkEntitlement();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingPro(false);
    }
  };

  // Post or edit message
  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('Network offline — reconnecting... Message posting is temporarily paused.');
      return;
    }

    if (!token) {
      onOpenAuth();
      return;
    }

    setIsPosting(true);
    setErrorMessage(null);

    try {
      if (editingMessage) {
        // Edit existing message
        const res = await fetch(`/api/community/messages/${editingMessage.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ content: text })
        });
        const data = await res.json();
        if (res.ok) {
          setMessages(prev => prev.map(m => m.id === editingMessage.id ? data.message : m));
          setEditingMessage(null);
          setInputText('');
        } else {
          setErrorMessage(data.error || 'Failed to edit message');
        }
      } else {
        // Post new message
        const res = await fetch('/api/community/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            channelId: activeChannelId,
            content: text,
            replyToId: replyTarget ? replyTarget.id : undefined
          })
        });
        const data = await res.json();
        if (res.ok) {
          setMessages(prev => [...prev, data.message]);
          setInputText('');
          setReplyTarget(null);
        } else {
          setErrorMessage(data.error || 'Failed to post message');
        }
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsPosting(false);
      setShowStickerPicker(false);
      setShowEmojiPicker(false);
    }
  };

  // Send a curated sticker
  const handleSendSticker = async (sticker: StickerItem) => {
    if (!token) return;
    setIsPosting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/community/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          channelId: activeChannelId,
          content: `${sticker.emoji} ${sticker.label}`,
          stickerId: sticker.id,
          replyToId: replyTarget ? replyTarget.id : undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, data.message]);
        setReplyTarget(null);
        setShowStickerPicker(false);
      } else {
        setErrorMessage(data.error || 'Failed to send sticker');
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsPosting(false);
    }
  };

  // Toggle reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/community/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emoji })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: data.reactions } : m));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!token || !window.confirm('Delete this message?')) return;
    try {
      const res = await fetch(`/api/community/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit report
  const handleSubmitReport = async () => {
    if (!token || !reportingMessage) return;
    try {
      const res = await fetch(`/api/community/messages/${reportingMessage.id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reportReason, details: reportDetails })
      });
      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setReportSuccess(false);
          setReportingMessage(null);
          setReportDetails('');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !token) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/community/search?q=${encodeURIComponent(searchQuery)}&channelId=${activeChannelId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  // 1. UNATHENTICATED STATE
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-cyan-400" />
          </div>

          <h2 className="text-2xl font-bold font-mono text-white mb-2 tracking-tight">
            PRO EXCLUSIVE COMMUNITY FORUM
          </h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 font-sans leading-relaxed">
            Authentication and an active PRO entitlement are required to enter the community terminal. Connect your credentials to participate.
          </p>

          <button
            onClick={onOpenAuth}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-sm shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
          >
            Sign In with Terminal Account
          </button>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED FREE USER (LOCKED SCREEN)
  if (!isCheckingEntitlement && entitlement && !entitlement.hasAccess) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-[#0b101b] border border-amber-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-[#1b253b] mb-6 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold font-mono text-white">PRO COMMUNITY</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-700/60 font-mono font-bold">
                    PRO ONLY
                  </span>
                </div>
                <p className="text-xs text-amber-300/90 mt-0.5 font-sans font-medium">
                  Join the exclusive crypto community.
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  Logged in as <span className="text-slate-200">{user.email}</span> (Free Tier)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {/* Upgrade to PRO CTA */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenUpgradeModal) onOpenUpgradeModal('PRO Community Forum');
                  else window.location.href = '/pricing';
                }}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade to PRO</span>
              </button>

              {/* Test PRO Toggle for rapid review/testing */}
              <button
                type="button"
                onClick={() => handleToggleProTest(true)}
                disabled={isTogglingPro}
                className="px-3.5 py-2.5 rounded-xl bg-[#141f33] hover:bg-[#1a2c4e] border border-[#233554] text-slate-300 font-mono text-xs shadow-md transition-all active:scale-95 flex items-center space-x-1.5"
                title="QA Test Grant PRO"
              >
                {isTogglingPro ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>QA Test Access</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1d2a42]">
              <div className="flex items-center space-x-2 text-cyan-400 mb-2">
                <Users className="w-4 h-4" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Human Market Alpha</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zero AI bot spam in public discussions. Connect with verified derivative analysts, order-flow specialists, and institutional traders.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1d2a42]">
              <div className="flex items-center space-x-2 text-amber-400 mb-2">
                <Clock className="w-4 h-4" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider">00:00 UTC Ephemeral Reset</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Daily chat partitions ensure fresh daily focus. Old messages are automatically pruned at 00:00 UTC server-time for maximum privacy.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1d2a42]">
              <div className="flex items-center space-x-2 text-purple-400 mb-2">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Telegram-Style Stickers</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Curated high-grade crypto reactions: Bull, Whale, Rekt, FOMO, DYOR, Diamond Hands, and Liquidation alerts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0e1626] border border-[#1d2a42]">
              <div className="flex items-center space-x-2 text-emerald-400 mb-2">
                <Shield className="w-4 h-4" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Two-Layer Safe Moderation</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sub-millisecond local rule shielding paired with background AI scam/phishing interception protects member accounts.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#080d16] border border-[#182338] flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Subscription billing gateway integration is scheduled for production release.</span>
            </div>
            <span className="text-[11px] text-amber-400 font-bold">Use test toggle above to evaluate immediately</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. FULL PRO COMMUNITY FORUM
  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];
  const displayedMessages = searchResults || messages;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* Top Banner / Channel Status */}
      <div className="bg-[#0b101b] border border-[#1b253b] rounded-2xl mb-4 p-3.5 flex flex-wrap items-center justify-between gap-3 font-mono">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            {CHANNEL_ICONS[activeChannelId] || <MessageSquare className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                #{activeChannel?.name || 'General'}
              </h1>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center space-x-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                <span>PRO COMMUNITY</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              {activeChannel?.description}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 bg-[#080d16] px-2.5 py-1 rounded-lg border border-[#182338]">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Partition:</span>
            <span className="text-slate-200 font-bold">{dayKeyUTC || 'UTC DAY'}</span>
            <span className="text-[10px] text-amber-400 font-bold">(00:00 UTC Reset)</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-[#080d16] px-2.5 py-1 rounded-lg border border-[#182338]">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Online:</span>
            <span className="text-cyan-300 font-bold">{onlineCount}</span>
          </div>
        </div>
      </div>

      {/* Mobile Channel Quick Switcher (< lg) */}
      <div className="flex lg:hidden items-center space-x-1.5 overflow-x-auto no-scrollbar pb-2.5 mb-2 font-mono">
        {channels.map(channel => {
          const isActive = channel.id === activeChannelId;
          return (
            <button
              key={channel.id}
              onClick={() => {
                setActiveChannelId(channel.id);
                clearSearch();
              }}
              className={`px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 whitespace-nowrap min-h-[42px] flex-shrink-0 transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'bg-[#080d16] border border-[#182338] text-slate-400 active:text-white'
              }`}
            >
              {CHANNEL_ICONS[channel.id] || <MessageSquare className="w-3.5 h-3.5" />}
              <span>#{channel.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Forum Grid: Sidebar + Chat Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column: Channels Sidebar (Desktop only) */}
        <div className="hidden lg:block lg:col-span-1 bg-[#0b101b] border border-[#1b253b] rounded-2xl p-3 space-y-1 h-[680px] overflow-y-auto no-scrollbar font-mono">
          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Discussion Channels
          </div>

          {channels.map(channel => {
            const isActive = channel.id === activeChannelId;
            return (
              <button
                key={channel.id}
                onClick={() => {
                  setActiveChannelId(channel.id);
                  clearSearch();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#111928]'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {CHANNEL_ICONS[channel.id] || <MessageSquare className="w-3.5 h-3.5" />}
                  <span className="truncate">{channel.name}</span>
                </div>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-[#182338] px-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Membership
            </div>
            <div className="bg-[#080d16] p-2.5 rounded-xl border border-[#182338] text-[11px] space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Tier:</span>
                <span className="text-amber-400 font-bold">
                  {user.role === 'admin' ? 'ADMIN' : 'PRO MEMBER'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">AI Trader Quota:</span>
                <span className="text-emerald-400 font-bold">Untouched</span>
              </div>
              {user.role === 'user' && (
                <button
                  onClick={() => handleToggleProTest(false)}
                  className="w-full mt-2 py-1 px-2 text-[10px] text-rose-400 hover:bg-rose-950/30 rounded border border-rose-800/40 transition-colors"
                >
                  Test: Revoke PRO
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Chat Feed & Composer */}
        <div className="lg:col-span-3 bg-[#0b101b] border border-[#1b253b] rounded-2xl flex flex-col h-[680px] overflow-hidden">
          {/* Channel Search Bar */}
          <div className="p-3 border-b border-[#182338] bg-[#0c121e] flex items-center justify-between gap-2">
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={`Search #${activeChannel?.name}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 bg-[#070b12] border border-[#182338] rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            <button
              onClick={() => fetchMessages(activeChannelId)}
              disabled={isLoadingMessages}
              className="p-2 rounded-xl bg-[#080d16] hover:bg-[#111928] text-slate-400 hover:text-white border border-[#182338] transition-colors"
              title="Refresh messages"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>

          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar bg-[#080d16]/50">
            {searchResults && (
              <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs font-mono flex items-center justify-between text-cyan-300">
                <span>Search results for: "{searchQuery}" ({searchResults.length} found)</span>
                <button onClick={clearSearch} className="underline text-slate-400 hover:text-white">
                  Back to live stream
                </button>
              </div>
            )}

            {isLoadingMessages && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs font-mono space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
                <span>Loading ephemeral chat stream...</span>
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                No messages in #{activeChannel?.name} today. Start the conversation!
              </div>
            ) : (
              displayedMessages.map(msg => {
                const isOwn = msg.userId === user.id;
                const canEdit = isOwn && (Date.now() - msg.createdAt < 15 * 60 * 1000);
                const canDelete = isOwn || user.role === 'admin';

                return (
                  <div
                    key={msg.id}
                    className={`group relative p-3 rounded-2xl border transition-all ${
                      isOwn
                        ? 'bg-[#0f172a]/60 border-cyan-900/30 hover:border-cyan-700/40'
                        : 'bg-[#0c121e] border-[#182338] hover:border-[#22314d]'
                    }`}
                  >
                    {/* Reply quote snippet if present */}
                    {msg.replyToMessage && (
                      <div className="mb-2 pl-2 border-l-2 border-cyan-500/50 text-[11px] text-slate-400 font-sans italic truncate bg-[#070b12] py-1 pr-2 rounded-r">
                        <span className="font-mono text-cyan-400 not-italic mr-1">
                          @{msg.replyToMessage.userName}:
                        </span>
                        {msg.replyToMessage.content}
                      </div>
                    )}

                    {/* Header: User name, badges, timestamp */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-[10px] font-bold font-mono">
                          {msg.userName.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-200">
                          {msg.userName}
                        </span>

                        {msg.userRole === 'admin' ? (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50 font-mono font-bold">
                            ADMIN
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50 font-mono font-bold">
                            PRO
                          </span>
                        )}

                        {msg.isEdited && (
                          <span className="text-[9px] text-slate-500 font-mono">(edited)</span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>

                        {/* Hover Quick Actions */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 pl-1">
                          <button
                            onClick={() => setReplyTarget(msg)}
                            className="p-1 text-slate-400 hover:text-cyan-400"
                            title="Reply"
                          >
                            <CornerUpLeft className="w-3 h-3" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingMessage(msg);
                                setInputText(msg.content);
                                inputRef.current?.focus();
                              }}
                              className="p-1 text-slate-400 hover:text-amber-400"
                              title="Edit message"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 text-slate-400 hover:text-rose-400"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => setReportingMessage(msg)}
                            className="p-1 text-slate-400 hover:text-yellow-400"
                            title="Report message"
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Curated Sticker Render */}
                    {msg.stickerId && (
                      <div className="my-2 inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold shadow-sm">
                        <span className="text-lg">
                          {msg.content.split(' ')[0]}
                        </span>
                        <span>{msg.content.substring(msg.content.indexOf(' ') + 1)}</span>
                      </div>
                    )}

                    {/* Message Body */}
                    {!msg.stickerId && (
                      <div className="text-xs text-slate-300 font-sans leading-relaxed break-words whitespace-pre-wrap">
                        {renderSafeMessageContent(msg.content)}
                      </div>
                    )}

                    {/* Reactions Bar */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {Object.entries(msg.reactions || {}).map(([emoji, userIds]) => {
                        const hasReacted = userIds.includes(user.id);
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className={`px-2 py-0.5 rounded-lg text-xs flex items-center space-x-1 border font-mono transition-all ${
                              hasReacted
                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                                : 'bg-[#090d16] border-[#182338] text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px]">{userIds.length}</span>
                          </button>
                        );
                      })}

                      {/* Quick React Button */}
                      <div className="relative group/react inline-block">
                        <button
                          className="px-1.5 py-0.5 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 bg-[#090d16] border border-[#182338] hover:border-slate-700 font-mono transition-colors"
                          title="Add reaction"
                        >
                          + React
                        </button>
                        <div className="hidden group-hover/react:flex absolute left-0 bottom-full mb-1 bg-[#0c121e] border border-[#1b253b] p-1 rounded-xl shadow-xl space-x-1 z-20">
                          {QUICK_REACTIONS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              className="hover:scale-125 transition-transform text-sm p-1"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error notification banner */}
          {errorMessage && (
            <div className="px-4 py-2 bg-rose-950/80 border-t border-rose-800 text-rose-300 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Reply Context indicator */}
          {replyTarget && (
            <div className="px-4 py-2 bg-[#0c1322] border-t border-cyan-900/50 text-xs font-mono flex items-center justify-between text-cyan-300">
              <div className="flex items-center space-x-1.5 truncate">
                <CornerUpLeft className="w-3.5 h-3.5 text-cyan-400" />
                <span>Replying to @{replyTarget.userName}:</span>
                <span className="text-slate-400 truncate font-sans max-w-sm">"{replyTarget.content}"</span>
              </div>
              <button onClick={() => setReplyTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Edit Context indicator */}
          {editingMessage && (
            <div className="px-4 py-2 bg-[#171a0e] border-t border-amber-900/50 text-xs font-mono flex items-center justify-between text-amber-300">
              <div className="flex items-center space-x-1.5">
                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Editing message:</span>
              </div>
              <button
                onClick={() => {
                  setEditingMessage(null);
                  setInputText('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Sticker Picker Popover */}
          {showStickerPicker && (
            <div className="p-3 bg-[#0c121e] border-t border-[#1b253b] max-h-48 overflow-y-auto font-mono">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Curated Crypto Sticker Pack
                </span>
                <button onClick={() => setShowStickerPicker(false)} className="text-slate-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {stickerPacks[0]?.stickers.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => handleSendSticker(sticker)}
                    className="p-2 rounded-xl bg-[#080d16] hover:bg-amber-950/20 border border-[#182338] hover:border-amber-500/40 text-center transition-all flex flex-col items-center space-y-1"
                  >
                    <span className="text-xl">{sticker.emoji}</span>
                    <span className="text-[9px] text-slate-300 font-bold truncate max-w-full">
                      {sticker.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div className="p-2 bg-[#0c121e] border-t border-[#1b253b] flex items-center space-x-2">
              {['👍', '🚀', '🔥', '💎', '🐂', '🐻', '🎯', '⚡', '☕', '🌙', '📈', '📉', '😱', '🔍'].map(e => (
                <button
                  key={e}
                  onClick={() => {
                    setInputText(prev => prev + e);
                    setShowEmojiPicker(false);
                    inputRef.current?.focus();
                  }}
                  className="text-lg hover:scale-125 transition-transform p-1"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Message Composer Input (Phase 23 Mobile Safe Area) */}
          <div className="p-2 sm:p-3 pb-safe bg-[#0c121e] border-t border-[#182338] flex items-end space-x-2">
            <div className="flex items-center space-x-1 pb-0.5 text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowStickerPicker(false);
                }}
                className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl hover:bg-[#182338] hover:text-white transition-colors"
                title="Add Emoji"
                aria-label="Add Emoji"
              >
                <Smile className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStickerPicker(!showStickerPicker);
                  setShowEmojiPicker(false);
                }}
                className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl hover:bg-amber-950/30 text-amber-400 transition-colors"
                title="Send Curated Sticker"
                aria-label="Send Sticker"
              >
                <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                typeof navigator !== 'undefined' && !navigator.onLine
                  ? 'Network offline — reconnecting...'
                  : `Message #${activeChannel?.name}...`
              }
              maxLength={1000}
              disabled={typeof navigator !== 'undefined' && !navigator.onLine}
              className="flex-1 bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 font-sans focus:outline-none focus:border-cyan-500/50 resize-none max-h-24 no-scrollbar min-h-[42px] disabled:opacity-50"
            />

            <button
              onClick={handleSendMessage}
              disabled={isPosting || !inputText.trim() || (typeof navigator !== 'undefined' && !navigator.onLine)}
              className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-all shadow-md active:scale-95 flex-shrink-0"
              title="Send Message"
              aria-label="Send Message"
            >
              {isPosting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* REPORT MESSAGE MODAL */}
      {reportingMessage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c121e] border border-yellow-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl font-mono">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-yellow-400">
                <Flag className="w-5 h-5" />
                <h3 className="font-bold text-sm">Report Community Message</h3>
              </div>
              <button
                onClick={() => setReportingMessage(null)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-center text-emerald-300 text-xs">
                <Check className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                <span>Report submitted. Background AI and moderation queue will review promptly.</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-2.5 rounded-xl bg-[#080d16] border border-[#182338] text-slate-300">
                  <span className="text-slate-500 block mb-1">Reported User: @{reportingMessage.userName}</span>
                  <p className="font-sans italic text-slate-400">"{reportingMessage.content}"</p>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5">Violation Reason:</label>
                  <select
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Spam">Spam / Excessive repetitive messaging</option>
                    <option value="Scam">Scam / Phishing / Fraudulent scheme</option>
                    <option value="Harassment">Harassment / Targeted abuse</option>
                    <option value="Offensive language">Offensive / Prohibited language</option>
                    <option value="Malicious link">Malicious Link / Suspicious domain</option>
                    <option value="Suspicious promotion">Suspicious promotion / Unsolicited VIP signals</option>
                    <option value="Other">Other violation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5">Additional Context (Optional):</label>
                  <textarea
                    rows={2}
                    value={reportDetails}
                    onChange={e => setReportDetails(e.target.value)}
                    placeholder="Provide details for human admin & AI review..."
                    className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 resize-none font-sans"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setReportingMessage(null)}
                    className="px-4 py-2 rounded-xl bg-[#111928] text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    className="px-4 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-slate-950 font-bold text-xs shadow-md transition-all"
                  >
                    Submit Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
