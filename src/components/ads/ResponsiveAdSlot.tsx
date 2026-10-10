import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Sparkles,
  Zap,
  Bell,
  Shield,
  Layers,
  ArrowRight,
  X,
  Megaphone
} from 'lucide-react';
import { HouseAd } from '../../types';

interface ResponsiveAdSlotProps {
  creative: HouseAd | null;
  totalCreatives?: number;
  currentIndex?: number;
  onRecordClick?: (creative: HouseAd) => void;
  onDismiss?: () => void;
  allowDismissal?: boolean;
  providerType?: 'HOUSE' | 'EXTERNAL';
  isCompact?: boolean;
}

export const ResponsiveAdSlot: React.FC<ResponsiveAdSlotProps> = ({
  creative,
  totalCreatives = 1,
  currentIndex = 0,
  onRecordClick,
  onDismiss,
  allowDismissal = true,
  providerType = 'HOUSE',
  isCompact = false
}) => {
  const navigate = useNavigate();

  if (!creative) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRecordClick) {
      onRecordClick(creative);
    }

    if (creative.targetUrl.startsWith('/')) {
      navigate(creative.targetUrl);
    } else {
      window.open(creative.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Color theme mapping for subtle borders, badges and accents
  const getThemeStyles = (theme?: string) => {
    switch (theme) {
      case 'amber':
        return {
          border: 'border-amber-500/40 hover:border-amber-400/60',
          badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-600/50',
          iconBg: 'bg-amber-500/20 text-amber-400',
          ctaBg: 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.12)]'
        };
      case 'emerald':
        return {
          border: 'border-emerald-500/40 hover:border-emerald-400/60',
          badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50',
          iconBg: 'bg-emerald-500/20 text-emerald-400',
          ctaBg: 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black',
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.12)]'
        };
      case 'purple':
        return {
          border: 'border-purple-500/40 hover:border-purple-400/60',
          badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-600/50',
          iconBg: 'bg-purple-500/20 text-purple-400',
          ctaBg: 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white',
          glow: 'shadow-[0_0_20px_rgba(168,85,247,0.12)]'
        };
      case 'blue':
        return {
          border: 'border-blue-500/40 hover:border-blue-400/60',
          badgeBg: 'bg-blue-950/80 text-blue-300 border-blue-600/50',
          iconBg: 'bg-blue-500/20 text-blue-400',
          ctaBg: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white',
          glow: 'shadow-[0_0_20px_rgba(59,130,246,0.12)]'
        };
      case 'cyan':
      default:
        return {
          border: 'border-cyan-500/40 hover:border-cyan-400/60',
          badgeBg: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/50',
          iconBg: 'bg-cyan-500/20 text-cyan-400',
          ctaBg: 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black',
          glow: 'shadow-[0_0_20px_rgba(6,182,212,0.12)]'
        };
    }
  };

  const theme = getThemeStyles(creative.colorTheme);

  // Creative Icon
  const renderIcon = () => {
    switch (creative.colorTheme) {
      case 'amber':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'emerald':
        return <Bell className="w-3.5 h-3.5" />;
      case 'purple':
        return <Shield className="w-3.5 h-3.5" />;
      case 'blue':
        return <Layers className="w-3.5 h-3.5" />;
      case 'cyan':
      default:
        return <Zap className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      role="region"
      aria-label="Promotional Announcement"
      onClick={handleClick}
      className={`relative group cursor-pointer transition-all duration-300 rounded-xl bg-[#090e1a]/95 backdrop-blur-md border ${theme.border} ${theme.glow} text-left select-none overflow-hidden ${
        isCompact ? 'p-2' : 'p-2.5 sm:px-4 sm:py-2.5'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left Section: Icon + Badges + Copy */}
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          {/* Creative Accent Icon */}
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${theme.iconBg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}
          >
            {renderIcon()}
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Top row: Label + Badge + Rotation Indicators */}
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <span className="text-[9px] font-mono tracking-wider font-bold text-slate-400 uppercase">
                {providerType === 'EXTERNAL' ? 'Sponsored' : 'Promotion'}
              </span>

              {creative.badge && (
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${theme.badgeBg}`}
                >
                  {creative.badge}
                </span>
              )}

              {totalCreatives > 1 && (
                <span className="text-[9px] font-mono text-slate-500 hidden sm:inline">
                  • {currentIndex + 1}/{totalCreatives}
                </span>
              )}
            </div>

            {/* Title & Description */}
            <div className="flex items-baseline space-x-2 truncate">
              <h4 className="text-xs sm:text-xs font-mono font-bold text-slate-100 group-hover:text-white transition-colors truncate">
                {creative.title}
              </h4>
              <p className="text-[11px] text-slate-400 font-sans hidden md:inline truncate">
                — {creative.description}
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: CTA Button + Dismiss */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 ${theme.ctaBg}`}
            aria-label={`${creative.ctaText}: ${creative.title}`}
          >
            <span>{creative.ctaText}</span>
            {creative.targetUrl.startsWith('/') ? (
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            ) : (
              <ExternalLink className="w-3 h-3" />
            )}
          </button>

          {allowDismissal && onDismiss && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#141e30] transition-colors"
              title="Snooze promotion"
              aria-label="Dismiss promotion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
