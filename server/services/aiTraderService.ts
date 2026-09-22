import { GoogleGenAI } from '@google/genai';
import { aiToolLayer } from '../engine/aiTools';
import { marketQueryParser } from '../engine/marketQueryParser';
import { monitoringService } from './monitoringService';
import { assetRegistryService } from './assetRegistryService';
import {
  AIComparisonResult,
  AIMessage,
  AIToolInvocation,
  ExchangeId,
  StructuredAIAnalysis,
  Timeframe
} from '../../src/types';

export const MANDATORY_DISCLAIMER = 'DYOR — Do Your Own Research. Not Financial Advice.';

let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

export class AiTraderService {
  /**
   * Main entry point for processing an AI Trader message
   */
  public async handleMessage(userPrompt: string, exchange: ExchangeId = 'BINANCE'): Promise<AIMessage> {
    const prompt = (userPrompt || '').trim();
    const startTime = Date.now();
    const toolsInvoked: AIToolInvocation[] = [];

    // Parse user natural-language query to extract intent, symbols, and filters
    const parsed = marketQueryParser.parseQuery(prompt);

    // Route according to detected intent
    if (parsed.intent === 'COMPARE' && parsed.targetSymbol && parsed.secondarySymbol) {
      return this.handleComparison(prompt, parsed.targetSymbol, parsed.secondarySymbol, exchange, toolsInvoked);
    }

    if (parsed.intent === 'WHALES') {
      return this.handleWhaleQuery(prompt, parsed.targetSymbol, parsed.filters?.minWhaleUsd, toolsInvoked);
    }

    if (parsed.intent === 'SCAN') {
      return this.handleScanQuery(prompt, parsed, exchange, toolsInvoked);
    }

    if (parsed.intent === 'CONFLICTS') {
      const sym = parsed.targetSymbol || 'BTC/USDT';
      return this.handleConflictsQuery(prompt, sym, exchange, toolsInvoked);
    }

    if (parsed.intent === 'HISTORY') {
      const sym = parsed.targetSymbol || 'BTC/USDT';
      return this.handleHistoryQuery(prompt, sym, exchange, toolsInvoked);
    }

    if (parsed.intent === 'EXPLAIN_SCORE') {
      const sym = parsed.targetSymbol || 'BTC/USDT';
      return this.handleExplainScoreQuery(prompt, sym, exchange, toolsInvoked);
    }

    // Default: Single coin analysis or general technical query
    const targetSymbol = parsed.targetSymbol || 'BTC/USDT';
    return this.handleCoinAnalysis(prompt, targetSymbol, exchange, toolsInvoked);
  }

