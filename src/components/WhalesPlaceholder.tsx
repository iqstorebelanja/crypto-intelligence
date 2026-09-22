import {
  Activity,
  ArrowRightLeft,
  Building2,
  Clock,
  Coins,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Network,
  ShieldAlert,
  Waves
} from 'lucide-react';
import React from 'react';

export const WhalesPlaceholder: React.FC = () => {
  return (
    <div className="space-y-6 font-mono">
      {/* Banner */}
      <div className="bg-[#0c121e] border border-indigo-900/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#18233c] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Waves className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white">WHALE ACTIVITY SCANNER</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  COMING IN PHASE 2/3
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Institutional on-chain transfer tracking, exchange inflow/outflow monitoring, and large block detection.
              </p>
            </div>
          </div>

          <div className="text-[11px] px-3 py-1.5 rounded-xl bg-[#080d16] border border-[#1b273d] text-indigo-300">
            Phase 1 Foundation Operational
          </div>
        </div>

        {/* Architectural Overview */}
        <div className="mt-6 space-y-4 text-xs">
          <div className="text-slate-300 font-bold uppercase tracking-wider text-[11px] flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Planned Phase 2/3 Data Pipeline & Ingestion Architecture</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300">
            <div className="p-4 rounded-xl bg-[#080d16] border border-[#162033] space-y-2">
              <div className="font-bold text-white flex items-center space-x-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>1. Multi-Chain Nodes</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Direct RPC connections to Bitcoin, Ethereum, Solana, and Arbitrum nodes indexing transactions exceeding $500,000 USD equivalent.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#080d16] border border-[#162033] space-y-2">
              <div className="font-bold text-white flex items-center space-x-2">
                <Network className="w-4 h-4 text-indigo-400" />
                <span>2. Wallet Clustering</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Heuristic entity attribution identifying known institutional desks, market maker hot wallets (Wintermute, Jump), and Binance/OKX reserve addresses.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#080d16] border border-[#162033] space-y-2">
              <div className="font-bold text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>3. Anomaly Scorer</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Real-time correlation between sudden large spot exchange deposits and subsequent downside order-book volatility.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schema / Architecture Preview Table (Mock Prototype Schema) */}
      <div className="bg-[#0c121e] border border-[#1d2940] rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-[#182338] pb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-sm text-white">Target Entity Model: WhaleTransaction</span>
          </div>
          <span className="text-[10px] text-slate-500 uppercase">Schema Prototype</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-[#131d2e] uppercase text-[10px]">
                <th className="pb-2">Field</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Source Integration</th>
                <th className="pb-2">Analytical Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131d2e] text-slate-300">
              <tr>
                <td className="py-2 text-cyan-400">transactionHash</td>
                <td className="py-2 text-slate-400">string</td>
                <td className="py-2">Etherscan / Solscan API</td>
                <td className="py-2 text-slate-400">Unique cryptographic audit trail</td>
              </tr>
              <tr>
                <td className="py-2 text-cyan-400">usdValue</td>
                <td className="py-2 text-slate-400">number</td>
                <td className="py-2">Binance Spot Index</td>
                <td className="py-2 text-slate-400">Normalized threshold filter (&gt;$1M)</td>
              </tr>
              <tr>
                <td className="py-2 text-cyan-400">transferType</td>
                <td className="py-2 text-slate-400">'deposit' | 'withdrawal' | 'internal'</td>
                <td className="py-2">Exchange Tag Registry</td>
                <td className="py-2 text-slate-400">Exchange inflow vs cold-storage accumulation</td>
              </tr>
              <tr>
                <td className="py-2 text-cyan-400">counterpartyEntity</td>
                <td className="py-2 text-slate-400">string</td>
                <td className="py-2">Clustering Engine</td>
                <td className="py-2 text-slate-400">Known fund or anonymous private whale identifier</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-[#080d16] border border-[#162033] rounded-xl text-[11px] text-slate-400 flex items-center justify-between">
          <span>This feature is scheduled for Phase 2/3 following Phase 1 modular exchange standardization.</span>
          <span className="text-indigo-400 font-semibold">Scheduled in Roadmap</span>
        </div>
      </div>
    </div>
  );
};
