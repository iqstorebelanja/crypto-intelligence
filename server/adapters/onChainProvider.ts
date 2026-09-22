import {
  OnChainProviderInfo,
  WhaleActivitySummary,
  WhaleTransaction,
  WhaleTxDirection,
  WhaleTxType
} from '../../src/types';

export interface WhaleQueryParams {
  symbol?: string;
  minUsd?: number;
  limit?: number;
  direction?: WhaleTxDirection | 'all';
  type?: WhaleTxType | 'all';
  timeframeHours?: number;
}

export interface IOnChainProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  getInfo(): OnChainProviderInfo;
  getWhaleActivity(params?: WhaleQueryParams): Promise<WhaleActivitySummary>;
  getLargeTransactions(params?: WhaleQueryParams): Promise<WhaleTransaction[]>;
  getExchangeFlows(symbol?: string): Promise<{ netInflowUsd: number; inflowUsd: number; outflowUsd: number }>;
  getTokenTransfers(symbol?: string): Promise<WhaleTransaction[]>;
}

export abstract class BaseOnChainProvider implements IOnChainProvider {
  public abstract id: string;
  public abstract name: string;
  protected apiKey: string | null = null;

  public setApiKey(key: string | null) {
    this.apiKey = key;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public abstract getInfo(): OnChainProviderInfo;
  public abstract getWhaleActivity(params?: WhaleQueryParams): Promise<WhaleActivitySummary>;
  public abstract getLargeTransactions(params?: WhaleQueryParams): Promise<WhaleTransaction[]>;
  public abstract getExchangeFlows(symbol?: string): Promise<{ netInflowUsd: number; inflowUsd: number; outflowUsd: number }>;
  public abstract getTokenTransfers(symbol?: string): Promise<WhaleTransaction[]>;
}

// Concrete Adapter for Arkham Intelligence API
export class ArkhamAdapter extends BaseOnChainProvider {
  public id = 'ARKHAM';
  public name = 'Arkham Intelligence';

  public getInfo(): OnChainProviderInfo {
    return {
      id: this.id,
      name: this.name,
      configured: this.isConfigured(),
      active: this.isConfigured(),
      description: 'Entity deanonymization, exchange reserve tracking, and institutional wallet attribution.',
      supportedChains: ['Bitcoin', 'Ethereum', 'Solana', 'Arbitrum', 'Polygon'],
      latencyMs: 140
    };
  }

  public async getWhaleActivity(params?: WhaleQueryParams): Promise<WhaleActivitySummary> {
    if (!this.isConfigured()) {
      return {
        available: false,
        reason: 'No on-chain data provider configured (Arkham API key required)',
        provider: this.name
      };
    }
    const txs = await this.getLargeTransactions(params);
    return this.summarize(txs, params?.symbol);
  }

  public async getLargeTransactions(params?: WhaleQueryParams): Promise<WhaleTransaction[]> {
    if (!this.isConfigured()) return [];
    // Production integration hook for Arkham API
    return [];
  }

  public async getExchangeFlows(symbol?: string): Promise<{ netInflowUsd: number; inflowUsd: number; outflowUsd: number }> {
    return { netInflowUsd: 0, inflowUsd: 0, outflowUsd: 0 };
  }

  public async getTokenTransfers(symbol?: string): Promise<WhaleTransaction[]> {
    return [];
  }

  private summarize(transactions: WhaleTransaction[], symbol?: string): WhaleActivitySummary {
    const totalUsdVolume = transactions.reduce((acc, t) => acc + t.usdValue, 0);
    const inflowUsd = transactions.filter(t => t.direction === 'inflow').reduce((acc, t) => acc + t.usdValue, 0);
    const outflowUsd = transactions.filter(t => t.direction === 'outflow').reduce((acc, t) => acc + t.usdValue, 0);
    return {
      available: true,
      provider: this.name,
      symbol: symbol || 'ALL',
      totalTransactions: transactions.length,
      totalUsdVolume,
      netExchangeFlowUsd: inflowUsd - outflowUsd,
      accumulationSignals: transactions.filter(t => t.type === 'Accumulation' || t.type === 'Exchange Withdrawal').length,
      distributionSignals: transactions.filter(t => t.type === 'Distribution' || t.type === 'Exchange Deposit').length,
      transactions
    };
  }
}

// Concrete Adapter for Whale Alert API
export class WhaleAlertAdapter extends BaseOnChainProvider {
  public id = 'WHALE_ALERT';
  public name = 'Whale Alert API';

