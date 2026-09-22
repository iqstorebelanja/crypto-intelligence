import { NaturalQueryFilterResult, NormalizedCoinData } from '../../src/types';

export class MarketQueryParser {
  /**
   * Parse a natural-language user query into structured intent and filters.
   */
  public parseQuery(query: string): NaturalQueryFilterResult {
    const q = (query || '').trim().toLowerCase();

    // 1. COMPARISON INTENT (e.g. "compare BTC vs ETH", "compare SOL and AVAX", "BTC vs ETH")
    const compareMatch = q.match(/compare\s+([a-z0-9]+)\s+(?:and|vs|to)\s+([a-z0-9]+)/i) ||
                         q.match(/([a-z0-9]+)\s+vs\s+([a-z0-9]+)/i);
    if (compareMatch) {
      const symA = this.normalizeSymbol(compareMatch[1]);
      const symB = this.normalizeSymbol(compareMatch[2]);
      return {
        intent: 'COMPARE',
        targetSymbol: symA,
        secondarySymbol: symB,
        summaryText: `Side-by-side technical & derivatives comparison: ${symA} vs ${symB}`
      };
    }

    // 2. EXPLAIN SCORE INTENT (e.g. "why is bull score high for SOL", "explain downside risk for BTC")
    const explainMatch = q.match(/(?:why|explain|what drives|reason for).*(bull|downside|risk|score).*(?:for|on|in)?\s+([a-z0-9]+)?/i);
    if (explainMatch) {
      const symbol = this.extractSymbol(q) || 'BTC/USDT';
      return {
        intent: 'EXPLAIN_SCORE',
        targetSymbol: symbol,
        summaryText: `Decomposing algorithmic factor weights for ${symbol}`
      };
    }

    // 3. CONFLICTS INTENT (e.g. "which indicators are conflicting", "indicator conflicts on BTC")
    if (q.includes('conflict') || q.includes('divergence') || q.includes('disagree')) {
      const symbol = this.extractSymbol(q) || 'BTC/USDT';
      return {
        intent: 'CONFLICTS',
        targetSymbol: symbol,
        summaryText: `Auditing technical vs derivative indicator conflicts for ${symbol}`
      };
    }

    // 4. HISTORICAL CHANGE INTENT (e.g. "what changed in the last 6 hours", "historical change for SOL")
    if (q.includes('change') && (q.includes('hour') || q.includes('last') || q.includes('history') || q.includes('recent'))) {
      const symbol = this.extractSymbol(q) || 'BTC/USDT';
      return {
        intent: 'HISTORY',
        targetSymbol: symbol,
        summaryText: `Analyzing multi-timeframe structural and derivative deltas for ${symbol}`
      };
    }

    // 5. WHALE INTENT (e.g. "show whale transactions above $10M", "whale activity for SOL")
    if (q.includes('whale') || q.includes('on-chain') || q.includes('exchange flow') || q.includes('inflow') || q.includes('outflow')) {
      const symbol = this.extractSymbol(q);
      let minWhaleUsd = 1_000_000;
      const millionMatch = q.match(/(\d+(?:\.\d+)?)\s*m/i) || q.match(/\$(\d+(?:\.\d+)?)\s*million/i);
      if (millionMatch) {
        minWhaleUsd = parseFloat(millionMatch[1]) * 1_000_000;
      }
      return {
        intent: 'WHALES',
        targetSymbol: symbol,
        filters: { minWhaleUsd },
        summaryText: `Scanning institutional whale transactions (threshold: >= $${(minWhaleUsd / 1_000_000).toFixed(1)}M)`
      };
    }

    // 6. SINGLE COIN ANALYSIS (e.g. "analyze SOL", "SOL breakdown", "how is BTC looking")
    const analyzeMatch = q.match(/(?:analyze|review|check|outlook|status)\s+([a-z0-9]+)/i);
    if (analyzeMatch) {
      const symbol = this.normalizeSymbol(analyzeMatch[1]);
      return {
        intent: 'ANALYZE',
        targetSymbol: symbol,
        summaryText: `Comprehensive multi-factor analysis for ${symbol}`
      };
    }

    // If query is just a symbol like "SOL", "BTC/USDT", "ETH"
    const standaloneSym = this.extractSymbol(q);
    if (standaloneSym && q.split(/\s+/).length <= 2) {
      return {
        intent: 'ANALYZE',
        targetSymbol: standaloneSym,
        summaryText: `Multi-factor technical & derivatives analysis for ${standaloneSym}`
      };
    }

    // 7. SCANNER INTENT: Extract multi-condition structured filters
    const filters: NaturalQueryFilterResult['filters'] = {};
    const conditionsFound: string[] = [];

    // Bull Score filter: "Bull Score above 75", "bull score > 80", "bullish > 70"
    const bullMatch = q.match(/bull(?: score)?\s*(?:above|>|>=|greater than|higher than)\s*(\d+)/i) ||
                      q.match(/(?:high|strong) bull(?: score)?/i);
    if (bullMatch) {
      const val = bullMatch[1] ? parseInt(bullMatch[1]) : 70;
      filters.bullMin = val;
      conditionsFound.push(`Bull Score >= ${val}`);
    }

    // Downside Risk filter: "downside risk above 70", "risk > 65", "elevated downside risk"
    const riskMatch = q.match(/(?:downside|risk|crash risk)\s*(?:above|>|>=|greater than|higher than)\s*(\d+)/i) ||
                      q.match(/(?:high|elevated) (?:downside|risk)/i);
    if (riskMatch) {
      const val = riskMatch[1] ? parseInt(riskMatch[1]) : 65;
      filters.riskMin = val;
      conditionsFound.push(`Downside Risk >= ${val}`);
    }

    // Volume Ratio filter: "volume more than 3x", "volume > 2x average", "volume spike"
    const volMatch = q.match(/volume\s*(?:more than|>|>=|greater than)?\s*(\d+(?:\.\d+)?)\s*x/i) ||
                     q.match(/volume\s*(?:above|>|>=)\s*(\d+(?:\.\d+)?)/i);
    if (volMatch) {
      const val = parseFloat(volMatch[1]);
      filters.volRatioMin = val;
      conditionsFound.push(`Volume Ratio >= ${val}x`);
    } else if (q.includes('volume spike') || q.includes('increasing volume') || q.includes('surging volume')) {
      filters.volRatioMin = 1.8;
      conditionsFound.push(`Volume Ratio >= 1.8x`);
    }

    // RSI filter: "RSI below 35", "RSI < 30", "oversold RSI", "RSI above 70"
    const rsiBelowMatch = q.match(/rsi\s*(?:below|<|<=|under|less than)\s*(\d+)/i);
    if (rsiBelowMatch) {
      const val = parseInt(rsiBelowMatch[1]);
      filters.rsiMax = val;
      conditionsFound.push(`RSI14 <= ${val}`);
    } else if (q.includes('oversold')) {
      filters.rsiMax = 35;
      conditionsFound.push(`RSI14 <= 35`);
    }

    const rsiAboveMatch = q.match(/rsi\s*(?:above|>|>=|over|greater than)\s*(\d+)/i);
    if (rsiAboveMatch) {
      const val = parseInt(rsiAboveMatch[1]);
      filters.rsiMin = val;
      conditionsFound.push(`RSI14 >= ${val}`);
    } else if (q.includes('overbought')) {
      filters.rsiMin = 70;
      conditionsFound.push(`RSI14 >= 70`);
    }

    // Moving Averages: "above MA20", "above MA50", "above MA200", "above all MAs"
    if (q.includes('above all ma') || q.includes('above all moving averages') || q.includes('bullish alignment')) {
      filters.aboveMa20 = true;
      filters.aboveMa50 = true;
      filters.aboveMa200 = true;
      conditionsFound.push('Price above MA20, MA50 & MA200');
    } else {
      if (q.includes('above ma20') || q.includes('above 20 ma')) {
        filters.aboveMa20 = true;
        conditionsFound.push('Price > MA20');
      }
      if (q.includes('above ma50') || q.includes('above 50 ma')) {
        filters.aboveMa50 = true;
        conditionsFound.push('Price > MA50');
      }
      if (q.includes('above ma200') || q.includes('above 200 ma')) {
        filters.aboveMa200 = true;
        conditionsMinPush(conditionsFound, 'Price > MA200');
        filters.aboveMa200 = true;
      }
    }

    // Derivatives: "increasing OI", "rising price and increasing OI", "high funding"
    if (q.includes('increasing oi') || q.includes('rising oi') || q.includes('oi expansion') || q.includes('higher oi')) {
      filters.oiExpanding = true;
      conditionsFound.push('Open Interest Expanding (+24h)');
    }

    if (q.includes('high funding') || q.includes('elevated funding') || q.includes('crowded long')) {
      filters.highFunding = true;
      conditionsFound.push('Elevated Funding Rate (> 0.015%)');
    }

    // Market Structure: "potential breakout", "breaking out", "bearish structure"
    if (q.includes('breakout') || q.includes('breaking out')) {
      filters.breakoutOnly = true;
      conditionsFound.push('Confirmed / Potential Breakout');
    }

    if (q.includes('bearish structure') || q.includes('lower highs') || q.includes('breakdown')) {
      filters.bearishStructureOnly = true;
      conditionsFound.push('Bearish Structure (Lower Highs / Breakdown)');
    }

    if (conditionsFound.length > 0) {
      return {
        intent: 'SCAN',
        filters,
        summaryText: `Scanner query: ${conditionsFound.join(', ')}`
      };
    }

    // Fallback: If no specific pattern recognized, treat as general scan or ask for clarification
    return {
      intent: 'UNKNOWN',
      summaryText: `Query "${query}" processed. Displaying comprehensive market scan.`
    };
  }

