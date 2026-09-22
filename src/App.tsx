import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AiTraderChat } from './components/AiTraderChat';
import { AlertsManager } from './components/AlertsManager';
import { AuthModal } from './components/AuthModal';
import { CoinDetail } from './components/CoinDetail';
import { DataQualityMonitor } from './components/DataQualityMonitor';
import { DerivativesScanner } from './components/DerivativesScanner';
import { MarketHeader, NavTab } from './components/MarketHeader';
import { MarketOverview } from './components/MarketOverview';
import { MarketStructureScanner } from './components/MarketStructureScanner';
import { ScannerFilters, ScannerFilterState } from './components/ScannerFilters';
import { ScannerTable } from './components/ScannerTable';
import { WatchlistTable } from './components/WatchlistTable';
import { WhaleScanner } from './components/WhaleScanner';
import { AdminDashboard } from './components/admin/AdminDashboard';
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
  sortBy: 'bullScore',
  sortOrder: 'desc'
};

const TAB_ROUTES: Record<Exclude<NavTab, 'coin_detail'>, string> = {
  score: '/score',
  crash_risk: '/crash-risk',
  derivatives: '/derivatives',
  structure: '/structure',
  watchlist: '/watchlist',
  alerts: '/alerts',
  data_quality: '/data-quality',
  whales: '/whales',
  ai_trader: '/ai-trader',
  admin: '/admin'
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab: NavTab = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/coin/')) return 'coin_detail';
    if (p === '/crash-risk' || p === '/crash_risk') return 'crash_risk';
    if (p === '/derivatives') return 'derivatives';
    if (p === '/structure') return 'structure';
    if (p === '/watchlist') return 'watchlist';
    if (p === '/alerts') return 'alerts';
    if (p === '/data-quality' || p === '/data_quality') return 'data_quality';
    if (p === '/whales') return 'whales';
    if (p === '/ai-trader' || p === '/ai_trader') return 'ai_trader';
    if (p.startsWith('/admin')) return 'admin';
    return 'score';
  }, [location.pathname]);

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'coin_detail') return;
    const targetRoute = TAB_ROUTES[tab as keyof typeof TAB_ROUTES] || '/score';
    navigate(targetRoute);
  };

  const handleSelectCoin = useCallback((coinOrSymbol: NormalizedCoinData | string) => {
    const sym = typeof coinOrSymbol === 'string'
      ? coinOrSymbol
      : (coinOrSymbol.rawSymbol || coinOrSymbol.symbol);
    const clean = sym.replace(/[\/\-_]/g, '').toUpperCase();
    navigate(`/coin/${clean}`, { state: { from: location.pathname } });
  }, [navigate, location.pathname]);

  const [activeExchange, setActiveExchange] = useState<ExchangeId>('BINANCE');
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
        const unack = events.filter(e => e.status === 'TRIGGERED');
        setUnacknowledgedAlertsCount(unack.length);

        if (events.length > 0) {
          const newest = events[0];
          if (newest.id !== lastAlertEventId && newest.status === 'TRIGGERED') {
            setLastAlertEventId(newest.id);
            soundAlert.playAlertChime();
          }
        }
      }
    } catch {
      // ignore
    }
  }, [token, lastAlertEventId]);

  // Fetch Market Data & Overview with selected exchange
  const fetchMarketData = useCallback(async () => {
    setIsRefreshing(true);
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
      setIsRefreshing(false);
    }
  }, [activeExchange, checkAlertEvents]);

  useEffect(() => {
    checkAuth();
    fetchWatchlist();
  }, [checkAuth, fetchWatchlist]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 10000); // 10-second polling
    return () => clearInterval(interval);
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

    const order = filters.sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => {
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
      {/* Top Header & Navigation */}
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
        onRefresh={fetchMarketData}
        isRefreshing={isRefreshing}
        unacknowledgedAlertsCount={unacknowledgedAlertsCount}
      />

      {/* Main Container with Router Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-6">
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
                <div className="space-y-4">
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
                  />
                </div>
              </div>
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
              />
            }
          />
          <Route path="/ai_trader" element={<Navigate to="/ai-trader" replace />} />

          {/* Route 10: COIN DETAIL (URL is Single Source of Truth) */}
          <Route
            path="/coin/:symbol"
            element={
              <CoinDetailRoutePage
                coins={coins}
                watchlistSymbols={watchlistSymbols}
                onToggleWatchlist={handleToggleWatchlist}
                onOpenAlertModal={handleOpenAlertForCoin}
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

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/score" replace />} />
        </Routes>
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

      {/* User Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

function CoinDetailRoutePage({
  coins,
  watchlistSymbols,
  onToggleWatchlist,
  onOpenAlertModal
}: {
  coins: NormalizedCoinData[];
  watchlistSymbols: string[];
  onToggleWatchlist: (symbol: string) => void;
  onOpenAlertModal: (symbol: string) => void;
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
    />
  );
}