  /**
   * 1. Single Coin Analysis with strict tool grounding
   */
  private async handleCoinAnalysis(
    userPrompt: string,
    symbol: string,
    exchange: ExchangeId,
    toolsInvoked: AIToolInvocation[]
  ): Promise<AIMessage> {
    const t0 = Date.now();

    // Cross-Exchange Asset Resolution: if coin not on requested exchange, check asset registry!
    const baseAsset = symbol.replace(/[\/\-_]/g, '').replace('USDT', '').toUpperCase();
    const availableMarkets = assetRegistryService.getMarketsForAsset(baseAsset);
    let activeExchange = exchange;
    let exchangeSwitchNote = '';

    if (availableMarkets.length > 0 && !availableMarkets.some(m => m.exchange === exchange)) {
      activeExchange = availableMarkets[0].exchange;
      exchangeSwitchNote = `[Multi-Exchange Discovery] Note: **${baseAsset}** is active on **${activeExchange}** (${availableMarkets[0].exchangeSymbol}) in the supported exchange universe (not listed on ${exchange}). Analyzing live ${activeExchange} market data.\n\n`;
    }

    // Step 1: Execute all backend tools in parallel
    const [marketData, technicals, derivatives, structure, scores, btcContext, whaleActivity, conflicts] = await Promise.all([
      this.timedCall('getMarketData', { symbol, exchange: activeExchange, timeframe: '1h' }, toolsInvoked, () =>
        aiToolLayer.getMarketData({ symbol, exchange: activeExchange, timeframe: '1h' })
      ),
      this.timedCall('getTechnicalIndicators', { symbol, exchange: activeExchange, timeframe: '1h' }, toolsInvoked, () =>
        aiToolLayer.getTechnicalIndicators({ symbol, exchange: activeExchange, timeframe: '1h' })
      ),
      this.timedCall('getDerivatives', { symbol, exchange: activeExchange }, toolsInvoked, () =>
        aiToolLayer.getDerivatives({ symbol, exchange: activeExchange })
      ),
      this.timedCall('getMarketStructure', { symbol, exchange: activeExchange, timeframe: '1h' }, toolsInvoked, () =>
        aiToolLayer.getMarketStructure({ symbol, exchange: activeExchange, timeframe: '1h' })
      ),
      this.timedCall('getScores', { symbol, exchange: activeExchange, timeframe: '1h' }, toolsInvoked, () =>
        aiToolLayer.getScores({ symbol, exchange: activeExchange, timeframe: '1h' })
      ),
      this.timedCall('getBTCContext', { exchange: activeExchange }, toolsInvoked, () =>
        aiToolLayer.getBTCContext(activeExchange)
      ),
      this.timedCall('getWhaleActivity', { symbol }, toolsInvoked, () =>
        aiToolLayer.getWhaleActivity({ symbol, limit: 5 })
      ),
      this.timedCall('getIndicatorConflicts', { symbol, exchange: activeExchange, timeframe: '1h' }, toolsInvoked, () =>
        aiToolLayer.getIndicatorConflicts({ symbol, exchange: activeExchange, timeframe: '1h' })
      )
    ]);

    // Construct Bullish, Bearish, and Scenario factors from factual data
    const bullishFactors: string[] = [];
    const bearishFactors: string[] = [];

    if (technicals.priceVsMA20 === 'above') bullishFactors.push('Price holding cleanly above 20-period Moving Average (short-term trend support).');
    if (technicals.priceVsMA50 === 'above') bullishFactors.push('Price sustaining position above 50-period Moving Average.');
    if (technicals.priceVsMA200 === 'above') bullishFactors.push('Positioned above 200-period Moving Average (macro bullish structure).');
    if (technicals.volumeRatio >= 1.5) bullishFactors.push(`Volume expanding at ${technicals.volumeRatio}x average (elevated institutional liquidity).`);
    if (structure.breakout) bullishFactors.push(`Confirmed structural breakout past resistance level ($${structure.resistance.toLocaleString()}).`);
    if (structure.structure === 'Higher High (HH)' || structure.structure === 'Higher Low (HL)') bullishFactors.push('Clean sequential Higher Highs or Higher Lows price action.');
    if (derivatives.available && derivatives.openInterestChange !== null && derivatives.openInterestChange > 2) bullishFactors.push(`Open Interest expanding (+${derivatives.openInterestChange.toFixed(2)}%) indicating active capital inflow.`);

    if (technicals.rsi14 >= 72) bearishFactors.push(`RSI14 elevated at ${technicals.rsi14} (approaching overbought conditions; potential mean-reversion).`);
    if (technicals.priceVsMA20 === 'below') bearishFactors.push('Price trading below 20-period Moving Average (short-term momentum headwind).');
    if (structure.structure === 'Lower High (LH)' || structure.structure === 'Lower Low (LL)') bearishFactors.push('Bearish structural regime: Lower Highs or Lower Lows.');
    if (derivatives.available && derivatives.fundingRate !== null && derivatives.fundingRate > 0.0002) bearishFactors.push(`Elevated funding rate (${(derivatives.fundingRate * 100).toFixed(4)}%) indicating crowded long positioning.`);
    if (scores.downsideRisk >= 60) bearishFactors.push(`Elevated Downside Risk score (${scores.downsideRisk}/100) warrants conservative stop discipline.`);

    if (bullishFactors.length === 0) bullishFactors.push('Consolidating near baseline moving average levels.');
    if (bearishFactors.length === 0) bearishFactors.push('No acute warning factors; maintain standard trailing risk parameters.');

    // Build structured analysis object
    const structuredAnalysis: StructuredAIAnalysis = {
      symbol: marketData.symbol,
      exchange: marketData.exchange,
      market: marketData.marketType,
      timeframe: '1h',
      marketData: {
        price: marketData.price,
        change24h: marketData.change24h,
        high24h: marketData.high24h,
        low24h: marketData.low24h,
        volume: marketData.volume,
        dataFreshness: marketData.dataFreshness
      },
      technical: {
        rsi6: technicals.rsi6,
        rsi14: technicals.rsi14,
        ma20: technicals.ma20,
        ma50: technicals.ma50,
        ma200: technicals.ma200,
        priceVsMa20: technicals.priceVsMA20,
        priceVsMa50: technicals.priceVsMA50,
        priceVsMa200: technicals.priceVsMA200,
        bollinger: `${technicals.bollingerPosition} (Width: ${technicals.bollingerWidth.toFixed(2)}%)`,
        volumeRatio: technicals.volumeRatio
      },
      derivatives: {
        openInterest: derivatives.available && derivatives.openInterest ? `$${(derivatives.openInterest / 1_000_000).toFixed(2)}M` : 'N/A',
        openInterestChange: derivatives.available && derivatives.openInterestChange !== null ? `${derivatives.openInterestChange > 0 ? '+' : ''}${derivatives.openInterestChange.toFixed(2)}%` : 'N/A',
        fundingRate: derivatives.available && derivatives.fundingRate !== null ? `${(derivatives.fundingRate * 100).toFixed(4)}%` : 'N/A',
        liquidations: derivatives.available && derivatives.totalLiquidations ? `$${(derivatives.totalLiquidations / 1_000_000).toFixed(2)}M` : 'N/A',
        longShortRatio: derivatives.available && derivatives.longShortRatio ? derivatives.longShortRatio.toFixed(2) : 'N/A'
      },
      marketStructure: {
        structure: structure.structure,
        support: structure.support,
        resistance: structure.resistance,
        breakout: structure.breakout ? 'Active Breakout' : 'None',
        breakdown: structure.breakdown ? 'Active Breakdown' : 'None'
      },
      scores: {
        bullScore: scores.bullScore,
        downsideRisk: scores.downsideRisk,
        signal: scores.signal,
        breakdown: scores.componentBreakdown
      },
      why: `The Bull Score of ${scores.bullScore}/100 is predominantly driven by Trend MA component (${scores.componentBreakdown.trend}/100) and Market Structure (${scores.componentBreakdown.structure}/100), with Downside Risk evaluated at ${scores.downsideRisk}/100.`,
      bullishFactors,
      bearishFactors,
      conflictingSignals: conflicts.conflicts,
      scenarios: {
        bullish: `Sustained acceptance above resistance at $${structure.resistance.toLocaleString()} accompanied by volume ratio > 1.5x opens momentum toward continuation targets.`,
        neutral: `Range-bound consolidation between support ($${structure.support.toLocaleString()}) and resistance ($${structure.resistance.toLocaleString()}) while MA20 flattens.`,
        bearish: `Loss of swing support at $${structure.support.toLocaleString()} or sharp rejection triggers downside test toward MA50 ($${technicals.ma50.toLocaleString()}).`
      },
      disclaimer: MANDATORY_DISCLAIMER
    };

    // Synthesize natural terminal commentary
    const rawText = await this.synthesizeWithGeminiOrDeterministic(userPrompt, structuredAnalysis, btcContext, whaleActivity);
    const textContent = exchangeSwitchNote ? `${exchangeSwitchNote}${rawText}` : rawText;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content: textContent,
      toolsInvoked,
      structuredAnalysis,
      queryType: 'analysis',
      disclaimer: MANDATORY_DISCLAIMER,
      timestamp: Date.now()
    };
  }

  /**
   * 2. Side-by-Side Comparison
   */
  private async handleComparison(
    userPrompt: string,
    symbolA: string,
    symbolB: string,
    exchange: ExchangeId,
    toolsInvoked: AIToolInvocation[]
  ): Promise<AIMessage> {
    const comparison = await this.timedCall('compareCoins', { symbolA, symbolB, exchange }, toolsInvoked, () =>
      aiToolLayer.compareCoins({ symbolA, symbolB, exchange, timeframe: '1h' })
    );

    const btcContext = await this.timedCall('getBTCContext', { exchange }, toolsInvoked, () =>
      aiToolLayer.getBTCContext(exchange)
    );

    const cA = comparison.coinA;
    const cB = comparison.coinB;

    const content = `### COMPREHENSIVE PAIR COMPARISON: ${symbolA} vs ${symbolB}
**Exchange:** ${exchange} • **Timeframe:** 1H • **Timestamp:** ${new Date().toISOString().substring(0, 19)} UTC

**1. RELATIVE STRENGTH & SCORES**
- **${symbolA}:** Bull Score: \`${cA.bullScore}/100\` | Downside Risk: \`${cA.downsideRisk}/100\` | Signal: \`${cA.signal}\`
- **${symbolB}:** Bull Score: \`${cB.bullScore}/100\` | Downside Risk: \`${cB.downsideRisk}/100\` | Signal: \`${cB.signal}\`
- **Verdict:** ${comparison.relativeStrength}

**2. TECHNICAL & MOMENTUM PROFILE**
- **Price & 24h Delta:** ${symbolA} ($${cA.price.toLocaleString()}, ${cA.change24h >= 0 ? '+' : ''}${cA.change24h.toFixed(2)}%) vs ${symbolB} ($${cB.price.toLocaleString()}, ${cB.change24h >= 0 ? '+' : ''}${cB.change24h.toFixed(2)}%)
- **RSI14:** ${symbolA} (\`${cA.rsi14}\`) vs ${symbolB} (\`${cB.rsi14}\`)
- **Volume Ratio:** ${symbolA} (\`${cA.volumeRatio}x\`) vs ${symbolB} (\`${cB.volumeRatio}x\`)
- **Structure:** ${symbolA} (\`${cA.structure}\`) vs ${symbolB} (\`${cB.structure}\`)

**3. DERIVATIVES & POSITIONING DIVERGENCE**
- ${comparison.derivativesComparison}

**4. KEY DIVERGENCES**
${comparison.keyDivergences.map((d: string) => `- ${d}`).join('\n') || '- Both assets display aligned momentum profiles.'}

**5. MACRO BITCOIN BENCHMARK**
- BTC Price: \`$${btcContext.price.toLocaleString()}\` (${btcContext.change24h >= 0 ? '+' : ''}${btcContext.change24h.toFixed(2)}%) | Bull Score: \`${btcContext.bullScore}/100\`

${MANDATORY_DISCLAIMER}`;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content,
      toolsInvoked,
      comparisonResult: {
        symbolA,
        symbolB,
        coinA: cA,
        coinB: cB,
        relativeStrength: comparison.relativeStrength,
        keyDivergences: comparison.keyDivergences,
        derivativesComparison: comparison.derivativesComparison,
        summary: comparison.relativeStrength,
        disclaimer: MANDATORY_DISCLAIMER
      },
      queryType: 'comparison',
      disclaimer: MANDATORY_DISCLAIMER,
      timestamp: Date.now()
    };
  }

  /**
   * 3. Natural Language Scanner Query
   */
  private async handleScanQuery(
    userPrompt: string,
    parsed: any,
    exchange: ExchangeId,
    toolsInvoked: AIToolInvocation[]
  ): Promise<AIMessage> {
    const scanResult = await this.timedCall('scanMarket', { query: userPrompt, exchange }, toolsInvoked, () =>
      aiToolLayer.scanMarket({ query: userPrompt, exchange })
    );

    const topCoins = scanResult.coins.slice(0, 8);
    const content = `### NATURAL LANGUAGE SCANNER EXECUTION
**Query:** "${userPrompt}"
**Evaluated Assets:** ${scanResult.totalEvaluated} pairs on ${exchange}
**Matching Setups:** ${scanResult.matchCount} coins found

${topCoins.length > 0 ? topCoins.map((c: any, idx: number) =>
  `**${idx + 1}. ${c.symbol}** — Price: \`$${c.price.toLocaleString()}\` (${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}%)
  - Bull Score: \`${c.bullScore}/100\` | Downside Risk: \`${c.downsideRisk}/100\` | RSI14: \`${c.rsi14}\`
  - Volume Ratio: \`${c.volumeRatio}x\` | Structure: \`${c.structure}\` | OI Change: \`${c.openInterestChange}%\``
).join('\n\n') : 'No coins currently meet all specified quantitative threshold filters on the selected exchange.'}

