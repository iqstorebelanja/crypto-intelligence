import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  variant?: 'banner' | 'button' | 'drawer-item';
  onDismissCallback?: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  variant = 'banner',
  onDismissCallback
}) => {
  const { isInstallable, isInstalled, isIOS, install, dismiss } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (isInstalled) return null;
  if (!isInstallable && !isIOS) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      await install();
      setInstalling(false);
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    dismiss(7); // Dismiss for 7 days
    if (onDismissCallback) onDismissCallback();
  };

  if (variant === 'button') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
          title="Install Crypto Intelligence AI on your device"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isIOS ? 'Add to Home' : 'Install App'}</span>
        </button>

        {showIOSModal && (
          <IOSInstallModal onClose={() => setShowIOSModal(false)} />
        )}
      </>
    );
  }

  if (variant === 'drawer-item') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="w-full p-3.5 rounded-2xl flex items-center justify-between transition-all border bg-gradient-to-r from-cyan-950/40 to-[#0d1424] border-cyan-800/40 hover:border-cyan-500/60 text-slate-200 font-mono"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-white">INSTALL APP (PWA)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/60">
                  MOBILE / DESKTOP
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-sans">
                Install standalone app on home screen with offline resilience.
              </span>
            </div>
          </div>
        </button>

        {showIOSModal && (
          <IOSInstallModal onClose={() => setShowIOSModal(false)} />
        )}
      </>
    );
  }

  // Default 'banner' variant (subtle, non-intrusive banner on top/bottom)
  return (
    <>
      <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-3 shadow-xl backdrop-blur-md font-mono text-xs text-slate-300 flex items-center justify-between gap-3 animate-in fade-in duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="font-bold text-white text-xs">Install Crypto AI</div>
            <div className="text-[11px] text-slate-400 truncate hidden sm:block">
              Add to Home Screen for fast standalone launch and offline alerts.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isIOS ? 'Add to Home' : 'Install'}</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Dismiss install banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showIOSModal && (
        <IOSInstallModal onClose={() => setShowIOSModal(false)} />
      )}
    </>
  );
};

const IOSInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#0c121e] border border-cyan-500/40 rounded-2xl p-5 shadow-2xl font-mono text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <h3 className="font-bold text-white text-sm">Install on iOS Safari</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-slate-300 text-[11px] leading-relaxed">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded bg-slate-800 text-cyan-400 font-bold shrink-0 mt-0.5">
              1
            </div>
            <div>
              Tap the <strong className="text-white">Share</strong> button in Safari's bottom toolbar:
              <div className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded bg-slate-800 text-cyan-400 font-bold shrink-0 mt-0.5">
              2
            </div>
            <div>
              Scroll down and tap <strong className="text-white">Add to Home Screen</strong>:
              <div className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                <PlusSquare className="w-3 h-3" />
                <span>Add to Home Screen</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded bg-slate-800 text-cyan-400 font-bold shrink-0 mt-0.5">
              3
            </div>
            <div>
              Tap <strong className="text-white">Add</strong> in the top right corner. The app icon will appear on your home screen.
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
