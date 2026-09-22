import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  HelpCircle,
  Lock,
  MessageSquare,
  Send,
  Sparkles,
  Terminal,
  Wrench
} from 'lucide-react';
import React, { useState } from 'react';

export const AiTraderPlaceholder: React.FC = () => {
  const [sampleQuery, setSampleQuery] = useState(
    'Scan markets for coins with Bull Score >= 75 and Volume Ratio > 2.0x'
  );

  return (
    <div className="space-y-6 font-mono">
      {/* Banner */}
      <div className="bg-[#0c121e] border border-purple-900/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2238] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white">AI TRADER TERMINAL</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
                  COMING IN PHASE 3
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Analytical market intelligence copilot powered strictly by deterministic tool calling. No hallucinated prices.
              </p>
            </div>
          </div>

          <div className="text-[11px] px-3 py-1.5 rounded-xl bg-[#080d16] border border-[#1b253b] text-purple-300">
            Phase 3 Engine Architecture
          </div>
        </div>

        {/* Mandatory Regulatory Disclaimer */}
        <div className="mt-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/30 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300">MANDATORY REGULATORY DISCLAIMER: </strong>
            DYOR — Do Your Own Research. Not Financial Advice. The AI Trader is strictly an analytical query assistant designed to inspect technical indicators and scoring models. It will NEVER execute trades, manage funds, or offer guaranteed predictive returns.
          </div>
        </div>
      </div>

      {/* Tool Calling Architecture Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Strict Tool Calling Spec */}
        <div className="bg-[#0c121e] border border-[#1d2940] rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center space-x-2 border-b border-[#182338] pb-3">
            <Wrench className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-sm text-white">Grounding & Deterministic Tools</span>
          </div>
          <p className="text-xs text-slate-400">
            The Phase 3 AI model will be bounded by function calling, ensuring every assertion links to live Binance market data:
          </p>

          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="p-2 rounded-lg bg-[#080d16] border border-[#141d2e] flex items-center justify-between">
              <span className="text-purple-300 font-semibold">getMarketData(symbol)</span>
              <span className="text-[10px] text-slate-500">Live spot quote, 24h vol</span>
            </div>
            <div className="p-2 rounded-lg bg-[#080d16] border border-[#141d2e] flex items-center justify-between">
              <span className="text-purple-300 font-semibold">getIndicators(symbol, timeframe)</span>
              <span className="text-[10px] text-slate-500">RSI, MA20/50/200, BB</span>
            </div>
            <div className="p-2 rounded-lg bg-[#080d16] border border-[#141d2e] flex items-center justify-between">
              <span className="text-purple-300 font-semibold">getBullScore(symbol, timeframe)</span>
              <span className="text-[10px] text-slate-500">0-100 Bull potential breakdown</span>
            </div>
            <div className="p-2 rounded-lg bg-[#080d16] border border-[#141d2e] flex items-center justify-between">
              <span className="text-purple-300 font-semibold">getDownsideRisk(symbol, timeframe)</span>
              <span className="text-[10px] text-slate-500">0-100 Downside risk breakdown</span>
            </div>
            <div className="p-2 rounded-lg bg-[#080d16] border border-[#141d2e] flex items-center justify-between">
              <span className="text-purple-300 font-semibold">getMarketStructure(symbol, timeframe)</span>
              <span className="text-[10px] text-slate-500">HH/HL/LH/LL & Support levels</span>
            </div>
            <div className="p-2 rounded-lg bg-[#080d16] border border-[#141d2e] flex items-center justify-between">
              <span className="text-purple-300 font-semibold">scanMarket(filters)</span>
              <span className="text-[10px] text-slate-500">Multi-factor market scan</span>
            </div>
          </div>
        </div>

        {/* Interactive Query Sandbox Mockup */}
        <div className="bg-[#0c121e] border border-[#1d2940] rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2 border-b border-[#182338] pb-3">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-sm text-white">Natural Language Scanner Sandbox</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Preview how analysts will query the market scanner using conversational natural language:
            </p>

            <div className="mt-4 p-3 bg-[#080d16] border border-[#182338] rounded-xl space-y-2 text-xs">
              <div className="text-[10px] uppercase text-slate-500">Preset Analyst Prompts:</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSampleQuery('Which coins are above MA20, MA50, and MA200 with RSI < 45?')}
                  className="px-2 py-1 rounded bg-[#111928] hover:bg-[#18243a] text-slate-300 text-[11px] text-left"
                >
                  "Coins above all MAs with RSI &lt; 45"
                </button>
                <button
                  onClick={() => setSampleQuery('Explain why SOL/USDT has an Elevated Downside Risk score')}
                  className="px-2 py-1 rounded bg-[#111928] hover:bg-[#18243a] text-slate-300 text-[11px] text-left"
                >
                  "Explain SOL downside risk factors"
                </button>
                <button
                  onClick={() => setSampleQuery('Show all coins breaking out with volume > 3x average')}
                  className="px-2 py-1 rounded bg-[#111928] hover:bg-[#18243a] text-slate-300 text-[11px] text-left"
                >
                  "Volume breakout &gt; 3x scan"
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={sampleQuery}
                onChange={e => setSampleQuery(e.target.value)}
                placeholder="Ask technical question or scan criteria..."
                className="w-full bg-[#080d16] border border-[#1b253b] rounded-xl pl-3 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                disabled
                className="absolute right-2 top-2 p-1.5 rounded-lg bg-purple-900/60 text-purple-400 cursor-not-allowed"
                title="Enabled in Phase 3"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10px] text-slate-500 text-center">
              Natural Language Tool Calling Engine will activate in Phase 3 deployment.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
