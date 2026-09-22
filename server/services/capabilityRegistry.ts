import { ExchangeId, Timeframe } from '../../src/types';
import { ExchangeCapabilities } from '../types/marketDataEngine';

export class ExchangeCapabilityRegistry {
  private capabilities: Map<ExchangeId, ExchangeCapabilities> = new Map();

  constructor() {
    this.registerCapabilities();
  }

  private registerCapabilities() {
    // BINANCE: Comprehensive Spot + Futures / Perpetual support
    this.capabilities.set('BINANCE', {
      exchange: 'BINANCE',
      spot: true,
      futures: true,
      perpetual: true,
      swap: false,
      ohlcv: true,
      openInterest: true,
      funding: true,
      liquidations: true,
      orderBook: true,
      trades: true,
      markPrice: true,
      indexPrice: true,
      websocket: true,
      restFallback: true,
      status: 'LIVE',
      supportedTimeframes: ['5m', '15m', '1h', '4h', '1D']
    });

    // OKX: Comprehensive Spot + Swap (Perpetual) support
    // Note: Public unauthenticated liquidations are not exposed on OKX public REST, so liquidations is false.
    this.capabilities.set('OKX', {
      exchange: 'OKX',
      spot: true,
      futures: false,
      perpetual: true,
      swap: true,
      ohlcv: true,
      openInterest: true,
      funding: true,
      liquidations: false,
      orderBook: true,
      trades: true,
      markPrice: true,
      indexPrice: true,
      websocket: true,
      restFallback: true,
      status: 'LIVE',
      supportedTimeframes: ['5m', '15m', '1h', '4h', '1D']
    });

    // PIONEX: Spot and Aggregated Order Book / Grid Trading universe
    // Does not provide public derivatives / open interest / liquidations
    this.capabilities.set('PIONEX', {
      exchange: 'PIONEX',
      spot: true,
      futures: false,
      perpetual: false,
      swap: false,
      ohlcv: true,
      openInterest: false,
      funding: false,
      liquidations: false,
      orderBook: true,
      trades: true,
      markPrice: false,
      indexPrice: false,
      websocket: false,
      restFallback: true,
      status: 'PARTIAL',
      supportedTimeframes: ['5m', '15m', '1h', '4h', '1D']
    });

    // BYBIT: Linear perpetual contracts focus
    this.capabilities.set('BYBIT', {
      exchange: 'BYBIT',
      spot: false,
      futures: false,
      perpetual: true,
      swap: false,
      ohlcv: true,
      openInterest: true,
      funding: true,
      liquidations: true,
      orderBook: true,
      trades: false,
      markPrice: true,
      indexPrice: true,
      websocket: true,
      restFallback: true,
      status: 'LIVE',
      supportedTimeframes: ['5m', '15m', '1h', '4h', '1D']
    });
  }

  public getCapabilities(exchange: ExchangeId): ExchangeCapabilities {
    const caps = this.capabilities.get(exchange);
    if (!caps) {
      return {
        exchange,
        spot: true,
        futures: false,
        perpetual: false,
        swap: false,
        ohlcv: true,
        openInterest: false,
        funding: false,
        liquidations: false,
        orderBook: false,
        trades: false,
        markPrice: false,
        indexPrice: false,
        websocket: false,
        restFallback: true,
        status: 'DEGRADED',
        supportedTimeframes: ['1h']
      };
    }
    return { ...caps };
  }

  public getAllCapabilities(): ExchangeCapabilities[] {
    return Array.from(this.capabilities.values());
  }

  public supports(exchange: ExchangeId, capability: keyof ExchangeCapabilities): boolean {
    const caps = this.getCapabilities(exchange);
    return Boolean(caps[capability]);
  }
}

export const exchangeCapabilityRegistry = new ExchangeCapabilityRegistry();