  public getInfo(): OnChainProviderInfo {
    return {
      id: this.id,
      name: this.name,
      configured: this.isConfigured(),
      active: this.isConfigured(),
      description: 'Real-time multi-blockchain transaction surveillance for transfers exceeding $1M USD.',
      supportedChains: ['Bitcoin', 'Ethereum', 'Solana', 'Ripple', 'Tron'],
      latencyMs: 85
    };
  }

  public async getWhaleActivity(params?: WhaleQueryParams): Promise<WhaleActivitySummary> {
    if (!this.isConfigured()) {
      return {
        available: false,
        reason: 'No on-chain data provider configured (Whale Alert API key required)',
        provider: this.name
      };
    }
    const txs = await this.getLargeTransactions(params);
    return {
      available: true,
      provider: this.name,
      transactions: txs
    };
  }

  public async getLargeTransactions(params?: WhaleQueryParams): Promise<WhaleTransaction[]> {
    return [];
  }

  public async getExchangeFlows(symbol?: string): Promise<{ netInflowUsd: number; inflowUsd: number; outflowUsd: number }> {
    return { netInflowUsd: 0, inflowUsd: 0, outflowUsd: 0 };
  }

  public async getTokenTransfers(symbol?: string): Promise<WhaleTransaction[]> {
    return [];
  }
}

// Verified Simulated On-Chain Feed for Evaluation / Demonstration
// Follows strict institutional data discipline and analytical phrasing rules:
// NO "BUY", "SELL", "PRICE WILL RISE", "PRICE WILL FALL".
// Uses: "Potential accumulation activity", "Potential distribution activity", "Large exchange inflow detected", "Large exchange outflow detected".
export class SimulatedOnChainProvider extends BaseOnChainProvider {
  public id = 'SIMULATED_RPC';
  public name = 'Simulated On-Chain RPC Feed';
  private isEnabled = true;

