import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingDown,
  TrendingUp,
  User,
  Waves,
  Wrench,
  Zap
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  AIMessage,
  AIToolInvocation,
  ExchangeId,
  StructuredAIAnalysis
} from '../types';

interface AiTraderChatProps {
  activeExchange: ExchangeId;
  onSelectCoin?: (symbol: string) => void;
}

const DEFAULT_PROMPTS = [
  'Analyze BTC/USDT',
  'Analyze SOL/USDT',
  'Compare SOL/USDT vs ETH/USDT',
  'Scan for Bull Score > 75 and Volume > 2x',
  'Detect indicator conflicts on BTC',
  'Explain BTC Bull Score breakdown',
  'Show whale activity'
];

export const AiTraderChat: React.FC<AiTraderChatProps> = ({
  activeExchange,
  onSelectCoin
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content: `### CRYPTO INTELLIGENCE AI RESEARCH TERMINAL READY
**Connected Gateway:** Deterministic Backend Tool Layer • **Target Exchange:** ${activeExchange}

Welcome to the institutional Crypto Intelligence AI research terminal.
All market questions are resolved by **querying backend tools directly** (Spot price feeds, RSI, Bollinger Bands, Moving Averages, Derivatives OI/Funding, Market Structure Breakouts, and On-chain Whale Intelligence). No ungrounded hallucinations.

**Suggested Queries:**
- *"Analyze BTC/USDT"* (Executes 8 backend tools + synthesis)
- *"Compare SOL/USDT vs ETH/USDT"* (Side-by-side technical & derivatives matrix)
- *"Scan for Bull Score > 75 and Volume > 2x"* (Multi-factor filter parser)
- *"Detect indicator conflicts on BTC"* (Divergence and positioning audit)
- *"Explain SOL Bull Score breakdown"* (Deconstructs factor weights)

DYOR — Do Your Own Research. Not Financial Advice.`,
      disclaimer: 'DYOR — Do Your Own Research. Not Financial Advice.',
      timestamp: Date.now()
    }
  ]);

  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || input).trim();
    if (!text || isGenerating) return;

    const userMessage: AIMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!promptToSend) setInput('');
    setIsGenerating(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, exchange: activeExchange })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const aiResponse: AIMessage = await res.json();
      setMessages(prev => [...prev, aiResponse]);
    } catch (err) {
      const errorMessage: AIMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `### Execution Error\nFailed to complete research analysis: ${(err as Error).message}\n\nPlease verify backend connectivity.\n\nDYOR — Do Your Own Research. Not Financial Advice.`,
        disclaimer: 'DYOR — Do Your Own Research. Not Financial Advice.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleTools = (msgId: string) => {
    setExpandedTools(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Terminal Header */}
      <div className="bg-[#0c121e] border border-purple-900/40 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-white">AI TRADER RESEARCH TERMINAL</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
                PHASE 3 LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Grounded Institutional Co-pilot • Strict Server-Side Tool Calling • Zero Hallucination
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-[#080d16] border border-[#1b253b] text-slate-300 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tools: <strong className="text-purple-300">11 Active</strong></span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-[#080d16] border border-[#1b253b] text-slate-300">
            Exchange: <strong className="text-cyan-400">{activeExchange}</strong>
          </div>
          <button
            onClick={() => setMessages([messages[0]])}
            className="px-2.5 py-1 rounded-lg bg-[#080d16] border border-[#1b253b] text-slate-400 hover:text-white transition-colors"
            title="Clear Chat History"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-400 font-semibold mr-1 flex items-center space-x-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Quick Terminal Queries:</span>
        </span>
        {DEFAULT_PROMPTS.map((chip, idx) => (
          <button
            key={idx}
            disabled={isGenerating}
            onClick={() => handleSendMessage(chip)}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0c121e] border border-purple-950 hover:border-purple-600/50 text-purple-300 hover:text-white transition-all disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="bg-[#080d16] border border-[#182338] rounded-2xl p-4 min-h-[520px] max-h-[720px] overflow-y-auto space-y-6">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            } space-y-2`}
          >
            {/* Sender Label */}
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
              {msg.role === 'user' ? (
                <>
                  <span>Analyst</span>
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-bold text-purple-300">Crypto Intelligence AI</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>

            {/* Bubble Content */}
            <div
              className={`max-w-4xl w-full rounded-2xl p-5 text-xs leading-relaxed shadow-lg ${
                msg.role === 'user'
                  ? 'bg-purple-950/40 border border-purple-700/50 text-purple-100'
                  : 'bg-[#0c121e] border border-[#1d2940] text-slate-200'
              }`}
            >
              {/* Tool Invocation Trace Box (if assistant called tools) */}
              {msg.toolsInvoked && msg.toolsInvoked.length > 0 && (
                <div className="mb-4 rounded-xl bg-[#080d16] border border-[#1b253b] overflow-hidden">
                  <button
                    onClick={() => toggleTools(msg.id)}
                    className="w-full p-2.5 flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 bg-[#0a101b] transition-colors"
                  >
                    <div className="flex items-center space-x-2 text-purple-300 font-semibold">
                      <Wrench className="w-3.5 h-3.5 text-purple-400" />
                      <span>Executed {msg.toolsInvoked.length} Verified Backend Tools</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-slate-500">
                        {msg.toolsInvoked.reduce((acc, t) => acc + (t.durationMs || 0), 0)}ms total
                      </span>
                      {expandedTools[msg.id] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>

                  {expandedTools[msg.id] && (
                    <div className="p-3 space-y-1.5 border-t border-[#141d2e] font-mono text-[11px]">
                      {msg.toolsInvoked.map((tool, tIdx) => (
                        <div
                          key={tIdx}
                          className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded bg-[#0c121e] border border-[#172235]"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="font-bold text-slate-200">{tool.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({JSON.stringify(tool.input)})
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[10px]">
                            <span className="text-slate-400">{tool.outputSummary}</span>
                            <span className="text-emerald-400 font-bold">{tool.durationMs}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rich Structured UI Cards if available */}
              {msg.structuredAnalysis && (
                <div className="mb-5 space-y-4">
                  {/* Market Snapshot & Scores */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-[#080d16] border border-[#1b253b]">
                      <div className="text-[10px] text-slate-400 uppercase">Live Spot Price</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        ${msg.structuredAnalysis.marketData.price.toLocaleString()}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          msg.structuredAnalysis.marketData.change24h >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {msg.structuredAnalysis.marketData.change24h >= 0 ? '+' : ''}
                        {msg.structuredAnalysis.marketData.change24h.toFixed(2)}% (24h)
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#080d16] border border-[#1b253b]">
                      <div className="text-[10px] text-slate-400 uppercase">Bull Potential Score</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">
                        {msg.structuredAnalysis.scores.bullScore}/100
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Signal: <strong className="text-white">{msg.structuredAnalysis.scores.signal}</strong>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#080d16] border border-[#1b253b]">
                      <div className="text-[10px] text-slate-400 uppercase">Downside Risk</div>
                      <div className="text-base font-bold text-rose-400 mt-0.5">
                        {msg.structuredAnalysis.scores.downsideRisk}/100
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Volume Ratio: <strong className="text-white">{msg.structuredAnalysis.technical.volumeRatio}x</strong>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#080d16] border border-[#1b253b]">
                      <div className="text-[10px] text-slate-400 uppercase">Market Structure</div>
                      <div className="text-base font-bold text-cyan-400 mt-0.5 truncate">
                        {msg.structuredAnalysis.marketStructure.structure}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Breakout: <strong className="text-white">{msg.structuredAnalysis.marketStructure.breakout}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Bullish vs Bearish Factors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 space-y-2">
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs">
                        <TrendingUp className="w-4 h-4" />
                        <span>BULLISH MOMENTUM FACTORS</span>
                      </div>
                      <ul className="space-y-1 text-[11px] text-slate-300">
                        {msg.structuredAnalysis.bullishFactors.map((f, fIdx) => (
                          <li key={fIdx} className="flex items-start space-x-1.5">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/30 space-y-2">
                      <div className="flex items-center space-x-1.5 text-rose-400 font-bold text-xs">
                        <TrendingDown className="w-4 h-4" />
                        <span>BEARISH / RISK WARNING FACTORS</span>
                      </div>
                      <ul className="space-y-1 text-[11px] text-slate-300">
                        {msg.structuredAnalysis.bearishFactors.map((f, fIdx) => (
                          <li key={fIdx} className="flex items-start space-x-1.5">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Scenarios (Hypothetical) */}
                  <div className="p-3.5 rounded-xl bg-[#080d16] border border-[#1b253b] space-y-2">
                    <div className="flex items-center space-x-1.5 text-indigo-400 font-bold text-xs">
                      <Activity className="w-4 h-4" />
                      <span>SCENARIO PLANNING (HYPOTHETICAL CONDITIONAL PATHS)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
                        <span className="font-bold text-emerald-300 block mb-1">BULLISH SCENARIO:</span>
                        <p className="text-slate-300 leading-relaxed">{msg.structuredAnalysis.scenarios.bullish}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-800/30">
                        <span className="font-bold text-blue-300 block mb-1">NEUTRAL SCENARIO:</span>
                        <p className="text-slate-300 leading-relaxed">{msg.structuredAnalysis.scenarios.neutral}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-800/30">
                        <span className="font-bold text-rose-300 block mb-1">BEARISH SCENARIO:</span>
                        <p className="text-slate-300 leading-relaxed">{msg.structuredAnalysis.scenarios.bearish}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Side-by-Side Comparison UI Card if available */}
              {msg.comparisonResult && (
                <div className="mb-5 p-4 rounded-xl bg-[#080d16] border border-[#1b253b] space-y-3">
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs">
                    <Layers className="w-4 h-4" />
                    <span>COMPARATIVE MATRIX: {msg.comparisonResult.symbolA} vs {msg.comparisonResult.symbolB}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-[#0c121e] border border-[#1a2438] space-y-1">
                      <div className="font-bold text-sm text-white">{msg.comparisonResult.symbolA}</div>
                      <div className="text-xs text-emerald-400">
                        Bull Score: {msg.comparisonResult.coinA.bullScore}/100
                      </div>
                      <div className="text-xs text-rose-400">
                        Downside Risk: {msg.comparisonResult.coinA.downsideRisk}/100
                      </div>
                      <div className="text-[11px] text-slate-400">
                        RSI14: {msg.comparisonResult.coinA.rsi14} • Vol: {msg.comparisonResult.coinA.volumeRatio}x
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0c121e] border border-[#1a2438] space-y-1">
                      <div className="font-bold text-sm text-white">{msg.comparisonResult.symbolB}</div>
                      <div className="text-xs text-emerald-400">
                        Bull Score: {msg.comparisonResult.coinB.bullScore}/100
                      </div>
                      <div className="text-xs text-rose-400">
                        Downside Risk: {msg.comparisonResult.coinB.downsideRisk}/100
                      </div>
                      <div className="text-[11px] text-slate-400">
                        RSI14: {msg.comparisonResult.coinB.rsi14} • Vol: {msg.comparisonResult.coinB.volumeRatio}x
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-[11px] text-indigo-200">
                    <strong>Relative Strength Verdict: </strong> {msg.comparisonResult.relativeStrength}
                  </div>
                </div>
              )}

              {/* Text / Markdown Content */}
              <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-2 whitespace-pre-line">
                {msg.content}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-[#182338] flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyMessage(msg.content, msg.id)}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Research Notes</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[10px] text-amber-400/80 font-semibold">
                  MANDATORY DISCLAIMER: DYOR • NOT FINANCIAL ADVICE
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isGenerating && (
          <div className="flex items-center space-x-3 p-4 rounded-2xl bg-[#0c121e] border border-purple-900/30 max-w-md animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-purple-950 flex items-center justify-center text-purple-400">
              <Cpu className="w-4 h-4 animate-spin" />
            </div>
            <div className="text-xs text-purple-200 space-y-0.5">
              <div className="font-bold">Executing Backend AI Tool Layer...</div>
              <div className="text-[10px] text-slate-400">
                Querying Spot feeds, Derivatives OI/Funding, and Market Structure
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="bg-[#0c121e] border border-[#1b253b] rounded-2xl p-2.5 shadow-xl flex items-center space-x-2"
      >
        <div className="pl-2 text-purple-400">
          <Terminal className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask AI Trader: 'Analyze SOL', 'Compare BTC vs ETH', 'Scan Bull Score > 80', 'Whale transfers'..."
          disabled={isGenerating}
          className="flex-1 bg-transparent text-slate-100 text-xs placeholder-slate-500 focus:outline-none px-2 py-1 font-mono"
        />

        <button
          type="submit"
          disabled={!input.trim() || isGenerating}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all disabled:opacity-40 flex items-center space-x-1.5 shadow-md shadow-purple-600/20"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
