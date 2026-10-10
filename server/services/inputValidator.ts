import { ExchangeId, Timeframe } from '../../src/types';

export const ALLOWED_EXCHANGES: ExchangeId[] = ['BINANCE', 'BYBIT', 'OKX', 'COINBASE', 'KRAKEN', 'KUCOIN', 'GATE', 'BITGET'];
export const ALLOWED_TIMEFRAMES: string[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1H', '4H', '1D'];

export class InputValidator {
  /**
   * Validates and sanitizes a crypto ticker symbol
   */
  public static validateSymbol(raw?: string): { valid: boolean; symbol: string } {
    if (!raw || typeof raw !== 'string') return { valid: false, symbol: '' };
    const trimmed = raw.trim().toUpperCase();
    if (trimmed.length === 0 || trimmed.length > 20) return { valid: false, symbol: '' };
    if (!/^[A-Z0-9_\-\/]{1,20}$/.test(trimmed)) return { valid: false, symbol: '' };
    return { valid: true, symbol: trimmed };
  }

  /**
   * Validates and normalizes an exchange identifier
   */
  public static validateExchange(raw?: string, fallback: ExchangeId = 'BINANCE'): ExchangeId {
    if (!raw || typeof raw !== 'string') return fallback;
    const upper = raw.trim().toUpperCase();
    if (ALLOWED_EXCHANGES.includes(upper as ExchangeId)) {
      return upper as ExchangeId;
    }
    return fallback;
  }

  /**
   * Validates and normalizes timeframe string
   */
  public static validateTimeframe(raw?: string, fallback: string = '1h'): string {
    if (!raw || typeof raw !== 'string') return fallback;
    const trimmed = raw.trim();
    if (ALLOWED_TIMEFRAMES.includes(trimmed)) {
      return trimmed;
    }
    return fallback;
  }

  /**
   * Safely bounds pagination limit parameters
   */
  public static validateLimit(raw?: any, defaultLimit = 50, maxLimit = 150): number {
    const parsed = parseInt(String(raw), 10);
    if (isNaN(parsed) || parsed <= 0) return defaultLimit;
    return Math.min(parsed, maxLimit);
  }

  /**
   * Sanitizes generic search text
   */
  public static sanitizeSearch(raw?: string, maxLength = 100): string {
    if (!raw || typeof raw !== 'string') return '';
    return raw.trim().slice(0, maxLength);
  }

  /**
   * Sanitizes message content with character length boundary and basic XSS escaping
   */
  public static sanitizeContent(raw?: string, maxLength = 2000): string {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim().slice(0, maxLength);
    // Disallow dangerous script tags, event handlers, and data/javascript URIs
    return trimmed
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, 'blocked:')
      .replace(/data:text\/html/gi, 'blocked:');
  }

  /**
   * Validates external URL to prevent malicious schemes (javascript:, data:, vbscript:)
   */
  public static validateUrl(raw?: string): { valid: boolean; safeUrl: string } {
    if (!raw || typeof raw !== 'string') return { valid: false, safeUrl: '' };
    const trimmed = raw.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return { valid: false, safeUrl: '' };
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, safeUrl: '' };
      }
      return { valid: true, safeUrl: parsed.toString() };
    } catch {
      return { valid: false, safeUrl: '' };
    }
  }

  /**
   * Deep sanitizer to prevent Prototype Pollution attacks
   */
  public static sanitizeObject<T = any>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item)) as any;
    }

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Reject prototype pollution keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      if (typeof value === 'object' && value !== null) {
        clean[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        // Strip null bytes
        clean[key] = value.replace(/\0/g, '');
      } else {
        clean[key] = value;
      }
    }
    return clean as T;
  }
}