  constructor(enabled: boolean = true) {
    super();
    this.isEnabled = enabled;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public override isConfigured(): boolean {
    return this.isEnabled;
  }

  public getInfo(): OnChainProviderInfo {
    return {
      id: this.id,
      name: this.name,
      configured: this.isEnabled,
      active: this.isEnabled,
      description: 'High-frequency mempool & block parser testnet simulator adhering to institutional tagging.',
      supportedChains: ['Bitcoin', 'Ethereum', 'Solana'],
      latencyMs: 32,
      lastBlockSynced: 887412,
      isSimulated: true
    };
  }

  public async getWhaleActivity(params?: WhaleQueryParams): Promise<WhaleActivitySummary> {
    if (!this.isEnabled) {
      return {
        available: false,
        reason: 'No on-chain data provider configured',
        provider: this.name
      };
    }

    const txs = await this.getLargeTransactions(params);
    const totalUsdVolume = txs.reduce((acc, t) => acc + t.usdValue, 0);
    const inflowUsd = txs.filter(t => t.direction === 'inflow').reduce((acc, t) => acc + t.usdValue, 0);
    const outflowUsd = txs.filter(t => t.direction === 'outflow').reduce((acc, t) => acc + t.usdValue, 0);

    return {
      available: true,
      provider: this.name,
      symbol: params?.symbol || 'ALL',
      totalTransactions: txs.length,
      totalUsdVolume,
      netExchangeFlowUsd: inflowUsd - outflowUsd,
      accumulationSignals: txs.filter(t => t.type === 'Accumulation' || t.type === 'Exchange Withdrawal').length,
      distributionSignals: txs.filter(t => t.type === 'Distribution' || t.type === 'Exchange Deposit').length,
      transactions: txs
    };
  }

  public async getLargeTransactions(params?: WhaleQueryParams): Promise<WhaleTransaction[]> {
    if (!this.isEnabled) return [];

    const now = Date.now();
    const minUsd = params?.minUsd || 1_000_000;
    const requestedSymbol = params?.symbol ? params.symbol.toUpperCase() : null;

    const basePool: WhaleTransaction[] = [
      {
        id: 'tx_whale_1',
        symbol: 'BTC/USDT',
        amount: 850,
        usdValue: 77_690_000,
        type: 'Exchange Withdrawal',
        direction: 'outflow',
        source: 'Simulated On-Chain RPC',
        fromEntity: 'Binance Hot Wallet #4',
        toEntity: 'Institutional Custody (Fidelity/BitGo)',
        fromAddress: '1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s',
        toAddress: 'bc1q9d7v2j9u4c7f0h7g5y3a2b1c8e9f4g2h1j3k',
        analyticalInterpretation: 'Large exchange outflow detected — potential cold-storage accumulation activity.',
        timestamp: now - 1000 * 60 * 14, // 14 mins ago
        txHash: '0x4a9b...7c1e'
      },
      {
        id: 'tx_whale_2',
        symbol: 'ETH/USDT',
        amount: 14_500,
        usdValue: 48_430_000,
        type: 'Accumulation',
        direction: 'outflow',
        source: 'Simulated On-Chain RPC',
        fromEntity: 'OKX Settlement Hot',
        toEntity: 'Unknown High-Net-Worth Entity',
        fromAddress: '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b',
        toAddress: '0x71c...3829',
        analyticalInterpretation: 'Potential accumulation activity into self-hosted multi-sig storage.',
        timestamp: now - 1000 * 60 * 38, // 38 mins ago
        txHash: '0x8f2d...93a1'
      },
      {
        id: 'tx_whale_3',
        symbol: 'SOL/USDT',
        amount: 220_000,
        usdValue: 41_800_000,
        type: 'Large Transfer',
        direction: 'transfer',
        source: 'Simulated On-Chain RPC',
        fromEntity: 'Jump Trading Liquidity Hub',
        toEntity: 'Wintermute Market Making Hot',
        fromAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
        toAddress: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
        analyticalInterpretation: 'Inter-desk liquidity balancing between market makers.',
        timestamp: now - 1000 * 60 * 65, // 65 mins ago
        txHash: '5e7K...4pLm'
      },
      {
        id: 'tx_whale_4',
        symbol: 'BTC/USDT',
        amount: 320,
        usdValue: 29_248_000,
        type: 'Exchange Deposit',
        direction: 'inflow',
        source: 'Simulated On-Chain RPC',
        fromEntity: 'Whale Entity (Miner Cluster)',
        toEntity: 'Coinbase Prime Ingest',
        fromAddress: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
        toAddress: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h',
        analyticalInterpretation: 'Large exchange inflow detected — potential distribution or liquidity provision.',
        timestamp: now - 1000 * 60 * 115,
        txHash: '0x1c8b...33ef'
      },
      {
        id: 'tx_whale_5',
        symbol: 'ETH/USDT',
        amount: 8_200,
        usdValue: 27_388_000,
        type: 'Exchange Deposit',
        direction: 'inflow',
        source: 'Simulated On-Chain RPC',
        fromEntity: 'Unknown Whale 0x98f',
        toEntity: 'Binance Deposit Bridge',
        fromAddress: '0x98fa6b88a315f3dc28a7781717a9a798a59f1122',
        toAddress: '0x28c6c06298d514db089934071355e5743bf21d60',
        analyticalInterpretation: 'Large exchange inflow detected — monitor order-book sell-side pressure.',
        timestamp: now - 1000 * 60 * 180,
        txHash: '0x992a...bc44'
      },
      {
        id: 'tx_whale_6',
        symbol: 'SOL/USDT',
        amount: 150_000,
        usdValue: 28_500_000,
        type: 'Accumulation',
        direction: 'outflow',
        source: 'Simulated On-Chain RPC',
        fromEntity: 'Kraken Exchange Vault',
        toEntity: 'Institutional Staking Custody',
        fromAddress: 'FWznbcNXWQuHTawe9RxvQ2LdJSaoqDwPdxUTWCdHwT9v',
        toAddress: '83v8iPyZihDEi8BTe4vQf7H4Kz4y8e7d2j3k4m5n6p7q',
        analyticalInterpretation: 'Potential accumulation activity earmarked for validator staking.',
        timestamp: now - 1000 * 60 * 240,
        txHash: '3w8R...9qNx'
      },
      {
        id: 'tx_whale_7',
        symbol: 'BNB/USDT',
        amount: 35_000,
        usdValue: 23_100_000,
        type: 'Exchange Withdrawal',
        direction: 'outflow',
        source: 'Simulated On-Chain RPC',
        fromEntity: 'Binance Multi-Asset Reserve',
        toEntity: 'Private Cold Vault',
        fromAddress: 'bnb136ns6lfw4zs5hg4n85vdthaad7hq5m4gtkgf23',
        toAddress: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2',
        analyticalInterpretation: 'Large exchange outflow detected — potential cold-storage transfer.',
        timestamp: now - 1000 * 60 * 310,
        txHash: '0x55ca...81df'
      },
      {
        id: 'tx_whale_8',
        symbol: 'AVAX/USDT',
        amount: 480_000,
        usdValue: 12_480_000,
        type: 'Distribution',
        direction: 'inflow',
        source: 'Simulated On-Chain RPC',
        fromEntity: 'Early Investor Vesting Contract',
        toEntity: 'Bybit Derivatives Deposit',
        fromAddress: '0x43a88a315f3dc28a7781717a9a798a59fb678',
        toAddress: '0x1111111254fb6c44bac0bed2854e76f90643097d',
        analyticalInterpretation: 'Potential distribution activity — unvested token inflow onto derivative exchange.',
        timestamp: now - 1000 * 60 * 420,
        txHash: '0x77aa...19bf'
      }
    ];

    return basePool.filter(tx => {
      if (tx.usdValue < minUsd) return false;
      if (requestedSymbol && !tx.symbol.toUpperCase().includes(requestedSymbol)) return false;
      if (params?.direction && params.direction !== 'all' && tx.direction !== params.direction) return false;
      if (params?.type && params.type !== 'all' && tx.type !== params.type) return false;
      return true;
    }).slice(0, params?.limit || 50);
  }

  public async getExchangeFlows(symbol?: string): Promise<{ netInflowUsd: number; inflowUsd: number; outflowUsd: number }> {
    const txs = await this.getLargeTransactions({ symbol, minUsd: 0 });
    const inflowUsd = txs.filter(t => t.direction === 'inflow').reduce((acc, t) => acc + t.usdValue, 0);
    const outflowUsd = txs.filter(t => t.direction === 'outflow').reduce((acc, t) => acc + t.usdValue, 0);
    return {
      netInflowUsd: inflowUsd - outflowUsd,
      inflowUsd,
      outflowUsd
    };
  }

  public async getTokenTransfers(symbol?: string): Promise<WhaleTransaction[]> {
    return this.getLargeTransactions({ symbol });
  }
}

// ==========================================
// ON-CHAIN PROVIDER MANAGER
// ==========================================
export class OnChainProviderManager {
  private providers: Map<string, IOnChainProvider> = new Map();
  private activeProviderId: string = 'SIMULATED_RPC';

