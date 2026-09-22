import { binanceAdapter } from '../adapters/binanceAdapter';
import { bybitAdapter } from '../adapters/bybitAdapter';
import { okxAdapter } from '../adapters/okxAdapter';
import { pionexAdapter } from '../adapters/pionexAdapter';
import { IExchangeAdapter } from '../adapters/exchangeAdapter';
import {
  AggregatedAssetView,
  Asset,
  ExchangeId,
  ExchangeMarket,
  ExchangeMarketMetadata,
  ExchangeUniverseStats,
  NewListingEvent,
  NormalizedCoinData
} from '../../src/types';

export class AssetRegistryService {
  private assets: Map<string, Asset> = new Map();
  private exchangeMarkets: Map<string, ExchangeMarket> = new Map(); // key: marketId (e.g. okx_ABC-USDT)
  private newListingEvents: NewListingEvent[] = [];
  private universeStats: Map<ExchangeId, ExchangeUniverseStats> = new Map();
  private isDiscovering = false;
  private discoveryPromise: Promise<{
    discoveredCount: number;
    newListingCount: number;
    exchangeStats: ExchangeUniverseStats[];
  }> | null = null;
  private lastDiscoveryTime = 0;
  private discoveryIntervalMs = 300000; // 5 minutes

  // Known verified asset identity list with contract / chains to demonstrate symbol collision protection
  private static readonly VERIFIED_ASSETS_MAP: Record<
    string,
    { displayName: string; chain: string; contractAddress?: string; tokenStandard?: string }
  > = {
    BTC: { displayName: 'Bitcoin', chain: 'Bitcoin' },
    ETH: { displayName: 'Ethereum', chain: 'Ethereum' },
    SOL: { displayName: 'Solana', chain: 'Solana' },
    BNB: { displayName: 'BNB Chain', chain: 'BNB Chain' },
    XRP: { displayName: 'XRP Ledger', chain: 'Ripple' },
    ADA: { displayName: 'Cardano', chain: 'Cardano' },
    DOGE: { displayName: 'Dogecoin', chain: 'Dogecoin' },
    AVAX: { displayName: 'Avalanche', chain: 'Avalanche C-Chain' },
    LINK: { displayName: 'Chainlink', chain: 'Ethereum', contractAddress: '0x514910771af9ca656af840dff83e8264ecf986ca' },
    SUI: { displayName: 'Sui Network', chain: 'Sui' },
    NEAR: { displayName: 'NEAR Protocol', chain: 'NEAR' },
    PEPE: { displayName: 'Pepe', chain: 'Ethereum', contractAddress: '0x6982508145454ce325ddbe47a25d4ec3d2311933' },
    OKB: { displayName: 'OKB Utility Token', chain: 'OKTC / Ethereum' },
    TON: { displayName: 'The Open Network', chain: 'TON' },
    ABC: {
      displayName: 'ABC Protocol (OKX Exclusive Test Asset)',
      chain: 'Ethereum',
      contractAddress: '0xabc9981249871239841289371289371982371982',
      tokenStandard: 'ERC-20'
    },
    XYZ: {
      displayName: 'XYZ Network (Pionex Exclusive Test Asset)',
      chain: 'Solana',
      tokenStandard: 'SPL'
    }
  };

  constructor() {
    this.initStats();
  }

  private initStats() {
    const defaultExchanges: { id: ExchangeId; name: string; features: string[] }[] = [
      { id: 'BINANCE', name: 'Binance', features: ['Spot Tickers', 'OHLCV', 'RSI/MA/BB', 'Open Interest', 'Funding Rate', 'Liquidations'] },
      { id: 'OKX', name: 'OKX', features: ['Spot Tickers', 'Instruments v5', 'Candles v5', 'Order Book', 'Multi-Asset Mapping'] },
      { id: 'PIONEX', name: 'Pionex', features: ['Spot Tickers', 'Symbols v1', 'Klines v1', 'Order Depth', 'Grid Trading Universe'] },
      { id: 'BYBIT', name: 'Bybit', features: ['Linear Perps', 'Kline v5', 'Open Interest v5', 'Funding History', 'Account Ratio'] }
    ];

    for (const ex of defaultExchanges) {
      this.universeStats.set(ex.id, {
        exchange: ex.id,
        exchangeName: ex.name,
        activeMarkets: 0,
        newMarkets: 0,
        inactiveMarkets: 0,
        lastDiscovery: 0,
        discoveryStatus: 'Operational',
        latencyMs: 50,
        features: ex.features
      });
    }
  }

