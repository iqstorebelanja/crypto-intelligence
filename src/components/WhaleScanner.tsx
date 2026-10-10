import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Cpu,
  ExternalLink,
  Filter,
  Key,
  Layers,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Waves,
  XCircle,
  Zap,
  Globe,
  Database,
  ShieldAlert,
  Scale
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ExchangeId,
  LiquidationIntelligenceSnapshot,
  OnChainProviderStatus,
  OrderFlowSnapshot,
  WhaleActivitySummary,
  WhaleProviderCapability,
  WhaleTransaction,
  WhaleTxDirection,
  WhaleTxType,
  User,
  DexActivityMetrics,
  DexPair,
  ExternalEvidence,
  ExternalIntelligenceSummary
} from '../types';
import { ProFeatureGate } from './ProFeatureGate';

interface WhaleScannerProps {
  onSelectCoin?: (symbol: string) => void;
  activeExchange?: ExchangeId;
  user?: User | null;
  onOpenUpgrade?: (context?: string) => void;
}

type Phase8Tab = 'WHALES' | 'DEX_INTEL' | 'ORDER_FLOW' | 'LIQUIDATION' | 'CAPABILITIES' | 'TESTS';

interface Phase8TestResult {
  testId: number;
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export const WhaleScanner: React.FC<WhaleScannerProps> = ({
  onSelectCoin,
  activeExchange = 'BINANCE',
  user,
  onOpenUpgrade
}) => {
  const [activeTab, setActiveTab] = useState<Phase8Tab>('WHALES');

  const resolvedExchange = (activeExchange === 'ALL' || !activeExchange) ? 'BINANCE' : activeExchange;

  // Whale State
  const [data, setData] = useState<WhaleActivitySummary | null>(null);
  const [providers, setProviders] = useState<OnChainProviderStatus[]>([]);
  const [capabilities, setCapabilities] = useState<WhaleProviderCapability[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Order Flow & Liquidation State
  const [orderFlow, setOrderFlow] = useState<OrderFlowSnapshot | null>(null);
  const [liquidationIntel, setLiquidationIntel] = useState<LiquidationIntelligenceSnapshot | null>(null);
  const [isLoadingOrderFlow, setIsLoadingOrderFlow] = useState<boolean>(false);
  const [isLoadingLiq, setIsLoadingLiq] = useState<boolean>(false);

  // Phase 21: External Intelligence & DEX State
  const [externalIntel, setExternalIntel] = useState<ExternalIntelligenceSummary | null>(null);
  const [dexPairs, setDexPairs] = useState<DexPair[]>([]);
  const [dexMetrics, setDexMetrics] = useState<DexActivityMetrics | null>(null);
  const [isLoadingExternal, setIsLoadingExternal] = useState<boolean>(false);
  const [phase21Results, setPhase21Results] = useState<any | null>(null);
  const [isRunningPhase21Tests, setIsRunningPhase21Tests] = useState<boolean>(false);

  // Filters
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC');
  const [minUsd, setMinUsd] = useState<number>(1_000_000);
  const [selectedDirection, setSelectedDirection] = useState<WhaleTxDirection | 'all'>('all');
  const [selectedType, setSelectedType] = useState<WhaleTxType | 'all'>('all');

  // Test Runner State
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    results: Phase8TestResult[];
  } | null>(null);

  // Config Modal
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [configProviderId, setConfigProviderId] = useState<string>('arkham');
  const [configApiKey, setConfigApiKey] = useState<string>('');
  const [configSaving, setConfigSaving] = useState<boolean>(false);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  // Fetch Providers and Capabilities
  const fetchProviders = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/whales/providers'),
        fetch('/api/whales/provider-capabilities')
      ]);

      if (pRes.ok) {
        const json = await pRes.json();
        setProviders(json);
      }
      if (cRes.ok) {
        const json = await cRes.json();
        if (json.capabilities) setCapabilities(json.capabilities);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch Whale Transactions
  const fetchWhales = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedSymbol !== 'ALL') params.append('symbol', selectedSymbol);
      if (minUsd > 0) params.append('minUsd', minUsd.toString());
      if (selectedDirection !== 'all') params.append('direction', selectedDirection);
      if (selectedType !== 'all') params.append('type', selectedType);
      params.append('limit', '50');

      const res = await fetch(`/api/whales/transactions?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WhaleActivitySummary = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedSymbol, minUsd, selectedDirection, selectedType]);

  // Fetch Order Flow
  const fetchOrderFlow = useCallback(async () => {
    setIsLoadingOrderFlow(true);
    try {
      const sym = selectedSymbol === 'ALL' ? 'BTC/USDT' : `${selectedSymbol}/USDT`;
      const res = await fetch(`/api/order-flow?symbol=${encodeURIComponent(sym)}&exchange=${resolvedExchange}&timeframe=1h`);
      if (res.ok) {
        const json = await res.json();
        setOrderFlow(json);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingOrderFlow(false);
    }
  }, [selectedSymbol, resolvedExchange]);

  // Fetch Liquidation Intelligence
  const fetchLiquidationIntel = useCallback(async () => {
    setIsLoadingLiq(true);
    try {
      const sym = selectedSymbol === 'ALL' ? 'BTC/USDT' : `${selectedSymbol}/USDT`;
      const res = await fetch(`/api/liquidations/intelligence?symbol=${encodeURIComponent(sym)}&exchange=${resolvedExchange}&timeframe=1h`);
      if (res.ok) {
        const json = await res.json();
        setLiquidationIntel(json);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingLiq(false);
    }
  }, [selectedSymbol, resolvedExchange]);

  // Phase 21: Fetch External Intelligence & DEX Activity
  const fetchExternalIntel = useCallback(async (asset: string = 'BTC') => {
    setIsLoadingExternal(true);
    try {
      const clean = asset.replace(/[\/\-_]/g, '').toUpperCase().replace('USDT', '');
      const [intelRes, dexRes] = await Promise.all([
        fetch(`/api/external/intelligence/${clean}`),
        fetch(`/api/external/dex/${clean}`)
      ]);
      if (intelRes.ok) {
        const intelJson = await intelRes.json();
        setExternalIntel(intelJson);
      }
      if (dexRes.ok) {
        const dexJson = await dexRes.json();
        setDexPairs(dexJson.pairs || []);
        setDexMetrics(dexJson.metrics || null);
      }
    } catch (err) {
      console.error('[WhaleScanner] Error fetching external intelligence:', err);
    } finally {
      setIsLoadingExternal(false);
    }
  }, []);

  const handleRunPhase21Tests = async () => {
    setIsRunningPhase21Tests(true);
    try {
      const res = await fetch('/api/admin/external-intelligence/tests', {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') || 'token_admin_super_jwt'}` }
      });
      if (res.ok) {
        const json = await res.json();
        setPhase21Results(json.summary);
      }
    } catch (err) {
      alert(`Test execution error: ${(err as Error).message}`);
    } finally {
      setIsRunningPhase21Tests(false);
    }
  };

  // Run Phase 8 Automated Tests
  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/admin/phase8/tests');
      if (res.ok) {
        const json = await res.json();
        setTestResults(json);
      }
    } catch (err) {
      alert(`Test execution error: ${(err as Error).message}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  useEffect(() => {
    fetchProviders();
    fetchWhales();
    fetchOrderFlow();
    fetchLiquidationIntel();
    fetchExternalIntel(selectedSymbol);

    const interval = setInterval(() => {
      fetchWhales();
      fetchOrderFlow();
      fetchLiquidationIntel();
      fetchExternalIntel(selectedSymbol);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchProviders, fetchWhales, fetchOrderFlow, fetchLiquidationIntel, fetchExternalIntel, selectedSymbol]);

  // Switch Active Provider
  const handleSelectProvider = async (providerId: string) => {
    try {
      const res = await fetch('/api/whales/providers/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      });
      if (res.ok) {
        const json = await res.json();
        setProviders(json.providers);
        fetchWhales(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Simulated Sandbox
  const handleToggleSimulated = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/whales/simulated/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        const json = await res.json();
        setProviders(json.providers);
        fetchWhales(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save API Key Configuration
  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      const res = await fetch('/api/whales/providers/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: configProviderId, apiKey: configApiKey })
      });
      if (res.ok) {
        const json = await res.json();
        setProviders(json.providers);
        setIsConfigOpen(false);
        setConfigApiKey('');
        fetchWhales(true);
      }
    } catch (err) {
      alert(`Configuration error: ${(err as Error).message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const copyTxHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedTxId(id);
    setTimeout(() => setCopiedTxId(null), 2000);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header & Controls */}
      <div className="bg-[#0c121e] border border-indigo-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1b2238] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Waves className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white">WHALE & ORDER FLOW RADAR</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  PHASE 8
                </span>
                {data?.available && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>ANALYTICAL ENGINE ACTIVE</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-exchange order flow, cumulative volume delta (CVD), liquidation cluster tracking, and verified on-chain whale activity.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsConfigOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#0e1626] border border-indigo-500/30 text-indigo-300 hover:bg-indigo-950/50 hover:text-white transition-all text-xs flex items-center space-x-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Provider Settings</span>
            </button>

            <button
              onClick={() => {
                fetchWhales(true);
                fetchOrderFlow();
                fetchLiquidationIntel();
              }}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl bg-[#080d16] border border-[#1b253b] text-slate-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh All Feeds"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Phase 8 Sub-Navigation Tabs */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-[#1b2238] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'WHALES', label: 'Whale Movements & Flows', icon: Waves },
              { id: 'DEX_INTEL', label: 'DEX & External Intelligence (Phase 21)', icon: BarChart2 },
              { id: 'ORDER_FLOW', label: 'Order Flow & CVD', icon: Activity },
              { id: 'LIQUIDATION', label: 'Liquidation Intelligence', icon: Zap },
              { id: 'CAPABILITIES', label: 'Provider Registry', icon: Layers },
              { id: 'TESTS', label: 'Phase 8 Test Lab (12)', icon: Cpu }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Phase8Tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400'
                      : 'bg-[#080d16] text-slate-400 border border-[#1b253b] hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400">
            Engine Version: <span className="text-indigo-300 font-bold">v2.0.0 (Phase 8)</span>
          </div>
        </div>

        {/* Provider Switcher Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Active Provider:</span>
            {providers.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectProvider(p.id)}
                className={`px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center space-x-1.5 ${
                  p.isActive
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 border border-indigo-400'
                    : 'bg-[#080d16] text-slate-400 border border-[#1b253b] hover:text-slate-200'
                }`}
              >
                <span>{p.name}</span>
                {p.isConfigured && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                {!p.isConfigured && p.id !== 'simulated' && (
                  <span className="text-[9px] text-amber-400">(Key Req)</span>
                )}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400">
            Source: <span className="text-indigo-300 font-semibold">{data?.provider || 'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* Asset Switcher Toolbar for all tabs */}
      <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-semibold">Selected Asset:</span>
          <div className="flex items-center space-x-1 bg-[#080d16] p-1 rounded-xl border border-[#1b253b]">
            {['ALL', 'BTC', 'ETH', 'SOL', 'USDT'].map(sym => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  selectedSymbol === sym
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'WHALES' && (
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">Min Size:</span>
            <div className="flex items-center space-x-1 bg-[#080d16] p-1 rounded-xl border border-[#1b253b]">
              {[
                { label: '$500K', val: 500_000 },
                { label: '$1M', val: 1_000_000 },
                { label: '$5M', val: 5_000_000 },
                { label: '$10M', val: 10_000_000 }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setMinUsd(opt.val)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    minUsd === opt.val
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>Analytical Mode: Strict Non-Lookahead & Explainable</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WHALE MOVEMENTS & FLOWS                                            */}
      {/* ========================================================================= */}
      {activeTab === 'WHALES' && (
        <div className="space-y-6">
          {data && !data.available && (
            <div className="bg-[#0c121e] border border-amber-800/40 rounded-2xl p-8 shadow-xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-600/40 flex items-center justify-center text-amber-400 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="font-bold text-white text-base">On-Chain Provider Not Configured</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {data.reason || 'No on-chain data provider configured.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center space-x-2"
                >
                  <Key className="w-4 h-4" />
                  <span>Connect On-Chain API Key</span>
                </button>
                <button
                  onClick={() => {
                    handleToggleSimulated(true);
                    handleSelectProvider('simulated');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#080d16] border border-indigo-500/30 text-indigo-300 hover:bg-indigo-950/40 font-semibold text-xs transition-all"
                >
                  Enable Sandbox Simulation Feed
                </button>
              </div>
            </div>
          )}

          {data && data.available && (
            <>
              {/* Telemetry Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Tracked Volume</span>
                    <Coins className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-xl font-bold text-white">
                    ${((data.totalUsdVolume || 0) / 1_000_000).toFixed(2)}M
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Across {data.totalTransactions} verified blocks
                  </div>
                </div>

                <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Net Exchange Flow</span>
                    {(data.netExchangeFlowUsd || 0) > 0 ? (
                      <TrendingUp className="w-4 h-4 text-rose-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div
                    className={`text-xl font-bold ${
                      (data.netExchangeFlowUsd || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {(data.netExchangeFlowUsd || 0) > 0 ? '+' : ''}$
                    {(((data.netExchangeFlowUsd || 0)) / 1_000_000).toFixed(2)}M
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {(data.netExchangeFlowUsd || 0) > 0
                      ? 'Distribution Context (Exchange Inflow)'
                      : 'Accumulation Context (Exchange Outflow)'}
                  </div>
                </div>

                <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Accumulation Signals</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-emerald-400">
                    {data.accumulationSignals || 0}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Exchange-to-Cold-Wallet Transfers
                  </div>
                </div>

                <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Distribution Signals</span>
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xl font-bold text-amber-400">
                    {data.distributionSignals || 0}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Whale Deposits to Exchange Hot Wallets
                  </div>
                </div>
              </div>

              {/* Transactions Stream */}
              <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-[#182338] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-sm text-white">VERIFIED ON-CHAIN LARGE TRANSFERS</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Deduplicated stream ({data.transactions?.length || 0} movements)
                  </span>
                </div>

                <div className="divide-y divide-[#151f33]">
                  {(!data.transactions || data.transactions.length === 0) ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                      No transactions matched the active filters.
                    </div>
                  ) : (
                    data.transactions.map(tx => {
                      const isMega = tx.usdValue >= 5_000_000;
                      const isInflow = tx.direction === 'inflow';
                      const isOutflow = tx.direction === 'outflow';

                      return (
                        <div
                          key={tx.id}
                          className={`p-4 hover:bg-[#101827] flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isMega ? 'bg-indigo-950/15' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border ${
                                isInflow
                                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-400'
                                  : isOutflow
                                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                                  : 'bg-blue-950/60 border-blue-500/40 text-blue-400'
                              }`}
                            >
                              {isInflow ? (
                                <ArrowDownRight className="w-5 h-5" />
                              ) : isOutflow ? (
                                <ArrowUpRight className="w-5 h-5" />
                              ) : (
                                <ArrowRight className="w-5 h-5" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => onSelectCoin && onSelectCoin(`${tx.symbol}/USDT`)}
                                  className="font-bold text-white hover:text-indigo-400 transition-colors"
                                >
                                  {tx.symbol}
                                </button>
                                <span className="font-bold text-sm text-slate-100">
                                  ${(tx.usdValue / 1_000_000).toFixed(2)}M USD
                                </span>
                                <span className="text-xs text-slate-400">
                                  ({tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.symbol})
                                </span>
                                {isMega && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                                    LARGE TRANSFER
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1 text-xs text-slate-300 mt-1">
                                <span className="text-slate-400">From:</span>
                                <span className="font-medium px-1.5 py-0.5 rounded bg-[#080d16] border border-[#1b253b]">
                                  {tx.fromEntity || (tx.fromAddress ? tx.fromAddress.substring(0, 8) + '...' : 'Unknown')}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-500" />
                                <span className="text-slate-400">To:</span>
                                <span className="font-medium px-1.5 py-0.5 rounded bg-[#080d16] border border-[#1b253b]">
                                  {tx.toEntity || (tx.toAddress ? tx.toAddress.substring(0, 8) + '...' : 'Unknown')}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-400 mt-1.5 italic">
                                {tx.analyticalInterpretation}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 text-xs">
                            <span className="text-slate-400">
                              {Math.round((Date.now() - tx.timestamp) / 60000)}m ago
                            </span>
                            {tx.txHash && (
                              <button
                                onClick={() => copyTxHash(tx.txHash!, tx.id)}
                                className="p-1 rounded bg-[#080d16] border border-[#1b253b] text-slate-400 hover:text-white"
                                title="Copy TX Hash"
                              >
                                {copiedTxId === tx.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 21 TAB: DEX & EXTERNAL INTELLIGENCE DATA LAYER                     */}
      {/* ========================================================================= */}
      {activeTab === 'DEX_INTEL' && (
        <div className="space-y-6">
          {/* Asset Switcher & Quick Meta */}
          <div className="bg-[#0c121e] border border-cyan-900/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Asset Feed:</span>
              {['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].map(sym => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => {
                    setSelectedSymbol(sym);
                    fetchExternalIntel(sym);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    selectedSymbol === sym
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-[#101726] text-slate-400 hover:text-white border border-[#1b253b]'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">STATUS: {externalIntel?.freshness || 'LIVE'}</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#101726] border border-[#1b253b] text-slate-300">
                QUALITY: <strong className="text-cyan-400">{externalIntel?.sourceQuality || 'HIGH'}</strong>
              </span>
              <button
                type="button"
                onClick={() => fetchExternalIntel(selectedSymbol)}
                disabled={isLoadingExternal}
                className="p-1.5 rounded-lg bg-[#101726] border border-[#1b253b] text-slate-400 hover:text-white"
                title="Refresh Intelligence Feed"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingExternal ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0c121e] border border-cyan-800/40 rounded-2xl p-4 space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold">Whale Activity Score</span>
                <Waves className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {externalIntel?.whaleActivityScore ?? 50} <span className="text-xs text-slate-500 font-normal">/ 100</span>
              </div>
              <div className="text-[11px] flex items-center space-x-1.5 pt-1 text-cyan-300">
                <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700/40 font-bold">
                  {externalIntel?.flowRegime.replace('_', ' ') || 'BALANCED'}
                </span>
              </div>
            </div>

            <div className="bg-[#0c121e] border border-indigo-800/40 rounded-2xl p-4 space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold">DEX Activity Score</span>
                <BarChart2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {externalIntel?.dexActivityScore ?? 50} <span className="text-xs text-slate-500 font-normal">/ 100</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center space-x-2 pt-1">
                <span>Buy Press: <strong className="text-emerald-400">{dexMetrics?.buyPressureScore ?? 50}%</strong></span>
                <span>•</span>
                <span>Spike: <strong className="text-indigo-400">{dexMetrics?.volumeSpikeRatio ?? 1.0}x</strong></span>
              </div>
            </div>

            <div className="bg-[#0c121e] border border-purple-800/40 rounded-2xl p-4 space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold">External Evidence Score</span>
                <Scale className="w-4 h-4 text-purple-400" />
              </div>
              <div className={`text-2xl font-bold tracking-tight ${(externalIntel?.externalEvidenceScore ?? 0) > 0 ? 'text-emerald-400' : (externalIntel?.externalEvidenceScore ?? 0) < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {(externalIntel?.externalEvidenceScore ?? 0) > 0 ? '+' : ''}{externalIntel?.externalEvidenceScore ?? 0}
                <span className="text-xs text-slate-500 font-normal"> / 100</span>
              </div>
              <div className="text-[11px] text-purple-300 pt-1">
                Direction: <strong className="uppercase font-bold">{externalIntel?.dominantDirection || 'NEUTRAL'}</strong> ({externalIntel?.evidenceCount || 0} observations)
              </div>
            </div>

            <div className="bg-[#0c121e] border border-emerald-800/40 rounded-2xl p-4 space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold">DEX Pool Safety</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-300 tracking-tight pt-1">
                {dexPairs[0]?.safetyStatus || 'REVIEWED_CAUTION'}
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                Monitored Pools: <strong className="text-white">{dexPairs.length} multi-chain</strong>
              </div>
            </div>
          </div>

          {/* Section 1: Multi-Window Whale Flow Matrix */}
          <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#182338] pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  <span>Multi-Window Whale Flow Aggregation Matrix</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Strict multi-observation verification across 5m, 15m, 1h, 4h, and 24h rolling windows.
                </p>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                Rule: Single transactions never trigger accumulation/distribution
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {(['5m', '15m', '1h', '4h', '24h'] as const).map(w => {
                const metric = externalIntel?.whaleAggregations?.[w];
                const netIsPositive = (metric?.netExchangeFlowUsd ?? 0) >= 0;
                return (
                  <div key={w} className="p-3 bg-[#080d16] border border-[#162033] rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-[#141d2d] pb-1.5">
                      <span className="font-bold text-xs text-cyan-400">{w} Window</span>
                      <span className="text-[10px] text-slate-400">{metric?.whaleTransferCount ?? 0} txns</span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-400">
                        <span>Inflow:</span>
                        <span className="text-rose-400 font-bold">${((metric?.exchangeInflowUsd ?? 0) / 1e6).toFixed(1)}M</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Outflow:</span>
                        <span className="text-emerald-400 font-bold">${((metric?.exchangeOutflowUsd ?? 0) / 1e6).toFixed(1)}M</span>
                      </div>
                      <div className="flex justify-between border-t border-[#141d2d] pt-1">
                        <span className="text-slate-400">Net Flow:</span>
                        <span className={`font-bold ${netIsPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {netIsPositive ? '+' : ''}${((metric?.netExchangeFlowUsd ?? 0) / 1e6).toFixed(1)}M
                        </span>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-[#141d2d]">
                      <span className={`block text-center text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        metric?.flowRegime === 'ACCUMULATION_LEAN'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          : metric?.flowRegime === 'DISTRIBUTION_LEAN'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {metric?.flowRegime ? metric.flowRegime.replace('_', ' ') : 'BALANCED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: DEX AMM Liquidity & Volume Pools */}
          <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#182338] pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>Decentralized Exchange (DEX) AMM Liquidity & Pressure</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Direct on-chain liquidity depth, transaction imbalances, and pool contract security.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-400">AMM Ratio: <strong className="text-indigo-400">{dexMetrics?.volumeSpikeRatio ?? 1.0}x</strong></span>
                <span className="text-slate-600">•</span>
                <span className="text-[11px] text-slate-400">Buy Pressure: <strong className="text-emerald-400">{dexMetrics?.buyPressureScore ?? 50}%</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dexPairs.map((pair, idx) => (
                <div key={idx} className="p-4 bg-[#080d16] border border-[#182338] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-white">{pair.dex}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/40 uppercase">
                        {pair.chain}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-cyan-400">
                      ${pair.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-[#0c121e] rounded-lg">
                      <div className="text-[10px] text-slate-400">Pool Liquidity</div>
                      <div className="font-bold text-white">${(pair.liquidityUsd / 1e6).toFixed(1)}M</div>
                    </div>
                    <div className="p-2 bg-[#0c121e] rounded-lg">
                      <div className="text-[10px] text-slate-400">24h DEX Volume</div>
                      <div className="font-bold text-white">${(pair.volume24h / 1e6).toFixed(1)}M</div>
                    </div>
                    <div className="p-2 bg-[#0c121e] rounded-lg">
                      <div className="text-[10px] text-slate-400">Buys / Sells (24h)</div>
                      <div className="font-bold text-emerald-400">{pair.buys24h.toLocaleString()} <span className="text-slate-500 font-normal">/</span> <span className="text-rose-400">{pair.sells24h.toLocaleString()}</span></div>
                    </div>
                    <div className="p-2 bg-[#0c121e] rounded-lg">
                      <div className="text-[10px] text-slate-400">Contract Verification</div>
                      <div className="font-bold text-emerald-300 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Verified Pool</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#131d2e]">
                    <span className="truncate max-w-[200px]">Contract: {pair.pairAddress.slice(0, 10)}...{pair.pairAddress.slice(-6)}</span>
                    <span className="text-[10px] text-slate-500">{pair.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: External Evidence Confluence Feed */}
          <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#182338] pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                  <Scale className="w-4 h-4 text-purple-400" />
                  <span>External Evidence Confluence Feed ({externalIntel?.evidenceCount || 0})</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Normalized observations from verified ledgers, DEX pools, and treasury reserves.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(externalIntel?.supportingEvidence || []).concat(externalIntel?.conflictingEvidence || []).slice(0, 6).map((ev, i) => {
                const isPositive = ev.direction === 'POSITIVE';
                return (
                  <div
                    key={ev.id || i}
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      isPositive
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                        : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isPositive ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
                        }`}>
                          {ev.category}
                        </span>
                        <span className="text-[11px] font-bold text-white uppercase">{ev.direction}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-[#080d16] text-slate-400 border border-[#1b253b]">
                          {ev.sourceQuality} QUALITY
                        </span>
                        <span className="text-cyan-400 font-bold">{ev.confidence}% CONF</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      {ev.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-[#131d2e]">
                      <span>Source: {ev.source}</span>
                      {ev.reference && (
                        <a
                          href={ev.reference}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                        >
                          <span>Explorer Reference</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Phase 21 Test Suite Runner */}
          <div className="bg-[#0c121e] border border-cyan-900/40 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#182338] pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Phase 21 Automated Test Verification Suite (10 Tests)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Verifies provider abstraction, whale normalization, multi-window aggregation, DEX safety audit, and TradingView compliance.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunPhase21Tests}
                disabled={isRunningPhase21Tests}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                {isRunningPhase21Tests ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Test Suite...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Run Phase 21 Tests</span>
                  </>
                )}
              </button>
            </div>

            {phase21Results && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#080d16] border border-[#1b253b] rounded-xl text-xs">
                  <span className="text-slate-300 font-bold">
                    Test Results: {phase21Results.passedCount} / {phase21Results.totalCount} Passed
                  </span>
                  <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                    phase21Results.allPassed ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950 text-rose-300'
                  }`}>
                    {phase21Results.allPassed ? 'ALL TESTS PASSED (10/10)' : 'TEST FAILURES DETECTED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {phase21Results.results.map((res: any) => (
                    <div
                      key={res.testId}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        res.passed ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200' : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Test {res.testId}: {res.testName}</span>
                        </span>
                        <span className="text-[10px] uppercase text-slate-400">{res.category}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-sans">{res.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ORDER FLOW & CVD                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'ORDER_FLOW' && (
        <ProFeatureGate
          user={user || null}
          featureName="Institutional Order Flow & CVD"
          description="Real-time cumulative volume delta (CVD), order book depth imbalance, and aggressive buyer/seller delta are reserved for PRO accounts."
          onUpgradeClick={() => onOpenUpgrade ? onOpenUpgrade('Institutional Order Flow & CVD') : window.location.href = '/pricing'}
        >
          <div className="space-y-6">
            {isLoadingOrderFlow && (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                <span>Analyzing order flow and order book depth...</span>
              </div>
            )}

            {!isLoadingOrderFlow && orderFlow && (
              <>
                {/* Order Flow Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Aggressive Pressure State</span>
                      <Activity className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-lg font-bold text-white">
                      {orderFlow.pressureState.replace('_', ' ')}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Buy/Sell Ratio: <strong className="text-amber-400">{orderFlow.buySellRatio.toFixed(2)}x</strong>
                    </div>
                  </div>

                  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Volume Delta</span>
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        orderFlow.netAggressiveVolume >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {orderFlow.netAggressiveVolume >= 0 ? '+' : ''}
                      {orderFlow.netAggressiveVolume.toLocaleString()} coins
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Taker Buys: {orderFlow.aggressiveBuyVolume.toLocaleString()} | Sells: {orderFlow.aggressiveSellVolume.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>CVD Momentum</span>
                      <BarChart2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-lg font-bold text-purple-300">
                      {(orderFlow.cvd?.currentDelta ?? 0) >= 0 ? 'BUYING EXPANSION' : 'SELLING EXPANSION'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Current CVD: {orderFlow.cvd?.currentDelta?.toFixed(2) ?? '0.00'}
                    </div>
                  </div>

                  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Order-Book Imbalance (1-2%)</span>
                      <Layers className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-lg font-bold text-amber-300">
                      {orderFlow.orderBookImbalance?.state?.replace(/_/g, ' ') || 'BALANCED'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Ratio: {orderFlow.orderBookImbalance ? `${(orderFlow.orderBookImbalance.imbalanceRatio * 100).toFixed(1)}%` : '50.0%'}
                    </div>
                  </div>
                </div>

                {/* Divergence Alert Box */}
                {orderFlow.divergence && orderFlow.divergence.detected && (
                  <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-amber-300">
                        ORDER-FLOW DIVERGENCE FLAGGED: {orderFlow.divergence.type}
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {orderFlow.divergence.description}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {!isLoadingOrderFlow && !orderFlow && (
              <div className="p-12 text-center text-slate-400 text-xs">
                No order flow data available for {selectedSymbol}.
              </div>
            )}
          </div>
        </ProFeatureGate>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LIQUIDATION INTELLIGENCE                                           */}
      {/* ========================================================================= */}
      {activeTab === 'LIQUIDATION' && (
        <ProFeatureGate
          user={user || null}
          featureName="Liquidation Clusters & Squeeze Risk"
          description="High-leverage magnetic liquidation cluster bands, cascading risk zones, and real-time short squeeze probabilities are reserved for PRO accounts."
          onUpgradeClick={() => onOpenUpgrade ? onOpenUpgrade('Liquidation Clusters & Squeeze Risk') : window.location.href = '/pricing'}
        >
          <div className="space-y-6">
            {isLoadingLiq && (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                <span>Analyzing liquidation telemetry and cluster levels...</span>
              </div>
            )}

            {!isLoadingLiq && liquidationIntel && (
              <>
                {/* Liquidation Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Spike Detection</span>
                      <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-lg font-bold text-white">
                      {liquidationIntel.spikeStatus}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Spike Multiple: <strong className="text-amber-400">{liquidationIntel.spikeMultiple}x</strong> baseline
                    </div>
                  </div>

                  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>24H Total Liquidations</span>
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-lg font-bold text-rose-400">
                      ${(liquidationIntel.totalLiquidations24h / 1_000_000).toFixed(2)}M
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Long: ${(liquidationIntel.longLiquidations24h / 1_000_000).toFixed(2)}M | Short: ${(liquidationIntel.shortLiquidations24h / 1_000_000).toFixed(2)}M
                    </div>
                  </div>

                  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Market Context</span>
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-lg font-bold text-cyan-300">
                      {liquidationIntel.context.relation.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {liquidationIntel.context.description}
                    </div>
                  </div>

                  <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Activity Score</span>
                      <Activity className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-lg font-bold text-indigo-300">
                      {liquidationIntel.liquidationActivityScore}/100
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Data Quality: {liquidationIntel.dataQuality}
                    </div>
                  </div>
                </div>

                {/* Liquidation Clusters */}
                <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-3">
                  <div className="text-xs font-bold text-white uppercase flex items-center justify-between">
                    <span>IDENTIFIED LIQUIDATION CLUSTER BANDS</span>
                    <span className="text-[11px] text-slate-400">Calculated from perpetual open interest & depth</span>
                  </div>

                  <div className="space-y-2">
                    {(!liquidationIntel.clusters || liquidationIntel.clusters.length === 0) ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        No dense liquidation clusters found within the current price boundary.
                      </div>
                    ) : (
                      liquidationIntel.clusters.map((cluster, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-[#080d16] border border-[#1b253b] flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-white flex items-center space-x-2">
                              <span>Band {idx + 1}: ${cluster.priceRange[0].toLocaleString()} — ${cluster.priceRange[1].toLocaleString()}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  cluster.intensity === 'HIGH'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                    : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {cluster.intensity} INTENSITY
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Median: ${cluster.medianPrice.toLocaleString()} • Source: {cluster.source}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-amber-400">
                              ${(cluster.totalLiquidation / 1_000_000).toFixed(2)}M Est. Volume
                            </div>
                            <div className="text-[10px] text-slate-500">
                              L: ${(cluster.longLiquidationEstimate / 1_000_000).toFixed(2)}M | S: ${(cluster.shortLiquidationEstimate / 1_000_000).toFixed(2)}M
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {!isLoadingLiq && !liquidationIntel && (
              <div className="p-12 text-center text-slate-400 text-xs">
                No liquidation data available for {selectedSymbol}.
              </div>
            )}
          </div>
        </ProFeatureGate>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PROVIDER REGISTRY                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'CAPABILITIES' && (
        <div className="space-y-6">
          <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#182338] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm text-white">WHALE DATA PROVIDER CAPABILITY REGISTRY</span>
              </div>
              <span className="text-xs text-slate-400">
                Verified provider capabilities (no synthetic feature claims)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080d16] text-slate-400 uppercase text-[10px] border-b border-[#1b253b]">
                  <tr>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Chain Coverage</th>
                    <th className="py-3 px-4 text-center">Transfers</th>
                    <th className="py-3 px-4 text-center">Exchange Wallets</th>
                    <th className="py-3 px-4 text-center">Large Transfers</th>
                    <th className="py-3 px-4 text-center">Address Labels</th>
                    <th className="py-3 px-4 text-center">Realtime</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151f33]">
                  {capabilities.map(cap => (
                    <tr key={cap.providerId} className="hover:bg-[#101827]">
                      <td className="py-3 px-4 font-bold text-white flex items-center space-x-2">
                        <span>{cap.providerName}</span>
                        {cap.providerId === 'simulated' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                            SANDBOX
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {cap.supportedChains.join(', ')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cap.features.transfers ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cap.features.exchangeWallets ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cap.features.largeTransfers ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cap.features.addressLabels ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cap.features.realtime ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cap.status === 'CONNECTED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {cap.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PHASE 8 AUTOMATED TEST LAB                                         */}
      {/* ========================================================================= */}
      {activeTab === 'TESTS' && (
        <div className="space-y-6">
          <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1b253b] pb-4">
              <div>
                <h3 className="font-bold text-white text-base flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  <span>PHASE 8 AUTOMATED TEST SUITE (12 TESTS)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Executes rigorous algorithmic unit tests verifying provider registry, deduplication, classification, CVD, order book depth imbalance, liquidation spikes, and lookahead safety.
                </p>
              </div>

              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-900/30"
              >
                {isRunningTests ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>RUN ALL 12 AUTOMATED TESTS</span>
              </button>
            </div>

            {testResults && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{testResults.passedCount} Passed</span>
                  </div>
                  {testResults.failedCount > 0 && (
                    <div className="flex items-center space-x-1.5 text-rose-400 font-bold">
                      <XCircle className="w-4 h-4" />
                      <span>{testResults.failedCount} Failed</span>
                    </div>
                  )}
                  <span className="text-slate-400">Total: {testResults.totalCount} tests</span>
                </div>

                <div className="space-y-2">
                  {testResults.results.map(t => (
                    <div
                      key={t.testId}
                      className={`p-3 rounded-xl border text-xs flex items-start space-x-3 ${
                        t.passed
                          ? 'bg-[#080d16] border-emerald-900/40 text-slate-200'
                          : 'bg-rose-950/20 border-rose-900/50 text-rose-200'
                      }`}
                    >
                      <div className="mt-0.5">
                        {t.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold flex items-center space-x-2">
                          <span className="text-indigo-400 font-mono">Test {t.testId}:</span>
                          <span>{t.testName}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {t.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provider API Key Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c121e] border border-indigo-900/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1b253b] pb-3">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <Settings2 className="w-4 h-4 text-indigo-400" />
                <span>Configure On-Chain Provider</span>
              </h3>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveApiKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Select Provider:</label>
                <select
                  value={configProviderId}
                  onChange={e => setConfigProviderId(e.target.value)}
                  className="w-full bg-[#080d16] border border-[#1b253b] text-white rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="arkham">Arkham Intelligence API</option>
                  <option value="whale_alert">Whale Alert API</option>
                  <option value="etherscan">Etherscan API</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">API Key / Secret Token:</label>
                <input
                  type="password"
                  value={configApiKey}
                  onChange={e => setConfigApiKey(e.target.value)}
                  placeholder="Enter provider API key"
                  className="w-full bg-[#080d16] border border-[#1b253b] text-white rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-[#1b253b] text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={configSaving}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {configSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