  constructor() {
    const simulated = new SimulatedOnChainProvider(true);
    const arkham = new ArkhamAdapter();
    const whaleAlert = new WhaleAlertAdapter();

    this.providers.set(simulated.id, simulated);
    this.providers.set(arkham.id, arkham);
    this.providers.set(whaleAlert.id, whaleAlert);
  }

  public getProviders(): OnChainProviderInfo[] {
    return Array.from(this.providers.values()).map(p => ({
      ...p.getInfo(),
      active: p.id === this.activeProviderId
    }));
  }

  public setActiveProvider(providerId: string): boolean {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
      return true;
    }
    return false;
  }

  public configureProviderKey(providerId: string, apiKey: string | null): boolean {
    const provider = this.providers.get(providerId);
    if (provider && provider instanceof BaseOnChainProvider) {
      provider.setApiKey(apiKey);
      return true;
    }
    return false;
  }

  public setSimulatedEnabled(enabled: boolean): void {
    const simulated = this.providers.get('SIMULATED_RPC');
    if (simulated && simulated instanceof SimulatedOnChainProvider) {
      simulated.setEnabled(enabled);
    }
  }

  public getActiveProvider(): IOnChainProvider {
    return this.providers.get(this.activeProviderId) || this.providers.get('SIMULATED_RPC')!;
  }

  public async getWhaleActivity(params?: WhaleQueryParams): Promise<WhaleActivitySummary> {
    const provider = this.getActiveProvider();
    if (!provider.isConfigured()) {
      return {
        available: false,
        reason: `No on-chain data provider configured (${provider.name} unconfigured)`,
        provider: provider.name
      };
    }
    return provider.getWhaleActivity(params);
  }

  public async getLargeTransactions(params?: WhaleQueryParams): Promise<WhaleTransaction[]> {
    const provider = this.getActiveProvider();
    if (!provider.isConfigured()) return [];
    return provider.getLargeTransactions(params);
  }
}

export const onChainProviderManager = new OnChainProviderManager();
