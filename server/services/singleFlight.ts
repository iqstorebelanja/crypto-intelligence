import { ExchangeId } from '../../src/types';
import { pipelineLogger } from './pipelineLogger';

export interface SingleFlightStats {
  inFlightCount: number;
  deduplicatedCount: number;
  totalExecutions: number;
  rateLimitHits: number;
  circuitBreaks: number;
}

export class SingleFlightQueue {
  private inFlightPromises: Map<string, Promise<any>> = new Map();
  private exchangeActiveCounts: Map<ExchangeId, number> = new Map();
  private exchangeMaxConcurrency: Map<ExchangeId, number> = new Map([
    ['BINANCE', 12],
    ['OKX', 8],
    ['PIONEX', 6],
    ['BYBIT', 8]
  ]);
  private exchangeCircuitOpenUntil: Map<ExchangeId, number> = new Map();

  private stats: SingleFlightStats = {
    inFlightCount: 0,
    deduplicatedCount: 0,
    totalExecutions: 0,
    rateLimitHits: 0,
    circuitBreaks: 0
  };

  /**
   * Execute or join an in-flight promise for the identical key.
   * If 10 components ask for `binance:BTCUSDT:spot:1h:ohlcv`, only 1 executes upstream.
   */
  public async execute<T>(
    key: string,
    exchange: ExchangeId,
    fetcher: () => Promise<T>,
    options?: { maxRetries?: number; timeoutMs?: number }
  ): Promise<T> {
    // 1. Single-Flight Coalescing: check if this identical request is already running
    const existing = this.inFlightPromises.get(key);
    if (existing) {
      this.stats.deduplicatedCount += 1;
      return existing as Promise<T>;
    }

    // 2. Check Circuit Breaker for this exchange
    const circuitUntil = this.exchangeCircuitOpenUntil.get(exchange) || 0;
    if (circuitUntil > Date.now()) {
      const waitSec = Math.ceil((circuitUntil - Date.now()) / 1000);
      pipelineLogger.log(exchange, 'execute', `Circuit breaker open for ${exchange}, cooling down for ${waitSec}s`, {
        errorCode: 'CIRCUIT_BREAKER_OPEN'
      });
      throw new Error(`Circuit breaker open for ${exchange}. Cool down active.`);
    }

    const maxRetries = options?.maxRetries ?? 2;
    const timeoutMs = options?.timeoutMs ?? 10000;

    // 3. Create execution promise with concurrency control & retries
    const executionPromise = (async () => {
      this.stats.totalExecutions += 1;
      this.stats.inFlightCount += 1;

      try {
        await this.acquireConcurrencySlot(exchange);

        let attempt = 0;
        while (attempt <= maxRetries) {
          try {
            const result = await Promise.race([
              fetcher(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Upstream request timed out after ${timeoutMs}ms`)), timeoutMs)
              )
            ]);
            return result;
          } catch (err: any) {
            attempt++;
            const msg = err?.message || String(err);
            const isRateLimit = msg.includes('429') || msg.includes('rate limit') || msg.includes('Too Many Requests');

            if (isRateLimit) {
              this.stats.rateLimitHits += 1;
              pipelineLogger.log(exchange, 'execute', `Rate limit detected: ${msg}`, {
                errorCode: 'RATE_LIMIT',
                retryCount: attempt
              });

              // Trip temporary circuit breaker for this exchange (cool down 8s)
              this.exchangeCircuitOpenUntil.set(exchange, Date.now() + 8000);
            }

            if (attempt > maxRetries) {
              throw err;
            }

            // Exponential backoff with jitter: 200ms, 600ms, 1200ms + random jitter
            const backoffMs = Math.min(2000, 200 * Math.pow(2, attempt) + Math.random() * 150);
            await new Promise(r => setTimeout(r, backoffMs));
          }
        }
        throw new Error(`Max retries exceeded for ${key}`);
      } finally {
        this.releaseConcurrencySlot(exchange);
        this.inFlightPromises.delete(key);
        this.stats.inFlightCount = Math.max(0, this.stats.inFlightCount - 1);
      }
    })();

    this.inFlightPromises.set(key, executionPromise);
    return executionPromise;
  }

  private async acquireConcurrencySlot(exchange: ExchangeId): Promise<void> {
    const max = this.exchangeMaxConcurrency.get(exchange) || 6;
    while ((this.exchangeActiveCounts.get(exchange) || 0) >= max) {
      await new Promise(r => setTimeout(r, 50));
    }
    const current = this.exchangeActiveCounts.get(exchange) || 0;
    this.exchangeActiveCounts.set(exchange, current + 1);
  }

  private releaseConcurrencySlot(exchange: ExchangeId): void {
    const current = this.exchangeActiveCounts.get(exchange) || 0;
    this.exchangeActiveCounts.set(exchange, Math.max(0, current - 1));
  }

  public getStats(): SingleFlightStats {
    return { ...this.stats };
  }
}

export const singleFlight = new SingleFlightQueue();