  /**
   * Filter an array of NormalizedCoinData against the parsed criteria.
   */
  public filterCoins(coins: NormalizedCoinData[], result: NaturalQueryFilterResult): NormalizedCoinData[] {
    if (!result.filters) return coins;
    const f = result.filters;

    return coins.filter(coin => {
      if (f.bullMin !== null && f.bullMin !== undefined) {
        if (coin.scores.bullScore < f.bullMin) return false;
      }

      if (f.riskMin !== null && f.riskMin !== undefined) {
        if (coin.scores.downsideRiskScore < f.riskMin) return false;
      }

      if (f.volRatioMin !== null && f.volRatioMin !== undefined) {
        if (coin.indicators.volumeAnalysis.ratio < f.volRatioMin) return false;
      }

      if (f.rsiMin !== null && f.rsiMin !== undefined) {
        if (coin.indicators.rsi14 < f.rsiMin) return false;
      }

      if (f.rsiMax !== null && f.rsiMax !== undefined) {
        if (coin.indicators.rsi14 > f.rsiMax) return false;
      }

      if (f.aboveMa20 && coin.indicators.priceVsMa20 !== 'above') return false;
      if (f.aboveMa50 && coin.indicators.priceVsMa50 !== 'above') return false;
      if (f.aboveMa200 && coin.indicators.priceVsMa200 !== 'above') return false;

      if (f.oiExpanding) {
        if (!coin.derivatives || (coin.derivatives.openInterestChange24h ?? 0) <= 0) return false;
      }

      if (f.highFunding) {
        if (!coin.derivatives || (coin.derivatives.fundingRate ?? 0) < 0.00015) return false;
      }

      if (f.breakoutOnly) {
        const isBreakout = coin.marketStructure?.event === 'Potential Breakout' || coin.marketStructure?.state === 'Higher High (HH)';
        if (!isBreakout) return false;
      }

      if (f.bearishStructureOnly) {
        const isBearish = coin.marketStructure?.event === 'Potential Breakdown' || coin.marketStructure?.state === 'Lower Low (LL)';
        if (!isBearish) return false;
      }

      return true;
    });
  }

