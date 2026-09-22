import { ExchangeId } from '../../src/types';
import { PipelineLogEvent } from '../types/marketDataEngine';
import { db } from '../db/schema';

export class PipelineLogger {
  private logs: PipelineLogEvent[] = [];
  private maxLogs = 500;

  public log(
    exchange: ExchangeId,
    operation: string,
    message: string,
    options?: {
      market?: string;
      errorCode?: PipelineLogEvent['errorCode'];
      retryCount?: number;
      latency?: number;
    }
  ): PipelineLogEvent {
    const event: PipelineLogEvent = {
      id: `pipe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      exchange,
      market: options?.market,
      operation,
      errorCode: options?.errorCode,
      message,
      retryCount: options?.retryCount,
      latency: options?.latency
    };

    this.logs.unshift(event);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Mirror error / rate limit logs into central system logs
    if (options?.errorCode) {
      const level = options.errorCode === 'RATE_LIMIT' || options.errorCode === 'CIRCUIT_BREAKER_OPEN'
        ? 'WARNING'
        : 'ERROR';
      db.addSystemLog(
        level,
        exchange === 'BINANCE' ? 'BINANCE' : exchange === 'BYBIT' ? 'BYBIT' : 'SYSTEM',
        `[${options.errorCode}] ${operation}: ${message}`,
        options.market,
        { latency: options.latency, retryCount: options.retryCount }
      );
    }

    return event;
  }

  public getRecentLogs(limit: number = 50, filterExchange?: ExchangeId): PipelineLogEvent[] {
    if (filterExchange) {
      return this.logs.filter(l => l.exchange === filterExchange).slice(0, limit);
    }
    return this.logs.slice(0, limit);
  }

  public clearLogs(): void {
    this.logs = [];
  }
}

export const pipelineLogger = new PipelineLogger();