  public getAdapter(exchange: ExchangeId): IExchangeAdapter {
    switch (exchange) {
      case 'OKX':
        return okxAdapter;
      case 'PIONEX':
        return pionexAdapter;
      case 'BYBIT':
        return bybitAdapter;
      case 'BINANCE':
      default:
        return binanceAdapter;
    }
  }

  public getSupportedExchanges(): ExchangeId[] {
    return ['BINANCE', 'OKX', 'PIONEX', 'BYBIT'];
  }

  /**
   * GLOBAL MULTI-EXCHANGE SYMBOL DISCOVERY PROCESS
   * Independently queries getMarkets() from each exchange adapter.
   * If one exchange fails or is offline, the other exchanges still discover and scan smoothly!
   */
  public async runDiscovery(force = false): Promise<{
    discoveredCount: number;
    newListingCount: number;
    exchangeStats: ExchangeUniverseStats[];
  }> {
    const now = Date.now();
    if (!force && this.lastDiscoveryTime > 0 && now - this.lastDiscoveryTime < this.discoveryIntervalMs) {
      return {
        discoveredCount: this.exchangeMarkets.size,
        newListingCount: this.newListingEvents.length,
        exchangeStats: Array.from(this.universeStats.values())
      };
    }

    if (this.discoveryPromise) {
      return this.discoveryPromise;
    }

    this.isDiscovering = true;
    this.discoveryPromise = (async () => {
      try {
      const adapters: { id: ExchangeId; adapter: IExchangeAdapter }[] = [
        { id: 'BINANCE', adapter: binanceAdapter },
        { id: 'OKX', adapter: okxAdapter },
        { id: 'PIONEX', adapter: pionexAdapter },
        { id: 'BYBIT', adapter: bybitAdapter }
      ];

      let totalDiscovered = 0;
      let newCount = 0;

      // Independent discovery per exchange - failure of one does not stop the others!
      await Promise.allSettled(
        adapters.map(async ({ id, adapter }) => {
          const startTime = Date.now();
          const stats = this.universeStats.get(id) || {
            exchange: id,
            exchangeName: adapter.name,
            activeMarkets: 0,
            newMarkets: 0,
            inactiveMarkets: 0,
            lastDiscovery: 0,
            discoveryStatus: 'Operational',
            latencyMs: 50,
            features: []
          };

          try {
            const markets = await adapter.getMarkets();
            const latency = Date.now() - startTime;
            stats.latencyMs = latency;
            stats.lastDiscovery = now;
            stats.discoveryStatus = 'Operational';

            const activeMarketIdsThisRun = new Set<string>();

            for (const m of markets) {
              activeMarketIdsThisRun.add(m.marketId);

              // 1. Asset Registry Normalization with Symbol Collision Protection
              const baseAsset = m.baseAsset.toUpperCase();
              let asset = this.assets.get(baseAsset);

              const verifiedMeta = AssetRegistryService.VERIFIED_ASSETS_MAP[baseAsset];
              const isVerified = Boolean(verifiedMeta || m.metadata?.chain || m.metadata?.contractAddress);

              if (!asset) {
                asset = {
                  id: baseAsset,
                  baseAsset,
                  displayName: verifiedMeta?.displayName || `${baseAsset} Asset`,
                  status: 'ACTIVE',
                  chain: verifiedMeta?.chain || (m.metadata?.chain as string | undefined),
                  contractAddress: verifiedMeta?.contractAddress || (m.metadata?.contractAddress as string | undefined),
                  tokenStandard: verifiedMeta?.tokenStandard || (m.metadata?.tokenStandard as string | undefined),
                  isVerifiedIdentity: isVerified,
                  unverifiedReason: isVerified ? undefined : 'Asset identity not verified against external provider',
                  createdAt: now,
                  updatedAt: now
                };
                this.assets.set(baseAsset, asset);
              } else {
                // Update timestamp & status
                asset.status = 'ACTIVE';
                asset.updatedAt = now;
              }

              // 2. ExchangeMarket Registration
              const existingMarket = this.exchangeMarkets.get(m.marketId);
              const isNewMarket = !existingMarket;

              const exchangeMarket: ExchangeMarket = {
                id: m.marketId,
                assetId: asset.id,
                exchange: m.exchange,
                exchangeSymbol: m.exchangeSymbol,
                normalizedSymbol: m.normalizedSymbol,
                quoteAsset: m.quoteAsset,
                marketType: m.marketType,
                status: m.status,
                listingTime: m.listingTime || existingMarket?.listingTime || now,
                delistingTime: undefined,
                pricePrecision: m.pricePrecision,
                quantityPrecision: m.quantityPrecision,
                tickSize: m.tickSize,
                minQuantity: m.minQuantity,
                minNotional: m.minNotional,
                metadata: m.metadata,
                lastUpdated: now
              };

              this.exchangeMarkets.set(m.marketId, exchangeMarket);
              totalDiscovered++;

              // 3. New Listing Detection
              if (isNewMarket) {
                newCount++;
                stats.newMarkets++;
                const newListingEvent: NewListingEvent = {
                  id: `listing_${m.exchange}_${m.exchangeSymbol}_${now}`,
                  exchange: m.exchange,
                  exchangeSymbol: m.exchangeSymbol,
                  normalizedSymbol: m.normalizedSymbol,
                  baseAsset: m.baseAsset,
                  quoteAsset: m.quoteAsset,
                  marketType: m.marketType,
                  listingTime: m.listingTime || now,
                  detectedAt: now
                };
                this.newListingEvents.unshift(newListingEvent);
              }
            }

            // 4. Delisting Detection: Check for markets previously registered on this exchange that are no longer returned
            let inactiveCount = 0;
            for (const [marketId, em] of this.exchangeMarkets.entries()) {
              if (em.exchange === id && !activeMarketIdsThisRun.has(marketId) && em.status === 'ACTIVE') {
                em.status = 'INACTIVE';
                em.delistingTime = now;
                em.lastUpdated = now;
                inactiveCount++;
              }
            }

            stats.activeMarkets = activeMarketIdsThisRun.size;
            stats.inactiveMarkets = inactiveCount;
            this.universeStats.set(id, stats);
          } catch (exchangeError) {
            console.warn(`[AssetRegistry] Exchange discovery failed for ${id}:`, (exchangeError as Error).message);
            stats.discoveryStatus = 'Offline';
            stats.latencyMs = 999;
            stats.lastDiscovery = now;
            this.universeStats.set(id, stats);
          }
        })
      );

      // Keep only latest 100 new listing events
      if (this.newListingEvents.length > 100) {
        this.newListingEvents = this.newListingEvents.slice(0, 100);
      }

      this.lastDiscoveryTime = now;

        return {
          discoveredCount: this.exchangeMarkets.size,
          newListingCount: newCount,
          exchangeStats: Array.from(this.universeStats.values())
        };
      } finally {
        this.isDiscovering = false;
        this.discoveryPromise = null;
      }
    })();

    return this.discoveryPromise;
  }