${MANDATORY_DISCLAIMER}`;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content,
      toolsInvoked,
      queryType: 'scanner',
      disclaimer: MANDATORY_DISCLAIMER,
      timestamp: Date.now()
    };
  }

  /**
   * 4. Indicator Conflicts Audit
   */
  private async handleConflictsQuery(
    userPrompt: string,
    symbol: string,
    exchange: ExchangeId,
    toolsInvoked: AIToolInvocation[]
  ): Promise<AIMessage> {
    const conflicts = await this.timedCall('getIndicatorConflicts', { symbol, exchange }, toolsInvoked, () =>
      aiToolLayer.getIndicatorConflicts({ symbol, exchange, timeframe: '1h' })
    );

    const content = `### QUANTITATIVE INDICATOR CONFLICT AUDIT: ${symbol}
**Exchange:** ${exchange} • **Timeframe:** 1H • **Conflicts Flagged:** ${conflicts.conflictsCount}

**ACTIVE DIVERGENCE & CONFLICT ANALYSIS:**
${conflicts.conflicts.map((c: string, idx: number) => `**[Divergence ${idx + 1}]** ${c}`).join('\n\n')}

**CURRENT METRIC SNAPSHOT:**
- RSI14: \`${conflicts.indicatorsSummary.rsi14}\`
- Trend Alignment: \`${conflicts.indicatorsSummary.trend}\`
- Volume Ratio: \`${conflicts.indicatorsSummary.volumeRatio}x\`
- Market Structure: \`${conflicts.indicatorsSummary.structure}\`
- Funding Rate: \`${typeof conflicts.indicatorsSummary.fundingRate === 'number' ? `${(conflicts.indicatorsSummary.fundingRate * 100).toFixed(4)}%` : conflicts.indicatorsSummary.fundingRate}\`

${MANDATORY_DISCLAIMER}`;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content,
      toolsInvoked,
      queryType: 'conflicts',
      disclaimer: MANDATORY_DISCLAIMER,
      timestamp: Date.now()
    };
  }

  /**
   * 5. Historical Deltas Query
   */
  private async handleHistoryQuery(
    userPrompt: string,
    symbol: string,
    exchange: ExchangeId,
    toolsInvoked: AIToolInvocation[]
  ): Promise<AIMessage> {
    const history = await this.timedCall('getHistoricalChanges', { symbol, exchange, hours: 24 }, toolsInvoked, () =>
      aiToolLayer.getHistoricalChanges({ symbol, exchange, hours: 24 })
    );

    const content = `### HISTORICAL QUANTITATIVE DELTAS: ${symbol} (24H LOOKBACK)
**Exchange:** ${exchange} • **Lookback Window:** 24 Hours

- **Price Evolution:** From \`$${history.historicalPrice.toLocaleString()}\` to \`$${history.currentPrice.toLocaleString()}\` (\`${history.pricePercentChange >= 0 ? '+' : ''}${history.pricePercentChange}%\`)
- **Volume Dynamic:** Volume trend is currently classified as \`${history.volumeTrend}\`.
- **Open Interest Shift:** ${history.openInterestChange !== null ? `\`${history.openInterestChange >= 0 ? '+' : ''}${history.openInterestChange.toFixed(2)}%\` (24h)` : 'N/A'}
- **Current RSI14:** \`${history.currentRsi14}\`
- **Structural Regime:** \`${history.marketStructure}\` ${history.recentBreakout ? '(Breakout Detected)' : ''} ${history.recentBreakdown ? '(Breakdown Detected)' : ''}

${MANDATORY_DISCLAIMER}`;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content,
      toolsInvoked,
      queryType: 'history',
      disclaimer: MANDATORY_DISCLAIMER,
      timestamp: Date.now()
    };
  }

  /**
   * 6. Explain Score Decomposition
   */
  private async handleExplainScoreQuery(
    userPrompt: string,
    symbol: string,
    exchange: ExchangeId,
    toolsInvoked: AIToolInvocation[]
  ): Promise<AIMessage> {
    const scores = await this.timedCall('getScores', { symbol, exchange }, toolsInvoked, () =>
      aiToolLayer.getScores({ symbol, exchange, timeframe: '1h' })
    );

    const b = scores.componentBreakdown;
    const content = `### FACTOR WEIGHT DECOMPOSITION: ${symbol}
**Bull Score:** \`${scores.bullScore}/100\` (${scores.bullClassification})
**Downside Risk:** \`${scores.downsideRisk}/100\` (${scores.downsideRiskClassification})
**Overall Analytical Signal:** \`${scores.signal}\`

**WHY THIS SCORE EXISTS (Component Breakdown 0-100):**
- **Trend Moving Averages:** \`${b.trend}/100\` (Price vs MA20/50/200 & alignment)
- **Market Structure:** \`${b.structure}/100\` (Higher Highs / Breakout confirmation)
- **Volume Profile:** \`${b.volume}/100\` (Ratio vs 20-period average)
- **Momentum:** \`${b.momentum}/100\` (Rate of change)
- **RSI Positioning:** \`${b.rsi}/100\` (Optimal bullish zone vs overbought threshold)
- **Bollinger Band Width & %B:** \`${b.bollinger}/100\` (Expansion vs compression)
- **Open Interest Support:** \`${b.openInterest}/100\` (Capital entry confirmation)
- **Funding Stability:** \`${b.funding}/100\` (Absence of crowded long distortion)

${scores.summaryNotes.length > 0 ? `**Analytical Notes:**\n${scores.summaryNotes.map((n: string) => `- ${n}`).join('\n')}\n\n` : ''}
${MANDATORY_DISCLAIMER}`;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content,
      toolsInvoked,
      queryType: 'general',
      disclaimer: MANDATORY_DISCLAIMER,
      timestamp: Date.now()
    };
  }

  /**
   * 7. Whale Activity Query
   */
  private async handleWhaleQuery(
    userPrompt: string,
    symbol: string | undefined,
    minUsd: number | undefined,
    toolsInvoked: AIToolInvocation[]
  ): Promise<AIMessage> {
    const whaleData = await this.timedCall('getWhaleActivity', { symbol, minUsd }, toolsInvoked, () =>
      aiToolLayer.getWhaleActivity({ symbol, minUsd })
    );

    if (!whaleData.available) {
      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        content: `### ON-CHAIN WHALE INTELLIGENCE: UNAVAILABLE\n\n${whaleData.reason || 'No on-chain data provider configured.'}\n\nPlease connect an on-chain API key (Arkham, Whale Alert) or enable the verified Testnet RPC feed in the Whale Scanner settings.\n\n${MANDATORY_DISCLAIMER}`,
        toolsInvoked,
        queryType: 'whales',
        disclaimer: MANDATORY_DISCLAIMER,
        timestamp: Date.now()
      };
    }

    const txs = whaleData.transactions || [];
    const content = `### ON-CHAIN WHALE SURVEILLANCE REPORT
**Provider:** ${whaleData.provider} • **Scope:** ${symbol || 'ALL PAIRS'} • **Minimum Size:** >= $${((minUsd || 1_000_000) / 1_000_000).toFixed(1)}M USD

**AGGREGATE ON-CHAIN SUMMARY:**
- **Indexed Transactions:** ${whaleData.totalTransactions} blocks
- **Cumulative USD Volume:** $${((whaleData.totalUsdVolume || 0) / 1_000_000).toFixed(2)}M
- **Net Exchange Flow:** ${whaleData.netExchangeFlowUsd && whaleData.netExchangeFlowUsd > 0 ? `+$${(whaleData.netExchangeFlowUsd / 1_000_000).toFixed(2)}M Inflow` : `-$${(Math.abs(whaleData.netExchangeFlowUsd || 0) / 1_000_000).toFixed(2)}M Outflow`}
- **Identified Signals:** \`${whaleData.accumulationSignals || 0}\` Potential Accumulation | \`${whaleData.distributionSignals || 0}\` Potential Distribution

**RECENT LARGE BLOCK TRANSACTIONS:**
${txs.slice(0, 5).map((t, idx) =>
  `**[Block ${idx + 1}]** ${t.symbol} — \`$${(t.usdValue / 1_000_000).toFixed(2)}M\` (${t.amount.toLocaleString()} coins)
  - **Type:** ${t.type} (${t.direction.toUpperCase()}) | **Entities:** ${t.fromEntity || 'Unknown'} ➔ ${t.toEntity || 'Unknown'}
  - **Analytical Note:** ${t.analyticalInterpretation}`
).join('\n\n')}