  private extractSymbol(text: string): string | undefined {
    const words = text.toUpperCase().replace(/[^A-Z0-9/_\-]/g, ' ').split(/\s+/).filter(Boolean);

    // 1. Check for explicit USDT pairs (e.g. ABC/USDT, ABC-USDT, ABC_USDT, ABCUSDT)
    for (const w of words) {
      if (w.includes('/USDT') || w.includes('-USDT') || w.includes('_USDT') || (w.endsWith('USDT') && w.length > 4)) {
        const base = w.replace('/USDT', '').replace('-USDT', '').replace('_USDT', '').replace('USDT', '');
        return `${base}/USDT`;
      }
    }

    // 2. Check for isolated ticker symbols (e.g. ABC, BTC, ETH, XYZ)
    const stopWords = new Set([
      'ANALYZE', 'COMPARE', 'SHOW', 'WHAT', 'TELL', 'FOR', 'WITH', 'FROM',
      'THE', 'COIN', 'TOKEN', 'PRICE', 'SCORE', 'RISK', 'RATE', 'DATA',
      'CHART', 'SWING', 'BULL', 'BEAR', 'HIGH', 'LOW', 'TODAY', 'NOW',
      'MARKET', 'CHECK', 'SCAN', 'WHALE', 'WHALES', 'FLOW', 'FLOWS', 'VS', 'AND', 'OR'
    ]);

    for (const w of words) {
      if (!stopWords.has(w) && w.length >= 2 && w.length <= 10 && /^[A-Z0-9]+$/.test(w)) {
        return `${w}/USDT`;
      }
    }

    return undefined;
  }

  private normalizeSymbol(sym: string): string {
    const clean = sym.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (clean.endsWith('USDT')) {
      return `${clean.replace('USDT', '')}/USDT`;
    }
    return `${clean}/USDT`;
  }
}

function conditionsMinPush(arr: string[], item: string) {
  if (!arr.includes(item)) arr.push(item);
}

export const marketQueryParser = new MarketQueryParser();