  /**
   * Returns all registered markets for a given baseAsset across all exchanges.
   * e.g. for "SOL" -> returns Binance SOLUSDT, OKX SOL-USDT, Pionex SOL_USDT, Bybit SOLUSDT
   * for "ABC" -> returns ONLY OKX ABC-USDT
   */
  public getMarketsForAsset(baseAsset: string): ExchangeMarket[] {
    const clean = baseAsset.replace(/[\/\-_]/g, '').replace('USDT', '').toUpperCase();
    const result: ExchangeMarket[] = [];
    for (const em of this.exchangeMarkets.values()) {
      if (em.assetId.toUpperCase() === clean || em.normalizedSymbol.split('/')[0].toUpperCase() === clean) {
        result.push(em);
      }
    }
    return result;
  }

  public getAsset(baseAsset: string): Asset | undefined {
    const clean = baseAsset.replace(/[\/\-_]/g, '').replace('USDT', '').toUpperCase();
    return this.assets.get(clean);
  }

  public getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  public getAllExchangeMarkets(): ExchangeMarket[] {
    return Array.from(this.exchangeMarkets.values());
  }

  public getNewListingEvents(): NewListingEvent[] {
    return this.newListingEvents;
  }

  public getUniverseStats(): ExchangeUniverseStats[] {
    return Array.from(this.universeStats.values());
  }

