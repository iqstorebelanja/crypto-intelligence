import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthModal } from './components/AuthModal';
import { CoinDetail } from './components/CoinDetail';
import { MarketHeader, NavTab } from './components/MarketHeader';
import { MarketOverview } from './components/MarketOverview';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileHeader } from './components/MobileHeader';
import { MobileMoreDrawer } from './components/MobileMoreDrawer';
import { ScannerFilters, ScannerFilterState } from './components/ScannerFilters';
import { ScannerTable } from './components/ScannerTable';
import { WatchlistTable } from './components/WatchlistTable';
import { GlobalFooterAd } from './components/ads/GlobalFooterAd';
import { UpgradeModal } from './components/UpgradeModal';
import { UserFeedbackModal } from './components/UserFeedbackModal';
import { SignalExplanationModal } from './components/SignalExplanationModal';
import { trackEvent } from './utils/analytics';
import { NetworkOfflineBanner } from './components/NetworkOfflineBanner';
import { useNetworkState } from './hooks/useNetworkState';
import { usePWAInstall } from './hooks/usePWAInstall';

// Phase 19: Route-level code splitting & lazy loading for heavy subviews
const AiTraderChat = React.lazy(() => import('./components/AiTraderChat').then(m => ({ default: m.AiTraderChat })));
const AlertsManager = React.lazy(() => import('./components/AlertsManager').then(m => ({ default: m.AlertsManager })));
const DataQualityMonitor = React.lazy(() => import('./components/DataQualityMonitor').then(m => ({ default: m.DataQualityMonitor })));
const DerivativesScanner = React.lazy(() => import('./components/DerivativesScanner').then(m => ({ default: m.DerivativesScanner })));
const MarketStructureScanner = React.lazy(() => import('./components/MarketStructureScanner').then(m => ({ default: m.MarketStructureScanner })));
const SignalIntelligencePanel = React.lazy(() => import('./components/SignalIntelligencePanel').then(m => ({ default: m.SignalIntelligencePanel })));
const WhaleScanner = React.lazy(() => import('./components/WhaleScanner').then(m => ({ default: m.WhaleScanner })));
const CommunityForum = React.lazy(() => import('./components/CommunityForum').then(m => ({ default: m.CommunityForum })));
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AccountView = React.lazy(() => import('./components/AccountView').then(m => ({ default: m.AccountView })));
const PricingView = React.lazy(() => import('./components/PricingView').then(m => ({ default: m.PricingView })));
const NotificationCenter = React.lazy(() => import('./components/NotificationCenter').then(m => ({ default: m.NotificationCenter })));

const RouteLoadingFallback: React.FC = () => (
  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
    Loading module...
  </div>
);
import {
  AlertEvent,
  ExchangeId,
  MarketOverview as MarketOverviewType,
  NormalizedCoinData,
  User
} from './types';
import { soundAlert } from './utils/audioAlert';

const INITIAL_FILTERS: ScannerFilterState = {
  search: '',
  bullMin: null,
  riskMin: null,
  volRatioMin: null,
  rsiMin: null,
  rsiMax: null,
  aboveMa20: false,
  aboveMa50: false,
  aboveMa200: false,
  signalFilter: 'ALL',
  sortBy: 'bullScore',
  sortOrder: 'desc'
};

