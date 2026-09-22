import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Info,
  Percent,
  Plus,
  Radio,
  Sliders,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Volume2,
  X
} from 'lucide-react';
import { Alert, AlertConditionType, ExchangeId, NormalizedCoinData } from '../types';
import { soundAlert } from '../utils/audioAlert';

export interface PercentageAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  coin: NormalizedCoinData;
  activeAlerts?: Alert[];
  onAlertCreated?: (alert: Alert) => void;
  onAlertDeleted?: (alertId: string) => void;
  onAlertToggled?: (alertId: string, active: boolean) => void;
}

export const PercentageAlertModal: React.FC<PercentageAlertModalProps> = ({
  isOpen,
  onClose,
  coin,
  activeAlerts = [],
  onAlertCreated,
  onAlertDeleted,
  onAlertToggled
}) => {
  const [direction, setDirection] = useState<'UP' | 'DOWN' | 'ANY'>('UP');
  const [percent, setPercent] = useState<number>(5.0);
  const [isRecurring, setIsRecurring] = useState<boolean>(true);
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(15);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [browserNotificationStatus, setBrowserNotificationStatus] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const currentPrice = coin.price;

  // Sync default preset when direction changes
  useEffect(() => {
    if (direction === 'ANY' && percent < 2) {
      setPercent(5.0);
    }
  }, [direction]);

  if (!isOpen) return null;

  // Calculate target price and delta
  const calculateTarget = () => {
    const factor = percent / 100;
    if (direction === 'UP') {
      const target = currentPrice * (1 + factor);
      const delta = target - currentPrice;
      return { target, delta, sign: '+' };
    } else if (direction === 'DOWN') {
      const target = currentPrice * (1 - factor);
      const delta = currentPrice - target;
      return { target, delta: -delta, sign: '-' };
    } else {
      const upperTarget = currentPrice * (1 + factor);
      const lowerTarget = currentPrice * (1 - factor);
      return { target: upperTarget, lowerTarget, delta: currentPrice * factor, sign: '±' };
    }
  };

  const { target, lowerTarget, delta, sign } = calculateTarget();

  const formatPrice = (val: number) => {
    if (val < 0.0001) return `$${val.toFixed(6)}`;
    if (val < 1) return `$${val.toFixed(4)}`;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const presets = {
    UP: [1, 2, 3, 5, 8, 10, 15, 20],
    DOWN: [1, 2, 3, 5, 8, 10, 15, 20],
    ANY: [1.5, 3, 5, 8, 10, 15]
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserNotificationStatus(perm);
        if (perm === 'granted') {
          new Notification('Crypto Intelligence Terminal', {
            body: `Push notifications enabled for ${coin.symbol} percentage alerts!`,
            icon: '/favicon.ico'
          });
        }
      } catch (err) {
        console.warn('Notification permission error:', err);
      }
    }
  };

  const handleTestChime = () => {
    soundAlert.playAlertChime();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (percent <= 0) {
      setErrorMessage('Percentage move must be greater than 0%');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let conditionType: AlertConditionType = 'PRICE_PCT_UP';
      if (direction === 'DOWN') conditionType = 'PRICE_PCT_DOWN';
      if (direction === 'ANY') conditionType = 'PRICE_PCT_ANY';

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        symbol: coin.symbol,
        exchange: coin.exchange || 'BINANCE',
        timeframe: '1h',
        conditionType,
        basePrice: currentPrice,
        percentThreshold: percent,
        direction,
        targetValue: target,
        isRecurring,
        cooldownMinutes,
        notes: note || `${coin.symbol} moves by ${sign}${percent}% from $${currentPrice.toLocaleString()}`
      };

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdAlert = await res.json();
        soundAlert.playAlertChime();
        setSuccessMessage(`Alert activated! We will notify you when ${coin.symbol} moves by ${sign}${percent}%.`);
        if (onAlertCreated) {
          onAlertCreated(createdAlert);
        }
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 1800);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to create alert threshold');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error creating alert threshold');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter existing active alerts for this coin
  const coinAlerts = activeAlerts.filter(
    a => a.symbol === coin.symbol || a.symbol.replace('/', '') === coin.symbol.replace('/', '')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div
        className="bg-[#080d1a] border border-[#1e2e48] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#141e30] flex items-center justify-between bg-[#0b1222]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-inner">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Percentage Price Alert
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                  {coin.symbol}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Receive instant notifications when price moves by a specific threshold
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Baseline Reference Header */}
          <div className="p-3.5 bg-[#0b111e] border border-[#172236] rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Current Reference Price</span>
              <div className="text-lg font-bold text-white font-mono">{formatPrice(currentPrice)}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Exchange</span>
              <span className="text-xs font-semibold text-cyan-300">{coin.exchange || 'BINANCE'}</span>
            </div>
          </div>

          {/* Direction Tabs */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 mb-1.5 block">
              1. Movement Direction
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDirection('UP')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all ${
                  direction === 'UP'
                    ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/40'
                    : 'bg-[#0b111e] border-[#182338] text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1 font-bold text-xs">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Surges Up (+X%)</span>
                </div>
                <span className="text-[9.5px] opacity-80">Bullish breakout / target</span>
              </button>

              <button
                type="button"
                onClick={() => setDirection('DOWN')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all ${
                  direction === 'DOWN'
                    ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-md ring-1 ring-rose-500/40'
                    : 'bg-[#0b111e] border-[#182338] text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1 font-bold text-xs">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Drops Down (-X%)</span>
                </div>
                <span className="text-[9.5px] opacity-80">Stop-loss / pullback</span>
              </button>

              <button
                type="button"
                onClick={() => setDirection('ANY')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all ${
                  direction === 'ANY'
                    ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300 shadow-md ring-1 ring-cyan-500/40'
                    : 'bg-[#0b111e] border-[#182338] text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1 font-bold text-xs">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Volatility (±X%)</span>
                </div>
                <span className="text-[9.5px] opacity-80">Either direction</span>
              </button>
            </div>
          </div>

          {/* Percentage Presets & Custom Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                2. Percentage Threshold (X%)
              </label>
              <span className="text-[11px] font-bold text-cyan-400">
                {sign}{percent}%
              </span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {presets[direction].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPercent(preset)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                    percent === preset
                      ? direction === 'UP'
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : direction === 'DOWN'
                        ? 'bg-rose-600 border-rose-400 text-white'
                        : 'bg-cyan-600 border-cyan-400 text-white'
                      : 'bg-[#0b1220] border-[#1a2942] text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  {sign}{preset}%
                </button>
              ))}
            </div>

            {/* Custom Input & Range Slider */}
            <div className="p-3 bg-[#0b111e] border border-[#172236] rounded-xl space-y-2.5">
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={percent}
                  onChange={(e) => setPercent(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="relative w-28">
                  <input
                    type="number"
                    min="0.1"
                    max="500"
                    step="0.1"
                    value={percent}
                    onChange={(e) => setPercent(Math.max(0.1, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[#070b14] border border-[#233550] rounded-lg px-2.5 py-1.5 text-right font-bold text-white pr-7 text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Target Calculation Preview */}
          <div
            className={`p-3.5 rounded-xl border ${
              direction === 'UP'
                ? 'bg-emerald-950/30 border-emerald-600/40'
                : direction === 'DOWN'
                ? 'bg-rose-950/30 border-rose-600/40'
                : 'bg-cyan-950/30 border-cyan-600/40'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Calculated Trigger Condition:</span>
              <span className="font-semibold text-white">
                {direction === 'ANY' ? `±${percent}% Move` : `${sign}${percent}% Threshold`}
              </span>
            </div>

            {direction === 'ANY' ? (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 mt-1">
                <div>
                  <span className="text-[10px] text-emerald-400 block font-semibold">Upper Trigger (+{percent}%):</span>
                  <div className="text-sm font-bold text-white font-mono">{formatPrice(target)}</div>
                  <span className="text-[9.5px] text-slate-500 block">+{formatPrice(delta)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-rose-400 block font-semibold">Lower Trigger (-{percent}%):</span>
                  <div className="text-sm font-bold text-white font-mono">{formatPrice(lowerTarget || target)}</div>
                  <span className="text-[9.5px] text-slate-500 block">-{formatPrice(delta)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 mt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Target Execution Price</span>
                  <div
                    className={`text-base font-extrabold font-mono ${
                      direction === 'UP' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatPrice(target)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Net Price Delta</span>
                  <div className="text-xs font-bold text-white font-mono">
                    {direction === 'UP' ? `+${formatPrice(delta)}` : `-${formatPrice(Math.abs(delta))}`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Delivery & Cooldown Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Notification Channels */}
            <div className="p-3 bg-[#0b111e] border border-[#172236] rounded-xl space-y-2">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Delivery Channels</span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center space-x-1.5 text-slate-300">
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>In-App Audio Chime</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTestChime}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900"
                  >
                    Test
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                  <span className="flex items-center space-x-1.5 text-slate-300">
                    <Bell className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Desktop Push</span>
                  </span>
                  {browserNotificationStatus === 'granted' ? (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-0.5">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestNotificationPermission}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Recurrence & Cooldown */}
            <div className="p-3 bg-[#0b111e] border border-[#172236] rounded-xl space-y-2">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Trigger Behavior</span>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">Keep Recurring</span>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="accent-cyan-500 rounded cursor-pointer w-4 h-4"
                />
              </div>
              {isRecurring && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Cooldown</span>
                  </span>
                  <select
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(parseInt(e.target.value))}
                    className="bg-[#070b14] border border-[#233550] rounded px-2 py-0.5 text-white text-[10px] focus:outline-none focus:border-cyan-500"
                  >
                    <option value={5}>5 min</option>
                    <option value={15}>15 min</option>
                    <option value={60}>1 hour</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-semibold mb-1 block">
              Optional Note / Label
            </label>
            <input
              type="text"
              placeholder={`e.g., Take profit on ${coin.symbol} +${percent}%, retest breakout`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#0b111e] border border-[#1d2d46] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-600/50 text-rose-300 text-xs flex items-center space-x-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs flex items-center space-x-2 animate-pulse">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-lg shadow-cyan-900/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span>Activating Alert...</span>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                <span>ACTIVATE {sign}{percent}% ALERT ({formatPrice(target)})</span>
              </>
            )}
          </button>

          {/* Existing Active Alerts for this Asset */}
          {coinAlerts.length > 0 && (
            <div className="pt-3 border-t border-[#141f33] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">
                  Active Alerts for {coin.symbol} ({coinAlerts.length})
                </span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {coinAlerts.map((a) => {
                  const targetVal = typeof a.threshold === 'number' ? a.threshold : a.targetValue;
                  const distancePct = targetVal && currentPrice > 0
                    ? (((targetVal - currentPrice) / currentPrice) * 100).toFixed(2)
                    : null;

                  return (
                    <div
                      key={a.id}
                      className="p-2.5 rounded-xl bg-[#090e1a] border border-[#162238] flex items-center justify-between text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-white">
                            {a.conditionType.replace(/_/g, ' ')}
                          </span>
                          {a.percentThreshold && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px]">
                              {a.percentThreshold}%
                            </span>
                          )}
                          <span className={`w-2 h-2 rounded-full ${a.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Target: <strong className="text-slate-200">{targetVal ? formatPrice(Number(targetVal)) : '—'}</strong>
                          {distancePct && (
                            <span className="ml-1.5 text-cyan-400">({Number(distancePct) >= 0 ? '+' : ''}{distancePct}% away)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {onAlertToggled && (
                          <button
                            type="button"
                            onClick={() => onAlertToggled(a.id, Boolean(a.isActive))}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              a.isActive
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {a.isActive ? 'ON' : 'OFF'}
                          </button>
                        )}
                        {onAlertDeleted && (
                          <button
                            type="button"
                            onClick={() => onAlertDeleted(a.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40"
                            title="Remove alert"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