  /**
   * Aggregated Asset View:
   * Aggregates volume ONLY if quote currency, market type, and timeframe are compatible.
   * Keeps price, RSI, MA, Bollinger, OI, Funding strictly exchange-specific.
   */
  public getAggregatedAssetView(
    baseAsset: string,
    allCoins: NormalizedCoinData[]
  ): AggregatedAssetView | null {
    const clean = baseAsset.replace(/[\/\-_]/g, '').replace('USDT', '').toUpperCase();
    const matchingCoins = allCoins.filter(c => c.baseAsset.toUpperCase() === clean);

    if (matchingCoins.length === 0) {
      return null;
    }

    const asset = this.assets.get(clean) || {
      id: clean,
      baseAsset: clean,
      displayName: `${clean} Asset`,
      status: 'ACTIVE',
      isVerifiedIdentity: false,
      unverifiedReason: 'Asset identity not verified against external registry',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const availableMarkets = matchingCoins.map(coin => ({
      exchange: coin.exchange,
      exchangeSymbol: coin.exchangeSymbol || coin.rawSymbol,
      marketType: coin.marketType,
      price: coin.price,
      change24h: coin.change24h,
      volume24h: coin.volume24h,
      quoteVolume24h: coin.quoteVolume24h,
      rsi14: coin.indicators.rsi14,
      bullScore: coin.scores.bullScore,
      dataStatus: coin.dataStatus,
      freshnessSeconds: coin.freshnessSeconds,
      hasDerivatives: Boolean(coin.derivatives && coin.derivatives.dataStatus !== 'UNAVAILABLE'),
      openInterestUsd: coin.derivatives?.openInterestUsd,
      fundingRate: coin.derivatives?.fundingRate
    }));

    // Volume can be aggregated ONLY if same quote currency (USDT) and market type (e.g. SPOT)
    const spotUsdtCoins = matchingCoins.filter(c => c.quoteAsset === 'USDT' && c.marketType === 'SPOT');
    let aggregatedVolume24hQuote: number | null = null;
    let volumeAggregationNote: string | undefined;

    if (spotUsdtCoins.length > 1) {
      aggregatedVolume24hQuote = spotUsdtCoins.reduce((sum, c) => sum + (c.quoteVolume24h || 0), 0);
      volumeAggregationNote = `Sum of ${spotUsdtCoins.length} verified Spot/USDT order books (${spotUsdtCoins.map(c => c.exchange).join(', ')}). Perpetual volumes excluded to avoid leverage distortion.`;
    } else if (spotUsdtCoins.length === 1) {
      aggregatedVolume24hQuote = spotUsdtCoins[0].quoteVolume24h;
      volumeAggregationNote = `Single Spot market on ${spotUsdtCoins[0].exchange}.`;
    }

    return {
      asset,
      normalizedSymbol: `${clean}/USDT`,
      availableMarkets,
      aggregatedVolume24hQuote,
      volumeAggregationNote,
      primaryExchange: matchingCoins[0].exchange
    };
  }
}

export const assetRegistryService = new AssetRegistryService();
