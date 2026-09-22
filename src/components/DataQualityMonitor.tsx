import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { NormalizedCoinData } from '../types';

interface ExchangeInfo {
  id: string;
  name: string;
  marketType: string;
  isHealthy: boolean;
  latencyMs: number;
  pairsCount: number;
  features: string[];
  status: string;
}

interface DataQualityMonitorProps {
  coins: NormalizedCoinData[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const DataQualityMonitor: React.FC<DataQualityMonitorProps> = ({
  coins,
  onRefresh,
  isRefreshing
}) => {
  const [exchanges, setExchanges] = useState<ExchangeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchExchanges = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/exchanges');
      if (res.ok) {
        const data = await res.json();
        setExchanges(data);
      }
    } catch (err) {
      console.error('Failed to fetch exchanges health:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExchanges();
  }, []);

  // Compute metrics
  const delayedCoins = coins.filter(c => c.freshnessSeconds > 45 || c.dataStatus === 'DATA DELAYED');
  const averageFreshness = coins.length > 0
    ? (coins.reduce((acc, c) => acc + c.freshnessSeconds, 0) / coins.length).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-[#0a0f1a] border border-[#1a263c] rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              MULTI-EXCHANGE DATA QUALITY & TELEMETRY MONITOR
            </h2>
            <p className="text-xs text-slate-400">
              API streaming latency, ticker freshness tracking, and delayed data isolation radar
            </p>
          </div>
        </div>

        <button
          onClick={() => { fetchExchanges(); onRefresh(); }}
          disabled={isRefreshing || isLoading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Ping Exchanges</span>
        </button>
      </div>

      {/* 3 Exchange Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exchanges.map(ex => (
          <div
            key={ex.id}
            className={`p-4 rounded-2xl border transition-all ${
              ex.isHealthy
                ? 'bg-[#090f1b] border-[#18263e]'
                : ex.id === 'OKX'
                ? 'bg-[#070b13]/70 border-[#121927]'
                : 'bg-rose-950/20 border-rose-800/40'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">{ex.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded border ${
                      ex.isHealthy
                        ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-500'
                    }`}
                  >
                    {ex.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{ex.marketType}</div>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase text-slate-500">Latency</div>
                <div
                  className={`text-sm font-bold ${
                    ex.latencyMs < 100
                      ? 'text-emerald-400'
                      : ex.latencyMs < 300
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}
                >
                  {ex.isHealthy ? `${ex.latencyMs} ms` : '—'}
                </div>
              </div>
            </div>

            {/* Features tags */}
            <div className="mt-4 pt-3 border-t border-[#131d2e] flex flex-wrap gap-1.5">
              {ex.features.map(f => (
                <span
                  key={f}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d1522] border border-[#1a2538] text-slate-300"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Freshness Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-[#090e18] border border-[#152033] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-slate-400">Tracked Market Pairs</div>
            <div className="text-base font-bold text-white mt-0.5">{coins.length} Active Feeds</div>
          </div>
          <Database className="w-5 h-5 text-cyan-400" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#090e18] border border-[#152033] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-slate-400">Average Ticker Age</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{averageFreshness} seconds</div>
          </div>
          <Clock className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#090e18] border border-[#152033] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-slate-400">Delayed Data Feeds (&gt;45s)</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                delayedCoins.length > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {delayedCoins.length} Feeds Flagged
            </div>
          </div>
          <AlertTriangle className={`w-5 h-5 ${delayedCoins.length > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
        </div>
      </div>

      {/* Delayed Feeds Radar Section */}
      <div className="p-4 rounded-2xl bg-[#080d16] border border-[#162033] space-y-3">
        <div className="flex items-center justify-between border-b border-[#141d2d] pb-2 text-xs">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white uppercase tracking-wider">
              DATA DELAY & TIMESTAMPS RADAR
            </span>
          </div>
          <span className="text-slate-400 text-[11px]">
            Coins with ticker age &gt; 45s are explicitly labeled "DATA DELAYED"
          </span>
        </div>

        {delayedCoins.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#0b101c] border border-[#152033] text-center space-y-1.5 text-xs text-slate-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <div className="font-bold text-slate-200">All Market Feeds Within Freshness Thresholds</div>
            <p className="text-[11px] text-slate-500">
              Binance and Bybit feeds are responding within normal parameters (&lt; 45s delta).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#162236]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0d1424] text-[10px] text-slate-400 uppercase">
                <tr>
                  <th className="p-2.5">Pair</th>
                  <th className="p-2.5">Exchange</th>
                  <th className="p-2.5">Data Status</th>
                  <th className="p-2.5">Age Delta</th>
                  <th className="p-2.5">Source Endpoint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131d2e] text-slate-300">
                {delayedCoins.map(coin => (
                  <tr key={coin.id} className="hover:bg-[#0e1628]">
                    <td className="p-2.5 font-bold text-white">{coin.symbol}</td>
                    <td className="p-2.5 text-slate-400">{coin.exchange}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/50 text-amber-300 font-bold text-[10px]">
                        {coin.dataStatus}
                      </span>
                    </td>
                    <td className="p-2.5 text-amber-400">{coin.freshnessSeconds}s ago</td>
                    <td className="p-2.5 text-slate-500 text-[11px]">{coin.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
