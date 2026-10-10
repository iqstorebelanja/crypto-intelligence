import { useEffect, useState, useCallback } from 'react';
import { ExchangeId, ExchangeRegistryItem } from '../types';

export const ALL_EXCHANGES_OPTION: ExchangeRegistryItem = {
  id: 'ALL',
  name: 'All Exchanges',
  tag: 'Aggregated',
  marketType: 'Multi-Exchange Aggregated Discovery',
  isHealthy: true,
  latencyMs: 28,
  pairsCount: 320,
  features: ['Cross-Exchange Aggregation', 'Multi-Source Depth', 'Arbitrage Spread', 'Global Volume Leaders'],
  status: 'Operational',
  providerType: 'Aggregator',
  description: 'Aggregated multi-exchange market intelligence across all connected providers',
  isPopular: true
};

export const INITIAL_EXCHANGES: ExchangeRegistryItem[] = [
  ALL_EXCHANGES_OPTION,
  {
    id: 'BINANCE',
    name: 'Binance',
    tag: 'Spot/Perp',
    marketType: 'Spot & Futures',
    isHealthy: true,
    latencyMs: 35,
    pairsCount: 50,
    features: ['Spot Tickers', 'OHLCV', 'RSI/MA/BB', 'Open Interest', 'Funding Rate', 'Liquidations', 'Order Flow'],
    status: 'Operational',
    providerType: 'Exchange',
    description: 'World leading high-liquidity spot and perpetual futures exchange',
    isPopular: true
  },
  {
    id: 'BYBIT',
    name: 'Bybit',
    tag: 'Linear Perp',
    marketType: 'USDT Linear Perpetual',
    isHealthy: true,
    latencyMs: 42,
    pairsCount: 35,
    features: ['Perpetual Tickers', 'Kline Streams', 'Open Interest v5', 'Funding History', 'Account Ratio'],
    status: 'Operational',
    providerType: 'Exchange',
    description: 'Premier cryptocurrency derivatives platform with deep perpetual liquidity',
    isPopular: true
  },
  {
    id: 'KRAKEN',
    name: 'Kraken',
    tag: 'Order Book',
    marketType: 'Spot & Futures Universe',
    isHealthy: true,
    latencyMs: 45,
    pairsCount: 40,
    features: ['Spot Order Book', 'Cryptographic Proof of Reserves', 'Deep Liquidity', 'EUR/USD Crosses'],
    status: 'Operational',
    providerType: 'Exchange',
    description: 'Security-first digital asset exchange with institutional proof of reserves',
    isPopular: true
  },
  {
    id: 'GATE',
    name: 'Gate.io',
    tag: 'Perpetuals',
    marketType: 'Spot & USDT Margined Futures',
    isHealthy: true,
    latencyMs: 62,
    pairsCount: 65,
    features: ['Broad Altcoin Discovery', 'Perpetual Contracts', 'Funding Metrics', 'Volume Leaders'],
    status: 'Operational',
    providerType: 'Exchange',
    description: 'Comprehensive digital asset exchange with extensive token discovery',
    isPopular: true
  },
  {
    id: 'OKX',
    name: 'OKX',
    tag: 'Swap/Spot',
    marketType: 'Spot Feed v5',
    isHealthy: true,
    latencyMs: 55,
    pairsCount: 45,
    features: ['Spot Tickers v5', 'Instruments Discovery', 'Candles v5', 'Order Book Depth', 'Multi-Asset Mapping'],
    status: 'Operational',
    providerType: 'Exchange',
    description: 'Global crypto exchange and Web3 technology ecosystem',
    isPopular: true
  },
  {
    id: 'PIONEX',
    name: 'Pionex',
    tag: 'Grid Universe',
    marketType: 'Spot Trading Universe',
    isHealthy: true,
    latencyMs: 68,
    pairsCount: 40,
    features: ['Spot Tickers v1', 'Symbols Discovery', 'Klines v1', 'Order Depth', 'Grid Trading Universe'],
    status: 'Operational',
    providerType: 'Broker',
    description: 'Automated quantitative trading exchange with native grid bot infrastructure',
    isPopular: true
  },
  {
    id: 'COINBASE',
    name: 'Coinbase',
    tag: 'Institutional',
    marketType: 'Institutional Spot Feed',
    isHealthy: true,
    latencyMs: 38,
    pairsCount: 30,
    features: ['Institutional Depth', 'Direct USD Settlement', 'High Regulatory Conformance'],
    status: 'Operational',
    providerType: 'Broker',
    description: 'Regulated institutional digital asset venue and compliant brokerage gateway',
    isPopular: false
  }
];

let cachedRegistryList: ExchangeRegistryItem[] = [...INITIAL_EXCHANGES];

export async function fetchAuthoritativeExchanges(): Promise<ExchangeRegistryItem[]> {
  try {
    const res = await fetch('/api/exchanges');
    if (res.ok) {
      const data: ExchangeRegistryItem[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Ensure ALL EXCHANGES is always the authoritative top aggregator option
        const fullList: ExchangeRegistryItem[] = [
          ALL_EXCHANGES_OPTION,
          ...data.filter(e => e.id !== 'ALL')
        ];
        cachedRegistryList = fullList;
        try {
          localStorage.setItem('cached_exchanges_registry', JSON.stringify(fullList));
        } catch {
          // Ignore local storage quota limits
        }
        return fullList;
      }
    }
  } catch (err) {
    console.warn('Failed to load exchanges registry, falling back to cache:', err);
  }

  // Fallback to local storage or defaults
  try {
    const saved = localStorage.getItem('cached_exchanges_registry');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedRegistryList = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return cachedRegistryList;
}

export function useExchangeRegistry() {
  const [exchanges, setExchanges] = useState<ExchangeRegistryItem[]>(cachedRegistryList);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchAuthoritativeExchanges();
      setExchanges(list);
    } catch (err) {
      setError((err as Error).message || 'Failed to load exchanges');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getExchangeById = useCallback((id: ExchangeId): ExchangeRegistryItem => {
    const found = exchanges.find(e => e.id.toUpperCase() === id.toUpperCase());
    return found || ALL_EXCHANGES_OPTION;
  }, [exchanges]);

  return {
    exchanges,
    isLoading,
    error,
    refreshExchanges: load,
    getExchangeById
  };
}