${MANDATORY_DISCLAIMER}`;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content,
      toolsInvoked,
      queryType: 'whales',
      disclaimer: MANDATORY_DISCLAIMER,
      timestamp: Date.now()
    };
  }

  /**
   * Helper to execute and record tool invocation trace
   */
  private async timedCall<T>(
    name: string,
    input: Record<string, any>,
    traceArr: AIToolInvocation[],
    fn: () => Promise<T>
  ): Promise<T> {
    const t0 = Date.now();
    try {
      const res = await fn();
      const durationMs = Date.now() - t0;
      monitoringService.recordAIRequest(durationMs, true, name);
      traceArr.push({
        name,
        input,
        outputSummary: typeof res === 'object' && res !== null ? Object.keys(res).slice(0, 4).join(', ') : 'OK',
        timestamp: t0,
        durationMs
      });
      return res;
    } catch (err) {
      const durationMs = Date.now() - t0;
      monitoringService.recordAIRequest(durationMs, false, name, 'user', (err as Error).message);
      traceArr.push({
        name,
        input,
        outputSummary: `ERROR: ${(err as Error).message}`,
        timestamp: t0,
        durationMs
      });
      throw err;
    }
  }

  /**
   * Synthesize with Gemini if API key available; otherwise produce deterministic terminal output.
   * Both formats strictly follow the requested structure and append the mandatory disclaimer!
   */
  private async synthesizeWithGeminiOrDeterministic(
    userPrompt: string,
    analysis: StructuredAIAnalysis,
    btcContext: any,
    whaleActivity: any
  ): Promise<string> {
    const ai = getGemini();

    if (ai) {
      try {
        const systemInstruction = `You are Crypto Intelligence AI Trader, an institutional research-terminal crypto analyst.
