import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Compass,
  DollarSign,
  Layers,
  Loader2,
  Percent,
  RefreshCw,
  ShieldAlert,
  Star,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { DataFreshness, RiskBadge, ScoreBadge, SignalBadge, WatchlistButton } from './Badges';
import { Candle, ExchangeId, NormalizedCoinData, PriceHistoryPoint, Timeframe, Alert } from '../types';
import { MiniPriceHistoryChart } from './MiniPriceHistoryChart';
import { PercentageAlertModal } from './PercentageAlertModal';
import { soundAlert } from '../utils/audioAlert';

export interface CoinDetailProps {
  coin?: NormalizedCoinData | null;
  symbol?: string;
  initialExchange?: ExchangeId;
  onClose?: () => void;
  isSavedInWatchlist: boolean;
  onToggleWatchlist: (symbol: string) => void;
  onOpenAlertModal?: (symbol: string) => void;
}

export const CoinDetail: React.FC<CoinDetailProps> = ({
  coin: initialCoin,
  symbol: initialSymbol,
  initialExchange,
  onClose,
  isSavedInWatchlist,
  onToggleWatchlist,
  onOpenAlertModal
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeSymbol = initialCoin?.rawSymbol || initialSymbol || '';
  const [coinData, setCoinData] = useState<NormalizedCoinData | null>(initialCoin || null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [history7d, setHistory7d] = useState<PriceHistoryPoint[]>(initialCoin?.history7d || []);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeId>(() => {
    const searchParams = new URLSearchParams(location.search);
    const exFromUrl = searchParams.get('exchange')?.toUpperCase() as ExchangeId | null;
    return exFromUrl || initialExchange || initialCoin?.exchange || 'BINANCE';
  });
  const [isLoadingTimeframe, setIsLoadingTimeframe] = useState(false);
  const [chartMode, setChartMode] = useState<'area' | 'candles'>('area');
  const [activeTab, setActiveTab] = useState<'chart' | 'derivatives' | 'structure' | 'scoring_breakdown'>('chart');
  const [isNotFound, setIsNotFound] = useState(false);
  const [isPercentageAlertModalOpen, setIsPercentageAlertModalOpen] = useState(false);
  const [coinAlerts, setCoinAlerts] = useState<Alert[]>([]);
  const [triggeredAlertBanner, setTriggeredAlertBanner] = useState<{
    alert: Alert;
    message: string;
    currentPrice: number;
  } | null>(null);

  // Fetch active alerts for this coin
  const fetchCoinAlerts = async (sym: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts', { headers });
      if (res.ok) {
        const allAlerts: Alert[] = await res.json();
        const cleanTarget = sym.replace(/[\/\-_]/g, '').toUpperCase();
        const filtered = allAlerts.filter(
          (a) => a.symbol.replace(/[\/\-_]/g, '').toUpperCase() === cleanTarget
        );
        setCoinAlerts(filtered);
      }
    } catch {
      // Ignore network errors
    }
  };

  const handleAlertDeleted = async (alertId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/${alertId}`, { method: 'DELETE', headers });
      if (res.ok) {
        setCoinAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const handleAlertToggled = async (alertId: string, active: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: !active })
      });
      if (res.ok) {
        setCoinAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, isActive: !active } : a))
        );
      }
    } catch (err) {
      console.error('Failed to toggle alert:', err);
    }
  };

  const handleBackToScanner = () => {
    if (onClose) {
      onClose();
      return;
    }
    const fromRoute = (location.state as any)?.from;
    navigate(fromRoute && fromRoute !== location.pathname ? fromRoute : '/score');
  };

  useEffect(() => {
    if (initialCoin) {
      setCoinData(initialCoin);
      const searchParams = new URLSearchParams(location.search);
      const exFromUrl = searchParams.get('exchange')?.toUpperCase() as ExchangeId | null;
      if (!exFromUrl && initialCoin.exchange && initialCoin.exchange !== selectedExchange) {
        setSelectedExchange(initialCoin.exchange);
      }
      if (initialCoin.history7d) {
        setHistory7d(initialCoin.history7d);
      }
      setIsNotFound(false);
      fetchCoinAlerts(initialCoin.symbol);
    }
  }, [initialCoin]);

  // Real-time evaluation of price move against active alerts
  useEffect(() => {
    if (!coinData || coinAlerts.length === 0) return;

    for (const a of coinAlerts) {
      if (!a.isActive) continue;
      const base = a.basePrice || (typeof a.threshold === 'number' ? a.threshold : 0);
      const pct = a.percentThreshold;

      if (base > 0 && pct) {
        const movePct = ((coinData.price - base) / base) * 100;
        let isTriggered = false;
        let desc = '';

        if (
          a.conditionType === 'PRICE_PCT_UP' &&
          (coinData.price >= (a.targetValue || base * (1 + pct / 100)) || movePct >= pct)
        ) {
          isTriggered = true;
          desc = `surged +${movePct.toFixed(2)}% (Target: +${pct}%)`;
        } else if (
          a.conditionType === 'PRICE_PCT_DOWN' &&
          (coinData.price <= (a.targetValue || base * (1 - pct / 100)) || movePct <= -pct)
        ) {
          isTriggered = true;
          desc = `dropped ${movePct.toFixed(2)}% (Target: -${pct}%)`;
        } else if (a.conditionType === 'PRICE_PCT_ANY' && Math.abs(movePct) >= pct) {
          isTriggered = true;
          desc = `moved ${movePct >= 0 ? '+' : ''}${movePct.toFixed(2)}% (Threshold: ±${pct}%)`;
        }

        if (isTriggered && (!triggeredAlertBanner || triggeredAlertBanner.alert.id !== a.id)) {
          setTriggeredAlertBanner({
            alert: a,
            message: `${coinData.symbol} ${desc}! Price: $${coinData.price.toLocaleString()}`,
            currentPrice: coinData.price
          });
          soundAlert.playAlertChime();
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification(`🚨 ${coinData.symbol} Alert Triggered`, {
              body: `${coinData.symbol} ${desc}! Current price: $${coinData.price.toLocaleString()}`,
              icon: '/favicon.ico'
            });
          }
        }
      }
    }
  }, [coinData?.price, coinAlerts]);

  const fetchDetail = async (tf: Timeframe, ex: ExchangeId, sym: string) => {
    if (!sym) return;
    setIsLoadingTimeframe(true);
    try {
      const cleanRaw = sym.replace(/[\/\-_]/g, '').toUpperCase();
      const res = await fetch(
        `/api/market/coin/${encodeURIComponent(cleanRaw)}?timeframe=${tf}&exchange=${ex}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.coin) {
          setCoinData(data.coin);
          if (data.coin.history7d) {
            setHistory7d(data.coin.history7d);
          }
          setIsNotFound(false);
        } else {
          setIsNotFound(true);
        }
        if (data.candles) {
          setCandles(data.candles);
        }
        if (data.history7d) {
          setHistory7d(data.history7d);
        }
      } else {
        setIsNotFound(true);
      }
    } catch (err) {
      console.error('Failed to load coin detail:', err);
      setIsNotFound(true);
    } finally {
      setIsLoadingTimeframe(false);
    }
  };

  useEffect(() => {
    if (activeSymbol) {
      fetchDetail(timeframe, selectedExchange, activeSymbol);
    }
  }, [timeframe, selectedExchange, activeSymbol]);

  if (isNotFound) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-[#0a0f19] border border-[#1e2a42] rounded-3xl p-8 sm:p-12 text-center space-y-5 font-mono">
        <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">Coin Not Found</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Trading pair <span className="text-rose-400 font-bold">{activeSymbol || 'UNKNOWN'}</span> is unavailable or not tracked on {selectedExchange}.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={handleBackToScanner}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all inline-flex items-center space-x-2 shadow-lg shadow-cyan-600/20"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>← Back to Scanner</span>
          </button>
        </div>
      </div>
    );
  }

  if (!coinData && isLoadingTimeframe) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-[#0a0f19] border border-[#1e2a42] rounded-3xl p-12 text-center space-y-4 font-mono">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
        <div className="text-sm text-slate-300">Loading {activeSymbol} market intelligence...</div>
        <div className="pt-2">
          <button
            onClick={handleBackToScanner}
            className="px-4 py-2 rounded-xl bg-[#111928] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#1e2a42] text-xs font-semibold inline-flex items-center space-x-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>← Back to Scanner</span>
          </button>
        </div>
      </div>
    );
  }

  if (!coinData) {
    return null;
  }

  // Calculate moving averages for chart
  const chartData = candles.map((c, idx) => {
    const ma20Slice = candles.slice(Math.max(0, idx - 19), idx + 1);
    const ma20 = ma20Slice.reduce((acc, curr) => acc + curr.close, 0) / ma20Slice.length;

    const ma50Slice = candles.slice(Math.max(0, idx - 49), idx + 1);
    const ma50 = idx >= 10 ? ma50Slice.reduce((acc, curr) => acc + curr.close, 0) / ma50Slice.length : null;

    const timeStr = new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      time: timeStr,
      timestamp: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      ma20: Math.round(ma20 * 100) / 100,
      ma50: ma50 ? Math.round(ma50 * 100) / 100 : null,
      isGreen: c.close >= c.open
    };
  });

  const { indicators, scores, marketStructure, derivatives } = coinData;

  const distMa20 = (((coinData.price - indicators.ma20) / indicators.ma20) * 100).toFixed(2);
  const distMa50 = (((coinData.price - indicators.ma50) / indicators.ma50) * 100).toFixed(2);
  const distMa200 = (((coinData.price - indicators.ma200) / indicators.ma200) * 100).toFixed(2);

  const formattedPrice =
    coinData.price < 0.001
      ? coinData.price.toFixed(6)
      : coinData.price < 1
      ? coinData.price.toFixed(4)
      : coinData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full max-w-7xl mx-auto font-mono text-slate-300 space-y-4">
      <div className="w-full bg-[#0a0f19] border border-[#1e2a42] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* ========================================== */}
        {/* 1. HEADER SECTION                          */}
        {/* ========================================== */}
        <div className="p-4 sm:p-5 bg-[#080d16] border-b border-[#18243a] flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBackToScanner}
              className="px-3 py-1.5 rounded-xl bg-[#111928] hover:bg-slate-800 text-cyan-400 hover:text-white border border-[#1e2a42] flex items-center space-x-1.5 text-xs font-bold transition-all shadow-sm"
              title="Return to Scanner"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>← Back to Scanner</span>
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-lg sm:text-xl tracking-wider">
                  {coinData.symbol}
                </span>

                {/* Multi-exchange switcher */}
                <div className="flex items-center bg-[#111928] border border-[#1d2b42] rounded-lg p-0.5 text-[10px]">
                  {(() => {
                    const availableExchanges: ExchangeId[] = (coinData.crossExchangeMarkets && coinData.crossExchangeMarkets.length > 0)
                      ? Array.from(new Set([coinData.exchange, ...coinData.crossExchangeMarkets.map(m => m.exchange)]))
                      : [coinData.exchange || 'BINANCE'];
                    
                    // Also make sure all 4 major exchanges can be inspected if desired
                    const displayExchanges = Array.from(new Set([...availableExchanges, 'BINANCE', 'OKX', 'PIONEX', 'BYBIT'] as ExchangeId[]));

                    return displayExchanges.map((ex) => {
                      const isHosted = availableExchanges.includes(ex);
                      const isCurrent = selectedExchange === ex;
                      return (
                        <button
                          key={ex}
                          onClick={() => setSelectedExchange(ex)}
                          className={`px-2 py-0.5 rounded transition-colors uppercase ${
                            isCurrent
                              ? 'bg-cyan-600 text-white font-bold'
                              : isHosted
                              ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                              : 'text-slate-600 hover:text-slate-400'
                          }`}
                          title={isHosted ? `${coinData.symbol} active on ${ex}` : `Switch query feed to ${ex}`}
                        >
                          {ex}
                        </button>
                      );
                    });
                  })()}
                </div>

                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {coinData.marketType || 'PERPETUAL'}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">{coinData.source}</div>
            </div>
          </div>

          {/* Quick Actions: Alert & Watchlist */}
          <div className="flex items-center space-x-3">
            {/* Direct In-Component Percentage Price Alert Trigger */}
            <button
              id="btn-coin-detail-percentage-alert"
              onClick={() => setIsPercentageAlertModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950/90 to-blue-950/90 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm group cursor-pointer"
              title="Set percentage price movement alert threshold directly for this coin"
            >
              <div className="relative flex items-center">
                <Percent className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                {coinAlerts.filter((a) => a.isActive).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <span>% PRICE ALERT</span>
              {coinAlerts.filter((a) => a.isActive).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold">
                  {coinAlerts.filter((a) => a.isActive).length}
                </span>
              )}
            </button>

            <WatchlistButton
              isSaved={isSavedInWatchlist}
              onClick={() => onToggleWatchlist(coinData.symbol)}
            />

            <DataFreshness
              seconds={coinData.freshnessSeconds}
              status={coinData.dataStatus}
            />

            <button
              onClick={handleBackToScanner}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Return to Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-time Percentage Alert Trigger Notification Banner */}
        {triggeredAlertBanner && (
          <div className="p-3 bg-gradient-to-r from-emerald-950/95 via-[#0b1b2d] to-cyan-950/95 border-b border-emerald-500/60 flex items-center justify-between text-xs animate-fadeIn px-4 sm:px-6">
            <div className="flex items-center space-x-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 animate-pulse border border-emerald-500/40">
                <Bell className="w-4 h-4" />
              </div>
              <div className="font-mono">
                <span className="font-bold text-emerald-300 mr-2 uppercase tracking-wide">
                  🚨 Threshold Triggered:
                </span>
                <span className="text-white font-medium">{triggeredAlertBanner.message}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsPercentageAlertModalOpen(true)}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 font-bold"
              >
                View Alerts
              </button>
              <button
                onClick={() => setTriggeredAlertBanner(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded"
                title="Dismiss Notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 2. PRICE & SCORING SUMMARY BAR WITH 7-DAY MINI CHART */}
        {/* ========================================== */}
        <div className="p-4 sm:p-5 bg-[#090e18] border-b border-[#141e30] grid grid-cols-1 xl:grid-cols-3 gap-4 text-xs">
          {/* Quick Telemetry Cards */}
          <div className="xl:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Price */}
            <div className="p-3 rounded-xl bg-[#0b111e] border border-[#172236] space-y-1">
              <span className="text-[10px] uppercase text-slate-400">Current Price</span>
              <div className="text-xl font-bold text-white tracking-tight">${formattedPrice}</div>
              <div
                className={`text-[11px] font-semibold flex items-center space-x-1 ${
                  coinData.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {coinData.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span>{coinData.change24h >= 0 ? `+${coinData.change24h.toFixed(2)}%` : `${coinData.change24h.toFixed(2)}%`} (24h)</span>
              </div>
            </div>

            {/* Bull Score */}
            <div className="p-3 rounded-xl bg-[#0b111e] border border-[#172236] space-y-1">
              <span className="text-[10px] uppercase text-slate-400">Bull Potential</span>
              <div className="pt-0.5">
                <ScoreBadge score={scores.bullScore} />
              </div>
              <div className="text-[10px] text-slate-500">Weight-Engineered</div>
            </div>

            {/* Downside Risk */}
            <div className="p-3 rounded-xl bg-[#0b111e] border border-[#172236] space-y-1">
              <span className="text-[10px] uppercase text-slate-400">Downside Risk</span>
              <div className="pt-0.5">
                <RiskBadge risk={scores.downsideRiskScore} />
              </div>
              <div className="text-[10px] text-slate-500">Defense Metric</div>
            </div>

            {/* 24h High / Low */}
            <div className="p-3 rounded-xl bg-[#0b111e] border border-[#172236] space-y-1">
              <span className="text-[10px] uppercase text-slate-400">24h High / Low</span>
              <div className="text-white font-bold">${coinData.high24h.toLocaleString()}</div>
              <div className="text-slate-400">${coinData.low24h.toLocaleString()}</div>
            </div>

            {/* Open Interest */}
            <div className="p-3 rounded-xl bg-[#0b111e] border border-[#172236] space-y-1">
              <span className="text-[10px] uppercase text-slate-400">Open Interest</span>
              <div className="text-white font-bold">
                {derivatives?.openInterestUsd != null ? `$${(derivatives.openInterestUsd / 1_000_000).toFixed(2)}M` : '—'}
              </div>
              <div className="text-[10px] text-slate-400">
                {derivatives?.openInterestChange24h != null ? (
                  <span className={derivatives.openInterestChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {derivatives.openInterestChange24h >= 0 ? '+' : ''}{derivatives.openInterestChange24h.toFixed(2)}% (24h)
                  </span>
                ) : 'Derivatives feed'}
              </div>
            </div>

            {/* Funding Rate */}
            <div className="p-3 rounded-xl bg-[#0b111e] border border-[#172236] space-y-1">
              <span className="text-[10px] uppercase text-slate-400">Funding Rate</span>
              <div className="text-cyan-300 font-bold">
                {derivatives?.fundingRate != null ? `${(derivatives.fundingRate * 100).toFixed(4)}%` : '—'}
              </div>
              <div className="text-[10px] text-slate-500">
                {derivatives?.fundingTrend ? `${derivatives.fundingTrend} Bias` : '8h Countdown'}
              </div>
            </div>
          </div>

          {/* Mini Interactive 7-Day Performance Chart */}
          <div className="xl:col-span-1 h-full flex flex-col justify-center">
            <MiniPriceHistoryChart
              history={history7d && history7d.length > 0 ? history7d : coinData.history7d}
              currentPrice={coinData.price}
              change24h={coinData.change24h}
              symbol={coinData.symbol}
              className="h-full"
            />
          </div>
        </div>

        {/* View Tabs Selector */}
        <div className="px-4 py-2 bg-[#080d16] border-b border-[#141e30] flex items-center space-x-2 text-xs">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'chart'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Price & Volume Chart
          </button>
          <button
            onClick={() => setActiveTab('derivatives')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'derivatives'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Derivatives & Open Interest
          </button>
          <button
            onClick={() => setActiveTab('structure')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'structure'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Market Structure & S/R
          </button>
          <button
            onClick={() => setActiveTab('scoring_breakdown')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'scoring_breakdown'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Score Attribution Model
          </button>
        </div>

        {/* ========================================== */}
        {/* 3. MAIN CONTENT BODY                       */}
        {/* ========================================== */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: CHART */}
          {activeTab === 'chart' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Timeframe selector */}
                <div className="flex items-center space-x-1 bg-[#111928] p-1 rounded-xl border border-[#1b263b] text-xs">
                  {(['5m', '15m', '1h', '4h', '1D'] as Timeframe[]).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        timeframe === tf
                          ? 'bg-cyan-500 text-black shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <span>Price</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-0.5 bg-amber-400" />
                    <span>MA 20</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-0.5 bg-purple-400" />
                    <span>MA 50</span>
                  </div>
                </div>
              </div>

              {/* Chart container */}
              <div className="h-72 sm:h-80 w-full bg-[#080d16] rounded-2xl p-2 sm:p-4 border border-[#162135]">
                {isLoadingTimeframe ? (
                  <div className="h-full flex items-center justify-center space-x-2 text-cyan-400 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Streaming {timeframe} candles...</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#141f33" vertical={false} />
                      <XAxis
                        dataKey="time"
                        stroke="#475569"
                        tick={{ fontSize: 10, fontFamily: 'monospace' }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        stroke="#475569"
                        tick={{ fontSize: 10, fontFamily: 'monospace' }}
                        tickFormatter={v => `$${v < 1 ? v.toFixed(3) : v.toLocaleString()}`}
                        orientation="right"
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0c1322',
                          borderColor: '#1e2b45',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        name="Close Price"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#priceAreaGrad)"
                      />
                      <Line
                        type="monotone"
                        dataKey="ma20"
                        name="MA 20"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="ma50"
                        name="MA 50"
                        stroke="#a855f7"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Technical indicators grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">RSI (14)</div>
                  <div className="text-base font-bold text-white mt-0.5">{indicators.rsi14}</div>
                  <div className="text-[10px] text-slate-500">
                    {indicators.rsi14 >= 70 ? 'Overbought' : indicators.rsi14 <= 30 ? 'Oversold' : 'Neutral'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">RSI (6) Fast</div>
                  <div className="text-base font-bold text-cyan-300 mt-0.5">{indicators.rsi6}</div>
                  <div className="text-[10px] text-slate-500">Momentum</div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">MA 20</div>
                  <div className="text-base font-bold text-white mt-0.5">${indicators.ma20.toLocaleString()}</div>
                  <div className={`text-[10px] font-semibold ${coinData.price >= indicators.ma20 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {coinData.price >= indicators.ma20 ? `+${distMa20}% Above` : `${distMa20}% Below`}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">MA 50</div>
                  <div className="text-base font-bold text-white mt-0.5">${indicators.ma50.toLocaleString()}</div>
                  <div className={`text-[10px] font-semibold ${coinData.price >= indicators.ma50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {coinData.price >= indicators.ma50 ? `+${distMa50}% Above` : `${distMa50}% Below`}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">MA 200</div>
                  <div className="text-base font-bold text-white mt-0.5">${indicators.ma200.toLocaleString()}</div>
                  <div className={`text-[10px] font-semibold ${coinData.price >= indicators.ma200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {coinData.price >= indicators.ma200 ? `+${distMa200}% Above` : `${distMa200}% Below`}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">Vol Ratio (20-MA)</div>
                  <div className="text-base font-bold text-cyan-300 mt-0.5">{indicators.volumeAnalysis.ratio}x</div>
                  <div className="text-[10px] text-slate-500">
                    {indicators.volumeAnalysis.isSpike ? '⚡ Spike Active' : 'Normal Flow'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DERIVATIVES */}
          {activeTab === 'derivatives' && (
            <div className="space-y-4">
              {derivatives ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#0c1320] border border-[#18253b] space-y-1">
                      <div className="text-[10px] uppercase text-slate-400">Open Interest (USD)</div>
                      <div className="text-lg font-bold text-white">
                        {derivatives.openInterestUsd != null ? `$${(derivatives.openInterestUsd / 1_000_000).toFixed(2)}M` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {derivatives.openInterest != null ? `${derivatives.openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })} contracts` : '—'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0c1320] border border-[#18253b] space-y-1">
                      <div className="text-[10px] uppercase text-slate-400">OI 24h & 1h Change</div>
                      <div className={`text-lg font-bold ${(derivatives.openInterestChange24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {derivatives.openInterestChange24h != null ? `${derivatives.openInterestChange24h >= 0 ? '+' : ''}${derivatives.openInterestChange24h.toFixed(2)}%` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        1h Delta: {derivatives.openInterestChange1h != null ? `${derivatives.openInterestChange1h > 0 ? '+' : ''}${derivatives.openInterestChange1h.toFixed(2)}%` : '—'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0c1320] border border-[#18253b] space-y-1">
                      <div className="text-[10px] uppercase text-slate-400">Funding Rate (8h)</div>
                      <div className="text-lg font-bold text-cyan-300">
                        {derivatives.fundingRate != null ? `${(derivatives.fundingRate * 100).toFixed(4)}%` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Annualized: {derivatives.fundingRate != null ? `${(derivatives.fundingRate * 3 * 365 * 100).toFixed(1)}%` : '—'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0c1320] border border-[#18253b] space-y-1">
                      <div className="text-[10px] uppercase text-slate-400">Long / Short Ratio</div>
                      <div className="text-lg font-bold text-white">
                        {derivatives.longShortRatio?.ratio != null ? derivatives.longShortRatio.ratio.toFixed(2) : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {derivatives.longShortRatio?.ratio != null ? `${((derivatives.longShortRatio.ratio / (derivatives.longShortRatio.ratio + 1)) * 100).toFixed(0)}% Long Bias` : 'Standard'}
                      </div>
                    </div>
                  </div>

                  {/* Price + OI Interpretation Card */}
                  <div className="p-4 rounded-2xl bg-[#0d1424] border border-[#1c2942] space-y-2">
                    <div className="flex items-center space-x-2 text-cyan-400 text-xs">
                      <Layers className="w-4 h-4" />
                      <span className="font-bold uppercase tracking-wider">
                        PRICE + OPEN INTEREST DYNAMICS INTERPRETATION
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#080d16] border border-[#141f33] text-xs text-slate-300 leading-relaxed">
                      <div className="font-bold text-white mb-1">
                        Dynamic Regime: <span className="text-cyan-400">{derivatives.priceOiRelation.replace(/_/g, ' ')}</span>
                      </div>
                      <p>{derivatives.priceOiInterpretation}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Derivatives data currently loading or unavailable for this market feed.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MARKET STRUCTURE */}
          {activeTab === 'structure' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">Structural State</div>
                  <div className="text-sm font-bold text-cyan-300 mt-0.5">{marketStructure.state}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">Last Swing High</div>
                  <div className="text-base font-bold text-white mt-0.5">${marketStructure.lastSwingHigh.toLocaleString()}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">Last Swing Low</div>
                  <div className="text-base font-bold text-white mt-0.5">${marketStructure.lastSwingLow.toLocaleString()}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#0c1320] border border-[#18253b]">
                  <div className="text-[10px] uppercase text-slate-400">Detected Event</div>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">{marketStructure.event}</div>
                </div>
              </div>

              {/* S/R Levels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#0c1320] border border-[#18253b] space-y-1">
                  <div className="text-[10px] uppercase text-emerald-400 font-bold">Support Zones</div>
                  <div className="space-y-1">
                    {marketStructure.supportLevels.map((s, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300">
                        <span>Level #{idx + 1}</span>
                        <strong className="text-emerald-400">${s.toLocaleString()}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0c1320] border border-[#18253b] space-y-1">
                  <div className="text-[10px] uppercase text-rose-400 font-bold">Resistance Zones</div>
                  <div className="space-y-1">
                    {marketStructure.resistanceLevels.map((r, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300">
                        <span>Level #{idx + 1}</span>
                        <strong className="text-rose-400">${r.toLocaleString()}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Structural Narrative */}
              <div className="p-3.5 rounded-xl bg-[#0c1320] border border-[#18253b] text-xs text-slate-300 leading-relaxed">
                <strong className="text-white">Structural Synthesis: </strong>
                {marketStructure.description}
              </div>
            </div>
          )}

          {/* TAB 4: SCORING ATTRIBUTION MODEL */}
          {activeTab === 'scoring_breakdown' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#0c1320] border border-[#1a2842] space-y-3">
                <div className="flex items-center justify-between border-b border-[#18243a] pb-2">
                  <span className="font-bold text-white uppercase tracking-wider">
                    BULL SCORE FACTOR ATTRIBUTION (100% SCALE)
                  </span>
                  <ScoreBadge score={scores.bullScore} />
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Trend & Moving Average Alignment (Weight: 20%)</span>
                    <strong className="text-cyan-400">
                      {scores.bullBreakdown?.trendMA ? `${scores.bullBreakdown.trendMA.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>RSI Optimal Momentum Range (Weight: 10%)</span>
                    <strong className="text-cyan-400">
                      {scores.bullBreakdown?.rsi ? `${scores.bullBreakdown.rsi.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Volume Expansion & Spike Ratio (Weight: 15%)</span>
                    <strong className="text-cyan-400">
                      {scores.bullBreakdown?.volume ? `${scores.bullBreakdown.volume.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Bollinger Band Compression & %B (Weight: 10%)</span>
                    <strong className="text-cyan-400">
                      {scores.bullBreakdown?.bollingerBands ? `${scores.bullBreakdown.bollingerBands.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Short-term Price Momentum (Weight: 10%)</span>
                    <strong className="text-cyan-400">
                      {scores.bullBreakdown?.priceMomentum ? `${scores.bullBreakdown.priceMomentum.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Market Structure & Breakout Confirmation (Weight: 20%)</span>
                    <strong className="text-cyan-400">
                      {scores.bullBreakdown?.marketStructure ? `${scores.bullBreakdown.marketStructure.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Open Interest Inflow & Price Correlation (Weight: 10%)</span>
                    <strong className="text-cyan-400">
                      {scores.bullBreakdown?.openInterest ? `${scores.bullBreakdown.openInterest.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Funding Sentiment Factor (Weight: 5%)</span>
                    <strong className="text-cyan-400">
                      {scores.bullBreakdown?.funding ? `${scores.bullBreakdown.funding.score}/100` : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Downside Risk Breakdown */}
              <div className="p-4 rounded-2xl bg-[#0c1320] border border-[#1a2842] space-y-3">
                <div className="flex items-center justify-between border-b border-[#18243a] pb-2">
                  <span className="font-bold text-white uppercase tracking-wider">
                    DOWNSIDE RISK ATTRIBUTION (100% SCALE)
                  </span>
                  <RiskBadge score={scores.downsideRiskScore} />
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Overbought RSI Exhaustion</span>
                    <strong className="text-rose-400">
                      {scores.downsideRiskBreakdown?.rsiExtreme ? `${scores.downsideRiskBreakdown.rsiExtreme.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>MA Breakdown / Below Key Averages</span>
                    <strong className="text-rose-400">
                      {scores.downsideRiskBreakdown?.maBreakdown ? `${scores.downsideRiskBreakdown.maBreakdown.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Volume Breakdown / Sell Volume Dominance</span>
                    <strong className="text-rose-400">
                      {scores.downsideRiskBreakdown?.volumeWeakness ? `${scores.downsideRiskBreakdown.volumeWeakness.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Negative Price Momentum</span>
                    <strong className="text-rose-400">
                      {scores.downsideRiskBreakdown?.momentumLoss ? `${scores.downsideRiskBreakdown.momentumLoss.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Structural Breakdown & Support Loss</span>
                    <strong className="text-rose-400">
                      {scores.downsideRiskBreakdown?.bearishStructure ? `${scores.downsideRiskBreakdown.bearishStructure.score}/100` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Funding Squeeze / Derivatives Crowded Risk</span>
                    <strong className="text-rose-400">
                      {scores.downsideRiskBreakdown?.derivativesRisk ? `${scores.downsideRiskBreakdown.derivativesRisk.score}/100` : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Analytical Disclaimer */}
          <div className="p-3 rounded-xl bg-[#080d16] border border-[#131b2c] text-[10px] text-center text-slate-500">
            DISCLAIMER: Crypto Intelligence AI is an analytical and quantitative market research tool. It does not provide financial advice, predict price direction, or execute orders. All scores are mathematical models.
          </div>
        </div>
      </div>

      {/* Percentage Price Alert Threshold Modal */}
      {isPercentageAlertModalOpen && coinData && (
        <PercentageAlertModal
          isOpen={isPercentageAlertModalOpen}
          onClose={() => setIsPercentageAlertModalOpen(false)}
          coin={coinData}
          activeAlerts={coinAlerts}
          onAlertCreated={(newAlert) => {
            setCoinAlerts((prev) => [newAlert, ...prev]);
          }}
          onAlertDeleted={handleAlertDeleted}
          onAlertToggled={handleAlertToggled}
        />
      )}
    </div>
  );
};