const TAB_ROUTES: Record<Exclude<NavTab, 'coin_detail'>, string> = {
  score: '/score',
  signals: '/signals',
  crash_risk: '/crash-risk',
  derivatives: '/derivatives',
  structure: '/structure',
  watchlist: '/watchlist',
  alerts: '/alerts',
  notifications: '/notifications',
  data_quality: '/data-quality',
  whales: '/whales',
  ai_trader: '/ai-trader',
  community: '/community',
  admin: '/admin',
  account: '/account',
  pricing: '/pricing'
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab: NavTab = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/coin/')) return 'coin_detail';
    if (p === '/signals') return 'signals';
    if (p === '/crash-risk' || p === '/crash_risk') return 'crash_risk';
    if (p === '/derivatives') return 'derivatives';
    if (p === '/structure') return 'structure';
    if (p === '/watchlist') return 'watchlist';
    if (p === '/alerts') return 'alerts';
    if (p.startsWith('/notifications')) return 'notifications';
    if (p === '/data-quality' || p === '/data_quality') return 'data_quality';
    if (p === '/whales') return 'whales';
    if (p === '/ai-trader' || p === '/ai_trader') return 'ai_trader';
    if (p.startsWith('/community') || p.startsWith('/forum')) return 'community';
    if (p.startsWith('/admin')) return 'admin';
    if (p.startsWith('/account')) return 'account';
    if (p.startsWith('/pricing')) return 'pricing';
    return 'score';
  }, [location.pathname]);

  const [activeExchange, setActiveExchangeState] = useState<ExchangeId>(() => {
    const urlEx = new URLSearchParams(window.location.search).get('exchange')?.toUpperCase();
    if (urlEx && /^[A-Z0-9_\-]+$/.test(urlEx)) {
      return urlEx as ExchangeId;
    }
    const saved = localStorage.getItem('active_exchange')?.toUpperCase();
    if (saved && /^[A-Z0-9_\-]+$/.test(saved)) {
      return saved as ExchangeId;
    }
    return 'ALL';
  });

  const setActiveExchange = useCallback((ex: ExchangeId) => {
    setActiveExchangeState(ex);
    localStorage.setItem('active_exchange', ex);
    const params = new URLSearchParams(window.location.search);
    params.set('exchange', ex.toLowerCase());
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'coin_detail') return;
    const targetRoute = TAB_ROUTES[tab as keyof typeof TAB_ROUTES] || '/score';
    const params = new URLSearchParams(location.search);
    if (!params.has('exchange') && activeExchange) {
      params.set('exchange', activeExchange.toLowerCase());
    }
    const searchStr = params.toString() ? `?${params.toString()}` : '';
    navigate(`${targetRoute}${searchStr}`);
  };

  const handleSelectCoin = useCallback((coinOrSymbol: NormalizedCoinData | string) => {
    const sym = typeof coinOrSymbol === 'string'
      ? coinOrSymbol
      : (coinOrSymbol.rawSymbol || coinOrSymbol.symbol);
    const clean = sym.replace(/[\/\-_]/g, '').toUpperCase();
    const params = new URLSearchParams(location.search);
    if (!params.has('exchange') && activeExchange) {
      params.set('exchange', activeExchange.toLowerCase());
    }
    const searchStr = params.toString() ? `?${params.toString()}` : '';
    navigate(`/coin/${clean}${searchStr}`, { state: { from: location.pathname } });
  }, [navigate, location.pathname, location.search, activeExchange]);
  const [overview, setOverview] = useState<MarketOverviewType | null>(null);
  const [coins, setCoins] = useState<NormalizedCoinData[]>([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'BNB/USDT'
  ]);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<ScannerFilterState>(INITIAL_FILTERS);
  const [quickSection, setQuickSection] = useState<'all' | 'bulls' | 'risk' | 'volume' | 'momentum'>('all');
  const [prefillAlertSymbol, setPrefillAlertSymbol] = useState<string | null>(null);
  const [unacknowledgedAlertsCount, setUnacknowledgedAlertsCount] = useState<number>(0);
  const [lastAlertEventId, setLastAlertEventId] = useState<string | null>(null);
  const [activeAlertToast, setActiveAlertToast] = useState<AlertEvent | null>(null);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isAdVisible, setIsAdVisible] = useState<boolean>(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>(undefined);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [explanationCoin, setExplanationCoin] = useState<NormalizedCoinData | null>(null);

  // Phase 28: Track route change analytics event
  useEffect(() => {
    trackEvent('app_open', { path: location.pathname });
  }, [location.pathname]);

  // Phase 23: PWA & Network Resilience Hooks
  const { needRefresh, updateServiceWorker } = usePWAInstall();
  const { isOnline, showBackOnlineBanner } = useNetworkState(() => {
    // When returning online: restore live market feeds and notifications
    fetchMarketData(false);
    checkAlertEvents();
  });

  const handleOpenUpgrade = useCallback((context?: string) => {
    setUpgradeContext(context);
    setIsUpgradeModalOpen(true);
  }, []);

  // Check authentication session
  const checkAuth = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, [token]);

  // Fetch Watchlist
  const fetchWatchlist = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/watchlist', { headers });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          setWatchlistSymbols(list);
        }
      }
    } catch {
      // Keep local defaults
    }
  }, [token]);

  // Check recent alert events
  const checkAlertEvents = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts/events', { headers });
      if (res.ok) {
        const events: AlertEvent[] = await res.json();
        const unack = events.filter(e => e.status === 'TRIGGERED' || !e.read);
        setUnacknowledgedAlertsCount(unack.length);

        if (events.length > 0) {
          const newest = events[0];
          if (newest.id !== lastAlertEventId && (newest.status === 'TRIGGERED' || !newest.read)) {
            setLastAlertEventId(newest.id);
            soundAlert.playAlertChime(newest.severity);
            setActiveAlertToast(newest);
            setTimeout(() => {
              setActiveAlertToast(prev => (prev?.id === newest.id ? null : prev));
            }, 6500);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [token, lastAlertEventId]);

  // Fetch Market Data & Overview with selected exchange
  const fetchMarketData = useCallback(async (isManual: boolean = false) => {
    if (isManual) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return; // Prevent manual refresh storm when offline
      }
      setIsRefreshing(true);
    }
    try {
      const [overviewRes, scannerRes] = await Promise.all([
        fetch(`/api/market/overview?exchange=${activeExchange}`),
        fetch(`/api/market/scanner?exchange=${activeExchange}`)
      ]);

      if (overviewRes.ok) {
        const ov = await overviewRes.json();
        setOverview(ov);
      }

      if (scannerRes.ok) {
        const sc = await scannerRes.json();
        setCoins(sc);
      }

      // Check alerts
      checkAlertEvents();
    } catch (err) {
      console.warn('Market fetch error:', err);
    } finally {
      if (isManual) setIsRefreshing(false);
    }
  }, [activeExchange, checkAlertEvents]);

  useEffect(() => {
    checkAuth();
    fetchWatchlist();
  }, [checkAuth, fetchWatchlist]);

  // Performance: Dynamic Polling with Visibility API (pauses background polling to conserve mobile CPU, battery & network)
  useEffect(() => {
    fetchMarketData(false);

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (!document.hidden) {
            fetchMarketData(false);
          }
        }, 12000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchMarketData(false);
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchMarketData]);

  // Update filters automatically when changing to CRASH RISK tab
  useEffect(() => {
    if (activeTab === 'crash_risk') {
      setFilters(prev => ({
        ...prev,
        sortBy: 'downsideRisk',
        sortOrder: 'desc'
      }));
    } else if (activeTab === 'score') {
      setFilters(prev => ({
        ...prev,
        sortBy: 'bullScore',
        sortOrder: 'desc'
      }));
    }
  }, [activeTab]);

  // Handle Quick Section change from Overview buttons
  const handleQuickSectionChange = (sec: 'all' | 'bulls' | 'risk' | 'volume' | 'momentum') => {
    setQuickSection(sec);
    if (sec === 'bulls') {
      navigate('/score');
      setFilters(prev => ({ ...prev, bullMin: 70, riskMin: null, volRatioMin: null, sortBy: 'bullScore', sortOrder: 'desc' }));
    } else if (sec === 'risk') {
      navigate('/crash-risk');
      setFilters(prev => ({ ...prev, riskMin: 65, bullMin: null, volRatioMin: null, sortBy: 'downsideRisk', sortOrder: 'desc' }));
    } else if (sec === 'volume') {
      setFilters(prev => ({ ...prev, volRatioMin: 2.0, bullMin: null, riskMin: null, sortBy: 'volumeRatio', sortOrder: 'desc' }));
    } else if (sec === 'momentum') {
      setFilters(prev => ({ ...prev, sortBy: 'change24h', sortOrder: 'desc' }));
    } else {
      setFilters(INITIAL_FILTERS);
    }
  };

  // Watchlist Toggle
  const handleToggleWatchlist = async (symbol: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return; // Mutations disabled while offline
    }
    const isSaved = watchlistSymbols.includes(symbol);
    const updated = isSaved
      ? watchlistSymbols.filter(s => s !== symbol)
      : [...watchlistSymbols, symbol];
    setWatchlistSymbols(updated);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (isSaved) {
        await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, {
          method: 'DELETE',
          headers
        });
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers,
          body: JSON.stringify({ symbol })
        });
      }
    } catch {
      // Local state preserved
    }
  };

  // Auth success
  const handleAuthSuccess = (authUser: User, authToken: string) => {
    setUser(authUser);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    fetchWatchlist();
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch {
      // proceed
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  const handleDemoAdminLogin = async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@cryptointelligence.ai', password: 'Password123!' })
      });
      if (res.ok) {
        const data = await res.json();
        handleAuthSuccess(data.user, data.token);
      }
    } catch (err) {
      console.error('Demo admin login failed:', err);
    }
  };

  // Open Alert creator from CoinDetail or Watchlist
  const handleOpenAlertForCoin = (symbol: string) => {
    setPrefillAlertSymbol(symbol);
    navigate('/alerts');
  };

  // Filtered Coins for Scanner Table
  const filteredCoins = useMemo(() => {
    let result = [...coins];

    if (filters.search.trim()) {
      const q = filters.search.toUpperCase().trim();
      result = result.filter(c => c.symbol.includes(q) || c.baseAsset.includes(q));
    }

    if (filters.bullMin !== null) {
      result = result.filter(c => c.scores.bullScore >= filters.bullMin!);
    }

    if (filters.riskMin !== null) {
      result = result.filter(c => c.scores.downsideRiskScore >= filters.riskMin!);
    }

    if (filters.volRatioMin !== null) {
      result = result.filter(c => c.indicators.volumeAnalysis.ratio >= filters.volRatioMin!);
    }

    if (filters.rsiMin !== null) {
      result = result.filter(c => c.indicators.rsi14 >= filters.rsiMin!);
    }

    if (filters.rsiMax !== null) {
      result = result.filter(c => c.indicators.rsi14 <= filters.rsiMax!);
    }

    if (filters.aboveMa20) {
      result = result.filter(c => c.indicators.priceVsMa20 === 'above');
    }

    if (filters.aboveMa50) {
      result = result.filter(c => c.indicators.priceVsMa50 === 'above');
    }

    if (filters.aboveMa200) {
      result = result.filter(c => c.indicators.priceVsMa200 === 'above');
    }

    // Signal Filters (Phase 7)
    if (filters.signalFilter && filters.signalFilter !== 'ALL') {
      switch (filters.signalFilter) {
        case 'BULLISH':
          result = result.filter(c => c.signal?.direction === 'BULLISH');
          break;
        case 'BEARISH':
          result = result.filter(c => c.signal?.direction === 'BEARISH');
          break;
        case 'CONFIRMED':
          result = result.filter(c => c.signal?.status === 'CONFIRMED');
          break;
        case 'ACTIVE':
          result = result.filter(
            c => c.signal?.status === 'ACTIVE' || c.signal?.status === 'CONFIRMED'
          );
          break;
        case 'CONFLUENT':
          result = result.filter(
            c =>
              Boolean(c.signal?.multiTimeframeSummary?.isConfluent) ||
              (c.signal?.multiTimeframeSummary?.alignmentScore ?? 0) >= 65
          );
          break;
        case 'BREAKOUT':
          result = result.filter(
            c =>
              c.signal?.signalType === 'BULLISH_BREAKOUT' ||
              c.signal?.breakoutContext?.state === 'BREAKOUT CONFIRMED'
          );
          break;
        case 'BREAKDOWN':
          result = result.filter(c => c.signal?.signalType === 'BEARISH_BREAKDOWN');
          break;
        case 'REVERSAL':
          result = result.filter(
            c =>
              c.signal?.signalType === 'BULLISH_REVERSAL' ||
              c.signal?.signalType === 'BEARISH_REVERSAL'
          );
          break;
        case 'CONTINUATION':
          result = result.filter(
            c =>
              c.signal?.signalType === 'BULLISH_CONTINUATION' ||
              c.signal?.signalType === 'BEARISH_CONTINUATION'
          );
          break;
      }
    }

    const order = filters.sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      if (filters.sortBy === 'strength') {
        const sA = a.signal?.strength ?? 0;
        const sB = b.signal?.strength ?? 0;
        return (sA - sB) * order;
      }
      if (filters.sortBy === 'mtfConfluence') {
        const cA = a.signal?.multiTimeframeSummary?.alignmentScore ?? 0;
        const cB = b.signal?.multiTimeframeSummary?.alignmentScore ?? 0;
        return (cA - cB) * order;
      }
      if (filters.sortBy === 'oiChange') {
        const oiA = a.derivatives?.openInterestChange24h ?? 0;
        const oiB = b.derivatives?.openInterestChange24h ?? 0;
        return (oiA - oiB) * order;
      }
      if (filters.sortBy === 'funding') {
        const fA = a.derivatives?.fundingRate ?? 0;
        const fB = b.derivatives?.fundingRate ?? 0;
        return (fA - fB) * order;
      }
      if (filters.sortBy === 'bullScore') return (a.scores.bullScore - b.scores.bullScore) * order;
      if (filters.sortBy === 'downsideRisk') return (a.scores.downsideRiskScore - b.scores.downsideRiskScore) * order;
      if (filters.sortBy === 'volumeRatio') return (a.indicators.volumeAnalysis.ratio - b.indicators.volumeAnalysis.ratio) * order;
      if (filters.sortBy === 'rsi14') return (a.indicators.rsi14 - b.indicators.rsi14) * order;
      if (filters.sortBy === 'change24h') return (a.change24h - b.change24h) * order;
      if (filters.sortBy === 'price') return (a.price - b.price) * order;
      return (a.scores.bullScore - b.scores.bullScore) * order;
    });

    return result;
  }, [coins, filters]);

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col antialiased selection:bg-cyan-500 selection:text-black">
      {/* Production PWA Network & Update Banner (Phase 23) */}
      <NetworkOfflineBanner
        isOnline={isOnline}
        showBackOnlineBanner={showBackOnlineBanner}
        needRefresh={needRefresh}
        onUpdateApp={updateServiceWorker}
      />

      {/* Mobile Top Header (< lg) */}
      <MobileHeader
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activeExchange={activeExchange}
        setActiveExchange={setActiveExchange}
        overview={overview}
        coins={coins}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onRefresh={() => fetchMarketData(true)}
        isRefreshing={isRefreshing}
        unacknowledgedAlertsCount={unacknowledgedAlertsCount}
        onOpenMore={() => setIsMobileMoreOpen(true)}
      />

      {/* Desktop Top Header & Navigation (>= lg) */}
      <MarketHeader
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activeExchange={activeExchange}
        setActiveExchange={setActiveExchange}
        overview={overview}
        coins={coins}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onRefresh={() => fetchMarketData(true)}
        isRefreshing={isRefreshing}
        unacknowledgedAlertsCount={unacknowledgedAlertsCount}
        onOpenFeedback={() => setIsFeedbackModalOpen(true)}
      />

      {/* Main Container with Router Views - with mobile safe area bottom padding */}
      <main className={`flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-6 ${isAdVisible ? 'pb-36 lg:pb-16' : 'pb-24 lg:pb-6'}`}>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
          <Route path="/" element={<Navigate to="/score" replace />} />
          <Route path="/dashboard" element={<Navigate to="/score" replace />} />

          {/* Route 1: SCORE */}
          <Route
            path="/score"
            element={
              <div className="space-y-6">
                <MarketOverview
                  overview={overview}
                  onSelectCoin={handleSelectCoin}
                  activeQuickSection={quickSection}
                  onQuickSectionChange={handleQuickSectionChange}
                  filteredCoins={filteredCoins}
                />
                <div id="market-scanner-section" className="space-y-4">
                  <ScannerFilters
                    filters={filters}
                    onChange={setFilters}
                    onReset={() => setFilters(INITIAL_FILTERS)}
                    totalFilteredCount={filteredCoins.length}
                    totalCoinsCount={coins.length}
                  />
                  <ScannerTable
                    coins={filteredCoins}
                    watchlistSymbols={watchlistSymbols}
                    onToggleWatchlist={handleToggleWatchlist}
                    onSelectCoin={handleSelectCoin}
                    isLoading={coins.length === 0 && isRefreshing}
                    onOpenUpgrade={handleOpenUpgrade}
                    onOpenExplanation={(c) => setExplanationCoin(c)}
                  />
                </div>
              </div>
            }
          />

          {/* Route: SIGNALS (Phase 7 Signal Intelligence) */}
          <Route
            path="/signals"
            element={
              <SignalIntelligencePanel
                coins={coins}
                watchlistSymbols={watchlistSymbols}
                onToggleWatchlist={handleToggleWatchlist}
                onSelectCoin={handleSelectCoin}
                onRefresh={fetchMarketData}
                isRefreshing={isRefreshing}
                user={user}
                onOpenUpgrade={handleOpenUpgrade}
              />
            }
          />

          {/* Route 2: CRASH RISK */}
          <Route
            path="/crash-risk"
            element={
              <div className="space-y-6">
                <MarketOverview
                  overview={overview}
                  onSelectCoin={handleSelectCoin}
                  activeQuickSection={quickSection}
                  onQuickSectionChange={handleQuickSectionChange}
                  filteredCoins={filteredCoins}
                />
                <div className="space-y-4">
                  <div className="p-3.5 bg-rose-950/40 border border-rose-800/40 rounded-2xl flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-2 text-rose-300">
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                      <span className="font-bold">DOWNSIDE RISK RADAR</span>
                      <span className="text-slate-400 hidden sm:inline">— Sorted by Highest Downside Pressure</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">Strictly analytical condition models</span>
                  </div>

                  <ScannerFilters
                    filters={filters}
                    onChange={setFilters}
                    onReset={() => setFilters({ ...INITIAL_FILTERS, sortBy: 'downsideRisk' })}
                    totalFilteredCount={filteredCoins.length}
                    totalCoinsCount={coins.length}
                  />

                  <ScannerTable
                    coins={filteredCoins}
                    watchlistSymbols={watchlistSymbols}
                    onToggleWatchlist={handleToggleWatchlist}
                    onSelectCoin={handleSelectCoin}
                    isLoading={coins.length === 0 && isRefreshing}
                    onOpenUpgrade={handleOpenUpgrade}
                    onOpenExplanation={(c) => setExplanationCoin(c)}
                  />
                </div>
              </div>
            }
          />
          <Route path="/crash_risk" element={<Navigate to="/crash-risk" replace />} />

          {/* Route 3: DERIVATIVES */}
          <Route
            path="/derivatives"
            element={
              <DerivativesScanner
                coins={coins}
                onSelectCoin={handleSelectCoin}
                activeExchange={activeExchange}
                user={user}
                onOpenUpgrade={handleOpenUpgrade}
              />
            }
          />

          {/* Route 4: STRUCTURE */}
          <Route
            path="/structure"
            element={
              <MarketStructureScanner
                coins={coins}
                onSelectCoin={handleSelectCoin}
                activeExchange={activeExchange}
              />
            }
          />

          {/* Route 5: WATCHLIST */}
          <Route
            path="/watchlist"
            element={
              <WatchlistTable
                coins={coins}
                watchlistSymbols={watchlistSymbols}
                onToggleWatchlist={handleToggleWatchlist}
                onSelectCoin={handleSelectCoin}
                onSetAlertForCoin={handleOpenAlertForCoin}
                isLoading={coins.length === 0 && isRefreshing}
              />
            }
          />

          {/* Route 6: ALERTS */}
          <Route
            path="/alerts"
            element={
              <AlertsManager
                user={user}
                coins={coins}
                onOpenAuth={() => setIsAuthOpen(true)}
                onSelectCoin={handleSelectCoin}
                prefillSymbol={prefillAlertSymbol}
                onClosePrefill={() => setPrefillAlertSymbol(null)}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />

          {/* Route 7: DATA QUALITY */}
          <Route
            path="/data-quality"
            element={
              <DataQualityMonitor
                coins={coins}
                onRefresh={fetchMarketData}
                isRefreshing={isRefreshing}
              />
            }
          />
          <Route path="/data_quality" element={<Navigate to="/data-quality" replace />} />

          {/* Route 8: WHALES */}
          <Route
            path="/whales"
            element={
              <WhaleScanner
                onSelectCoin={handleSelectCoin}
                activeExchange={activeExchange}
                user={user}
                onOpenUpgrade={handleOpenUpgrade}
              />
            }
          />

          {/* Route 9: AI TRADER */}
          <Route
            path="/ai-trader"
            element={
              <AiTraderChat
                activeExchange={activeExchange}
                onSelectCoin={handleSelectCoin}
                token={token}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />
          <Route path="/ai_trader" element={<Navigate to="/ai-trader" replace />} />

          {/* Route: COMMUNITY (Phase 9 PRO Exclusive Community Forum) */}
          <Route
            path="/community"
            element={
              <CommunityForum
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                token={token}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />
          <Route
            path="/community/:channelId"
            element={
              <CommunityForum
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                token={token}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />
          <Route path="/forum" element={<Navigate to="/community" replace />} />
          <Route path="/forum/*" element={<Navigate to="/community" replace />} />

          {/* Route 10: COIN DETAIL (URL is Single Source of Truth) */}
          <Route
            path="/coin/:symbol"
            element={
              <CoinDetailRoutePage
                coins={coins}
                watchlistSymbols={watchlistSymbols}
                onToggleWatchlist={handleToggleWatchlist}
                onOpenAlertModal={handleOpenAlertForCoin}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />

          {/* Route 11: ADMIN CONSOLE & VALIDATION LAB (Phase 4A & Phase 5) */}
          <Route
            path="/admin"
            element={
              <AdminDashboard
                user={user}
                token={token}
                onSwitchToDemoAdmin={handleDemoAdminLogin}
              />
            }
          />
          <Route
            path="/admin/validation"
            element={
              <AdminDashboard
                user={user}
                token={token}
                initialTab="validation"
                onSwitchToDemoAdmin={handleDemoAdminLogin}
              />
            }
          />

          {/* Route 12: USER PROFILE, ACCOUNT SECURITY & SESSIONS (Phase 14) */}
          <Route
            path="/account"
            element={
              <AccountView
                user={user}
                token={token}
                onUpdateUser={u => setUser(u)}
                onLogout={handleLogout}
                onOpenAuth={() => setIsAuthOpen(true)}
                onNavigateToPricing={() => navigate('/pricing')}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />
          <Route
            path="/account/sessions"
            element={
              <AccountView
                user={user}
                token={token}
                initialTab="sessions"
                onUpdateUser={u => setUser(u)}
                onLogout={handleLogout}
                onOpenAuth={() => setIsAuthOpen(true)}
                onNavigateToPricing={() => navigate('/pricing')}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />

          {/* Route 13: PRO UPGRADE & PRICING (Phase 16) */}
          <Route
            path="/pricing"
            element={
              <PricingView
                user={user}
                token={token}
                onUserUpdated={u => setUser(u)}
                onNavigateToTab={tab => handleTabChange(tab as NavTab)}
              />
            }
          />

          {/* Route 14: NOTIFICATIONS & WEB PUSH (Phase 23 Notification Center & Deep Links) */}
          <Route
            path="/notifications"
            element={
              <NotificationCenter
                user={user}
                token={token}
                onNavigate={path => navigate(path)}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />
          <Route
            path="/notifications/*"
            element={
              <NotificationCenter
                user={user}
                token={token}
                onNavigate={path => navigate(path)}
                onOpenUpgradeModal={handleOpenUpgrade}
              />
            }
          />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/score" replace />} />
        </Routes>
      </Suspense>
      </main>

      {/* Footer & Regulatory Notice */}
      <footer className="bg-[#080d16] border-t border-[#141d2d] py-5 px-4 text-center text-slate-500 text-[11px] font-mono leading-relaxed mt-12">
        <div className="max-w-4xl mx-auto space-y-1.5">
          <p className="font-bold text-slate-400">
            CRYPTO INTELLIGENCE AI • MULTI-SOURCE MARKET INTELLIGENCE & QUANTITATIVE RADAR
          </p>
          <p>
            IMPORTANT REGULATORY NOTICE: This platform is strictly an analytical and information platform. It is NOT an autonomous trading bot.
            The platform MUST NEVER place trades, execute orders, manage positions, or hold user funds.
            All technical indicators, Bull Scores, Downside Risk Scores, Market Structure classifications, and Derivatives statistics are mathematical models and must never be presented as guaranteed predictions.
          </p>
        </div>
      </footer>

      {/* Real-time Alert Toast Notification */}
      {activeAlertToast && (
        <aside
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed top-14 right-4 z-50 max-w-sm w-[calc(100%-2rem)] sm:w-80 bg-[#0a1120]/95 backdrop-blur-md border border-cyan-500/50 rounded-2xl p-3.5 shadow-2xl shadow-cyan-950/50 font-mono text-xs animate-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="font-bold text-white">{activeAlertToast.symbol}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {activeAlertToast.exchange || 'BINANCE'}
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                  {activeAlertToast.category}
                </span>
              </div>
              <h4 className="font-bold text-slate-100 text-xs truncate">
                {activeAlertToast.title}
              </h4>
              <p className="text-[11px] text-slate-300 line-clamp-2 font-sans">
                {activeAlertToast.message}
              </p>
            </div>
            <button
              onClick={() => setActiveAlertToast(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white flex-shrink-0"
              aria-label="Dismiss alert notification"
            >
              <span className="text-base leading-none">✕</span>
            </button>
          </div>
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#18263e]">
            <button
              onClick={() => {
                setActiveAlertToast(null);
                handleSelectCoin(activeAlertToast.symbol);
              }}
              className="text-cyan-400 hover:text-cyan-300 font-bold text-[11px]"
            >
              Inspect Coin →
            </button>
            <button
              onClick={() => {
                setActiveAlertToast(null);
                handleTabChange('alerts');
              }}
              className="text-slate-400 hover:text-slate-200 text-[11px]"
            >
              View in Alerts
            </button>
          </div>
        </aside>
      )}

      {/* User Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* PRO Upgrade Informational Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        user={user}
        token={token}
        onUserUpdated={newUser => setUser(newUser)}
        featureContext={upgradeContext}
      />

      {/* Phase 28: Real User Feedback & Accuracy Rating Modal */}
      <UserFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

      {/* Phase 30: Signal Explanation & Trust Layer Modal */}
      {explanationCoin && (
        <SignalExplanationModal
          coin={explanationCoin}
          timeframe="1h"
          user={user}
          onClose={() => setExplanationCoin(null)}
          onOpenUpgrade={handleOpenUpgrade}
        />
      )}

      {/* Phase 13: Global Footer Ad Slot (Responsive desktop bottom & mobile above bottom nav) */}
      <GlobalFooterAd
        user={user}
        activeExchange={activeExchange}
        onAdVisibilityChange={setIsAdVisible}
      />

      {/* Mobile Bottom Navigation (fixed 5 destinations on mobile) */}
      <MobileBottomNav
        activeTab={activeTab}
        onNavigate={handleTabChange}
        onOpenMore={() => setIsMobileMoreOpen(true)}
        isMoreOpen={isMobileMoreOpen}
        unacknowledgedAlertsCount={unacknowledgedAlertsCount}
      />

      {/* Mobile More Secondary Drawer Sheet */}
      <MobileMoreDrawer
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        activeTab={activeTab}
        onNavigate={handleTabChange}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        unacknowledgedAlertsCount={unacknowledgedAlertsCount}
      />
    </div>
  );
}

function CoinDetailRoutePage({
  coins,
  watchlistSymbols,
  onToggleWatchlist,
  onOpenAlertModal,
  onOpenUpgradeModal
}: {
  coins: NormalizedCoinData[];
  watchlistSymbols: string[];
  onToggleWatchlist: (symbol: string) => void;
  onOpenAlertModal: (symbol: string) => void;
  onOpenUpgradeModal?: (context?: string) => void;
}) {
  const { symbol } = useParams<{ symbol: string }>();
  const [searchParams] = useSearchParams();
  const urlExchange = (searchParams.get('exchange')?.toUpperCase() || null) as ExchangeId | null;
  const clean = (symbol || '').replace(/[\/\-_]/g, '').toUpperCase();

  const matched = useMemo(() => {
    if (!clean || coins.length === 0) return null;
    if (urlExchange) {
      const matchWithEx = coins.find(
        c =>
          c.exchange === urlExchange &&
          (c.rawSymbol.toUpperCase() === clean ||
            c.symbol.replace(/[\/\-_]/g, '').toUpperCase() === clean ||
            c.baseAsset.toUpperCase() === clean)
      );
      if (matchWithEx) return matchWithEx;
    }
    return (
      coins.find(
        c =>
          c.rawSymbol.toUpperCase() === clean ||
          c.symbol.replace(/[\/\-_]/g, '').toUpperCase() === clean ||
          c.baseAsset.toUpperCase() === clean
      ) || null
    );
  }, [coins, clean, urlExchange]);

  return (
    <CoinDetail
      coin={matched}
      symbol={clean}
      initialExchange={urlExchange || undefined}
      isSavedInWatchlist={matched ? watchlistSymbols.includes(matched.symbol) : false}
      onToggleWatchlist={onToggleWatchlist}
      onOpenAlertModal={onOpenAlertModal}
      onOpenUpgradeModal={onOpenUpgradeModal}
    />
  );
}