CRITICAL RULES:
1. You MUST NOT answer from general knowledge alone. You MUST use only the verified tool facts provided in the prompt.
2. Clearly separate:
   - OBSERVED: Live prices, 24h change, trading volume, order-book stats, on-chain flows.
   - CALCULATED: RSI 6/14, Moving Averages, Bollinger Bands, Bull Score, Downside Risk, Market Structure.
   - INTERPRETATION: Analytical synthesis explaining the observed and calculated metrics.
   - SCENARIOS: Explicitly label hypothetical paths: [BULLISH SCENARIO], [NEUTRAL SCENARIO], [BEARISH SCENARIO].
3. If data is unavailable, write "N/A". Never invent missing metrics.
4. Conclude with the mandatory disclaimer verbatim:
DYOR — Do Your Own Research.
Not Financial Advice.`;

        const userContent = `Analyze user request: "${userPrompt}"
Verified Grounded Data:
${JSON.stringify({
  analysis,
  btcContext,
  whaleActivity
}, null, 2)}`;

        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userContent,
            config: {
              systemInstruction
            }
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 6000))
        ]);

        if (response && response.text) {
          let text = response.text.trim();
          if (!text.includes('DYOR — Do Your Own Research')) {
            text += `\n\n${MANDATORY_DISCLAIMER}`;
          }
          return text;
        }
      } catch (err) {
        console.warn('Gemini API call failed, utilizing deterministic research synthesis:', (err as Error).message);
      }
    }

    // Deterministic Research Terminal Output
    return `### CRYPTO INTELLIGENCE AI RESEARCH TERMINAL: ${analysis.symbol}
