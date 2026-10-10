import React from 'react';
import { WifiOff, Wifi, RefreshCw, X, ArrowUpRight } from 'lucide-react';

interface NetworkOfflineBannerProps {
  isOnline: boolean;
  showBackOnlineBanner: boolean;
  needRefresh?: boolean;
  onUpdateApp?: () => void;
  onDismissUpdate?: () => void;
}

export const NetworkOfflineBanner: React.FC<NetworkOfflineBannerProps> = ({
  isOnline,
  showBackOnlineBanner,
  needRefresh,
  onUpdateApp,
  onDismissUpdate
}) => {
  return (
    <>
      {/* 1. Offline Mode Banner */}
      {!isOnline && (
        <aside
          role="status"
          aria-live="assertive"
          className="sticky top-0 z-50 w-full bg-rose-950/95 border-b border-rose-800/80 text-rose-200 px-4 py-2 text-xs font-mono backdrop-blur-md shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1 rounded bg-rose-900 text-rose-300">
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            </span>
            <div className="truncate">
              <span className="font-bold tracking-wider text-white">OFFLINE</span>
              <span className="text-rose-300 ml-1.5 hidden sm:inline">
                — reconnecting... Viewing cached public data. Real-time actions paused.
              </span>
              <span className="text-rose-300 ml-1.5 sm:hidden">
                — reconnecting... Cached view.
              </span>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-900/60 border border-rose-700/60 text-rose-300 shrink-0">
            NO CONNECTION
          </span>
        </aside>
      )}

      {/* 2. Back Online Toast Banner */}
      {isOnline && showBackOnlineBanner && (
        <aside
          role="status"
          aria-live="polite"
          className="sticky top-0 z-50 w-full bg-emerald-950/95 border-b border-emerald-800/80 text-emerald-200 px-4 py-2 text-xs font-mono backdrop-blur-md shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1 rounded bg-emerald-900 text-emerald-300">
              <Wifi className="w-3.5 h-3.5" />
            </span>
            <div className="truncate">
              <span className="font-bold tracking-wider text-white">BACK ONLINE</span>
              <span className="text-emerald-300 ml-1.5">
                — restored live market feeds and WebSocket streaming.
              </span>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 shrink-0">
            SYNCHRONIZED
          </span>
        </aside>
      )}

      {/* 3. New PWA Version Available Banner (Phase 23 Section V) */}
      {needRefresh && (
        <aside
          role="region"
          aria-label="Application Update Notice"
          className="sticky top-0 z-50 w-full bg-cyan-950/95 border-b border-cyan-800/80 text-cyan-200 px-4 py-2.5 text-xs font-mono backdrop-blur-md shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1 rounded bg-cyan-900 text-cyan-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            </span>
            <div className="truncate">
              <span className="font-bold text-white">New version available</span>
              <span className="text-cyan-300 ml-1.5 hidden sm:inline">
                — Updated intelligence features are ready to activate.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onUpdateApp}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
            >
              Update Now
              <ArrowUpRight className="w-3 h-3" />
            </button>
            {onDismissUpdate && (
              <button
                onClick={onDismissUpdate}
                className="p-1 rounded text-slate-400 hover:text-white"
                aria-label="Dismiss update"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </aside>
      )}
    </>
  );
};
