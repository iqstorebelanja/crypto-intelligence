import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Coins,
  Copy,
  ExternalLink,
  Filter,
  Key,
  Layers,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  OnChainProviderStatus,
  WhaleActivitySummary,
  WhaleTransaction,
  WhaleTxDirection,
  WhaleTxType
} from '../types';

interface WhaleScannerProps {
  onSelectCoin?: (symbol: string) => void;
}

export const WhaleScanner: React.FC<WhaleScannerProps> = ({ onSelectCoin }) => {
  const [data, setData] = useState<WhaleActivitySummary | null>(null);
  const [providers, setProviders] = useState<OnChainProviderStatus[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [minUsd, setMinUsd] = useState<number>(1_000_000);
  const [selectedDirection, setSelectedDirection] = useState<WhaleTxDirection | 'all'>('all');
  const [selectedType, setSelectedType] = useState<WhaleTxType | 'all'>('all');

  // Config Modal
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [configProviderId, setConfigProviderId] = useState<string>('arkham');
  const [configApiKey, setConfigApiKey] = useState<string>('');
  const [configSaving, setConfigSaving] = useState<boolean>(false);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  // Fetch Providers
  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/whales/providers');
      if (res.ok) {
        const json = await res.json();
        setProviders(json);
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

  useEffect(() => {
    fetchProviders();
    fetchWhales();
    const interval = setInterval(() => fetchWhales(), 20000);
    return () => clearInterval(interval);
  }, [fetchProviders, fetchWhales]);

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

  const activeProvider = providers.find(p => p.isActive);

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
                <span className="font-bold text-lg text-white">WHALE ACTIVITY INTELLIGENCE</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  PHASE 3
                </span>
                {data?.available && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>FEED LIVE</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Surveillance radar for multi-million dollar transfers, exchange wallet reserves, and institutional accumulation flows.
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
              onClick={() => fetchWhales(true)}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl bg-[#080d16] border border-[#1b253b] text-slate-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh Feed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Provider Switcher Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
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

      {/* When No Provider Available */}
      {data && !data.available && (
        <div className="bg-[#0c121e] border border-amber-800/40 rounded-2xl p-8 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-600/40 flex items-center justify-center text-amber-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="font-bold text-white text-base">On-Chain Provider Not Configured</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {data.reason || 'No on-chain data provider configured.'} Real institutional whale transactions require an active Arkham Intelligence, Whale Alert, or RPC connection.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsConfigOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center space-x-2 shadow-lg shadow-indigo-600/20"
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

      {/* Aggregate Telemetry Cards */}
      {data && data.available && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total USD Volume */}
          <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg space-y-1">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Tracked Volume</span>
              <Coins className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-bold text-white">
              ${((data.totalUsdVolume || 0) / 1_000_000).toFixed(2)}M
            </div>
            <div className="text-[11px] text-slate-400">
              Across {data.totalTransactions} institutional blocks
            </div>
          </div>

          {/* Card 2: Net Exchange Flow */}
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
                (data.netExchangeFlowUsd || 0) > 0
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}
            >
              {(data.netExchangeFlowUsd || 0) > 0 ? '+' : ''}$
              {(((data.netExchangeFlowUsd || 0)) / 1_000_000).toFixed(2)}M
            </div>
            <div className="text-[11px] text-slate-400">
              {(data.netExchangeFlowUsd || 0) > 0
                ? 'Net Inflow (Selling Pressure Risk)'
                : 'Net Outflow (Supply Accumulation)'}
            </div>
          </div>

          {/* Card 3: Accumulation Signals */}
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

          {/* Card 4: Distribution Signals */}
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
      )}

      {/* Filter Toolbar */}
      {data && data.available && (
        <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Symbol Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Asset:</span>
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

          {/* Minimum USD Size */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Min Size:</span>
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

          {/* Direction Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Flow:</span>
            <select
              value={selectedDirection}
              onChange={e => setSelectedDirection(e.target.value as any)}
              className="bg-[#080d16] border border-[#1b253b] text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Flows</option>
              <option value="inflow">Exchange Inflow (Deposit)</option>
              <option value="outflow">Exchange Outflow (Withdrawal)</option>
              <option value="internal">Internal / Wallet-to-Wallet</option>
            </select>
          </div>
        </div>
      )}

      {/* Transaction Feed */}
      {data && data.available && (
        <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-[#182338] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-sm text-white">LIVE ON-CHAIN TRANSACTION STREAM</span>
            </div>
            <span className="text-xs text-slate-400">
              Showing {(data.transactions || []).length} large block movements
            </span>
          </div>

          <div className="divide-y divide-[#151f33]">
            {(!data.transactions || data.transactions.length === 0) ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No transactions matched the active filters ({selectedSymbol}, min ${minUsd.toLocaleString()}).
              </div>
            ) : (
              (data.transactions || []).map(tx => {
                const isMegaWhale = tx.usdValue >= 5_000_000;
                const isInflow = tx.direction === 'inflow';
                const isOutflow = tx.direction === 'outflow';

                return (
                  <div
                    key={tx.id}
                    className={`p-4 transition-all hover:bg-[#101827] flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      isMegaWhale ? 'bg-indigo-950/15' : ''
                    }`}
                  >
                    {/* Left: Asset, Size & Direction */}
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
                          {isMegaWhale && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                              MEGA WHALE
                            </span>
                          )}
                        </div>

                        {/* From -> To Entity */}
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

                        {/* Analytical Interpretation */}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {tx.analyticalInterpretation}
                        </p>
                      </div>
                    </div>

                    {/* Right: Meta & Actions */}
                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 text-right">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isInflow
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : isOutflow
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}
                        >
                          {tx.direction}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                        <span className="font-mono">{(tx.txHash || '0x...').substring(0, 10)}...</span>
                        <button
                          onClick={() => copyTxHash(tx.txHash || '', tx.id)}
                          className="p-1 rounded hover:text-white transition-colors"
                          title="Copy Transaction Hash"
                        >
                          {copiedTxId === tx.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Mandatory Disclaimer */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
        DYOR — Do Your Own Research. Not Financial Advice. On-chain metrics reflect confirmed historical blockchain transactions and exchange wallet cluster telemetry.
      </div>

      {/* Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c121e] border border-[#1b253b] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#182338] pb-3">
              <div className="flex items-center space-x-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">On-Chain Provider Configuration</h3>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Crypto Intelligence AI supports an independent on-chain provider layer. If no provider is configured, the system cleanly displays unavailable states without hallucination.
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Target Provider:</label>
                <select
                  value={configProviderId}
                  onChange={e => setConfigProviderId(e.target.value)}
                  className="w-full bg-[#080d16] border border-[#1b253b] text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  <option value="arkham">Arkham Intelligence API</option>
                  <option value="whalealert">Whale Alert API</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">API Key / Token:</label>
                <input
                  type="password"
                  value={configApiKey}
                  onChange={e => setConfigApiKey(e.target.value)}
                  placeholder="Enter provider API key..."
                  className="w-full bg-[#080d16] border border-[#1b253b] text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleSimulated(true);
                    handleSelectProvider('simulated');
                    setIsConfigOpen(false);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  Use Sandbox Feed
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={configSaving}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50"
                  >
                    {configSaving ? 'Saving...' : 'Save Configuration'}
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