**Exchange:** ${analysis.exchange} • **Market:** ${analysis.market} • **Timeframe:** 1H • **Status:** ${analysis.marketData.dataFreshness}

**1. OBSERVED MARKET DATA**
- **Price:** \`$${analysis.marketData.price.toLocaleString()}\` (${analysis.marketData.change24h >= 0 ? '+' : ''}${analysis.marketData.change24h.toFixed(2)}%)
- **24H Range:** Low: \`$${analysis.marketData.low24h.toLocaleString()}\` | High: \`$${analysis.marketData.high24h.toLocaleString()}\`
- **Volume:** \`$${analysis.marketData.volume.toLocaleString()}\` (Ratio vs 20-period avg: \`${analysis.technical.volumeRatio}x\`)

**2. CALCULATED TECHNICAL INDICATORS**
- **RSI (Momentum):** RSI 14: \`${analysis.technical.rsi14}\` | RSI 6: \`${analysis.technical.rsi6}\`
- **Moving Averages:** MA20: \`$${analysis.technical.ma20.toLocaleString()}\` (${analysis.technical.priceVsMa20}) | MA50: \`$${analysis.technical.ma50.toLocaleString()}\` (${analysis.technical.priceVsMa50}) | MA200: \`$${analysis.technical.ma200.toLocaleString()}\` (${analysis.technical.priceVsMa200})
- **Bollinger Bands:** ${analysis.technical.bollinger}

**3. DERIVATIVES & POSITIONING**
- **Open Interest:** \`${analysis.derivatives.openInterest}\` (Change 24h: \`${analysis.derivatives.openInterestChange}\`)
- **Funding Rate:** \`${analysis.derivatives.fundingRate}\`
- **Liquidations (24h):** \`${analysis.derivatives.liquidations}\`
- **Long/Short Ratio:** \`${analysis.derivatives.longShortRatio}\`

**4. MARKET STRUCTURE & LEVELS**
- **Structure Regime:** \`${analysis.marketStructure.structure}\`
- **Key Resistance:** \`$${analysis.marketStructure.resistance.toLocaleString()}\`
- **Key Support:** \`$${analysis.marketStructure.support.toLocaleString()}\`
- **Breakout Status:** ${analysis.marketStructure.breakout}

**5. QUANTITATIVE SCORES**
- **Bull Potential Score:** \`${analysis.scores.bullScore}/100\`
- **Downside Risk Score:** \`${analysis.scores.downsideRisk}/100\`
- **Analytical Signal:** \`${analysis.scores.signal}\`
- **Why this score exists:** ${analysis.why}

**6. BULLISH FACTORS**
${analysis.bullishFactors.map(f => `- ${f}`).join('\n')}

**7. BEARISH FACTORS**
${analysis.bearishFactors.map(f => `- ${f}`).join('\n')}

**8. CONFLICTING SIGNALS**
${analysis.conflictingSignals.map(c => `- ${c}`).join('\n')}

**9. SCENARIOS (HYPOTHETICAL)**
- **[BULLISH SCENARIO]:** ${analysis.scenarios.bullish}
- **[NEUTRAL SCENARIO]:** ${analysis.scenarios.neutral}
- **[BEARISH SCENARIO]:** ${analysis.scenarios.bearish}

**10. MACRO BITCOIN CONTEXT**
- BTC Price: \`$${btcContext.price.toLocaleString()}\` (${btcContext.change24h >= 0 ? '+' : ''}${btcContext.change24h.toFixed(2)}%) | Bull Score: \`${btcContext.bullScore}/100\` | Downside Risk: \`${btcContext.downsideRisk}/100\`

${MANDATORY_DISCLAIMER}`;
  }
}

export const aiTraderService = new AiTraderService();
