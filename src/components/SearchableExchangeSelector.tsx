import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe,
  Star,
  Search,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { ExchangeId } from '../types';
import { useExchangeRegistry, ALL_EXCHANGES_OPTION } from '../services/exchangeService';

export interface SearchableExchangeSelectorProps {
  activeExchange: ExchangeId;
  onSelectExchange: (exchangeId: ExchangeId) => void;
  variant?: 'desktop' | 'mobile';
  className?: string;
}

export const SearchableExchangeSelector: React.FC<SearchableExchangeSelectorProps> = ({
  activeExchange,
  onSelectExchange,
  variant = 'desktop',
  className = ''
}) => {
  const { exchanges, getExchangeById } = useExchangeRegistry();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Monitor viewport width for seamless adaptive rendering
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeOption = useMemo(() => {
    return getExchangeById(activeExchange) || ALL_EXCHANGES_OPTION;
  }, [activeExchange, getExchangeById]);

  // Total active exchanges count from authoritative registry (never hard-coded)
  const activeExchangeCount = exchanges.length;

  // Instant local filtering across authoritative exchange metadata
  const filteredExchanges = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return exchanges;

    return exchanges.filter(ex => {
      const matchName = ex.name.toLowerCase().includes(q);
      const matchId = ex.id.toLowerCase().includes(q);
      const matchTag = ex.tag.toLowerCase().includes(q);
      const matchMarketType = ex.marketType?.toLowerCase().includes(q);
      const matchDesc = ex.description?.toLowerCase().includes(q);
      const matchFeatures = ex.features?.some(f => f.toLowerCase().includes(q));
      const matchProvider = ex.providerType?.toLowerCase().includes(q);
      return (
        matchName ||
        matchId ||
        matchTag ||
        matchMarketType ||
        matchDesc ||
        matchFeatures ||
        matchProvider
      );
    });
  }, [exchanges, searchQuery]);

  // Reset highlight index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredExchanges.length, searchQuery]);

  const shouldUseMobileSheet = variant === 'mobile' || isMobileScreen;

  // Focus search input when desktop dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      if (!shouldUseMobileSheet) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, shouldUseMobileSheet]);

  // Lock body scroll while mobile bottom sheet is active
  useEffect(() => {
    if (isOpen && shouldUseMobileSheet) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, shouldUseMobileSheet]);

  // Global Escape key dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Desktop outside-click listener
  useEffect(() => {
    if (!isOpen || shouldUseMobileSheet) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, shouldUseMobileSheet]);

  const scrollHighlightedIntoView = (index: number) => {
    if (!listContainerRef.current) return;
    const items = listContainerRef.current.querySelectorAll('[data-exchange-item]');
    const target = items[index] as HTMLElement;
    if (target) {
      target.scrollIntoView({ block: 'nearest' });
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredExchanges.length === 0) return;
        setHighlightedIndex(prev => {
          const next = (prev + 1) % filteredExchanges.length;
          scrollHighlightedIntoView(next);
          return next;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredExchanges.length === 0) return;
        setHighlightedIndex(prev => {
          const next = (prev - 1 + filteredExchanges.length) % filteredExchanges.length;
          scrollHighlightedIntoView(next);
          return next;
        });
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredExchanges.length > 0 && filteredExchanges[highlightedIndex]) {
          const chosen = filteredExchanges[highlightedIndex];
          onSelectExchange(chosen.id);
          setIsOpen(false);
        }
      }
    },
    [isOpen, filteredExchanges, highlightedIndex, onSelectExchange]
  );

  const handleSelect = (id: ExchangeId) => {
    onSelectExchange(id);
    setIsOpen(false);
  };

  // Helper to render live health status indicator
  const renderStatusDot = (status: 'Operational' | 'Degraded' | 'Offline', isHealthy: boolean) => {
    if (status === 'Operational' || isHealthy) {
      return (
        <span
          className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 flex-shrink-0"
          title="Operational Feed"
        />
      );
    }
    if (status === 'Degraded') {
      return (
        <span
          className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 flex-shrink-0"
          title="Degraded Performance"
        />
      );
    }
    return (
      <span
        className="w-2.5 h-2.5 rounded-full bg-slate-500 flex-shrink-0"
        title="Offline / Maintenance"
      />
    );
  };

  // ==========================================
  // MOBILE BOTTOM SHEET PORTAL
  // Rendered directly into document.body to bypass all parent stacking contexts
  // (backdrop-filter, sticky headers, overflow:hidden, transform, etc.)
  // ==========================================
  const renderMobilePortal = () => {
    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
      <div className="fixed inset-0 z-[99999] flex flex-col justify-end isolate">
        {/* Full-screen Backdrop */}
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
          }}
          aria-hidden="true"
        />

        {/* Bottom Sheet Card Container */}
        <div
          className="relative w-full max-w-lg mx-auto bg-[#0c121e] border-t border-x border-[#1e2c45] rounded-t-3xl shadow-2xl font-mono pb-safe z-10 flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-250"
          role="dialog"
          aria-modal="true"
          aria-label="Select Exchange"
          onClick={e => e.stopPropagation()}
        >
          {/* Top Handle */}
          <div className="pt-3 pb-1 flex justify-center">
            <div className="w-12 h-1.5 bg-slate-700/80 rounded-full" />
          </div>

          {/* Sheet Header */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-[#182338]">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white font-mono tracking-wide">
                  Select Exchange
                </h3>
                <p className="text-[10px] text-slate-400 font-sans">
                  Authoritative Market Provider Registry
                </p>
              </div>
            </div>

            {/* Accessible 44px touch target Close button */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-[#152033] active:bg-[#1b2940] transition-colors"
              aria-label="Close exchange selector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search exchange name, type, or tag..."
                className="w-full pl-9 pr-9 py-2.5 bg-[#070b12] border border-[#1b253b] focus:border-cyan-500/70 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="w-9 h-9 absolute inset-y-0 right-0 flex items-center justify-center text-slate-400 hover:text-white"
                  aria-label="Clear search filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Exchanges List with flex-1 and min-h-0 so it expands and scrolls properly */}
          <div
            ref={listContainerRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2 overscroll-contain"
          >
            {filteredExchanges.length === 0 ? (
              <div className="py-10 text-center text-slate-400 font-sans text-xs">
                <p>No exchanges found matching &ldquo;{searchQuery}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-[#111a2c] text-cyan-400 text-xs font-mono border border-cyan-800/40"
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              filteredExchanges.map((ex, idx) => {
                const isSelected = ex.id === activeExchange;
                const isAll = ex.id === 'ALL';

                return (
                  <button
                    key={ex.id}
                    type="button"
                    data-exchange-item
                    onClick={e => {
                      e.stopPropagation();
                      handleSelect(ex.id);
                    }}
                    className={`w-full min-h-[48px] px-3.5 py-3 rounded-xl flex items-center justify-between text-left transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-cyan-500/20 border border-cyan-500/60 text-white font-bold shadow-md shadow-cyan-950/50'
                        : 'bg-[#080d16] hover:bg-[#101827] active:bg-[#141f33] border border-[#182338] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {isAll ? (
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center flex-shrink-0 text-amber-400">
                          <Star className="w-4 h-4 fill-amber-400/40" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#0e1626] border border-[#1d2a42] flex-shrink-0">
                          {renderStatusDot(ex.status, ex.isHealthy)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white truncate font-mono">
                            {ex.name}
                          </span>
                          {ex.isPopular && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/40 uppercase">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-sans truncate mt-0.5">
                          {ex.marketType || ex.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded-md bg-[#101827] border border-[#18243b] font-mono">
                        {ex.tag}
                      </span>
                      {isSelected ? (
                        <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      ) : (
                        <span className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Summary Strip with dynamic count */}
          <div className="px-4 py-3 border-t border-[#182338] bg-[#0a0f19] flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {searchQuery
                ? `${filteredExchanges.length} of ${activeExchangeCount} exchanges available`
                : `${activeExchangeCount} exchanges available`}
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Real-Time Registry</span>
            </span>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // ==========================================
  // MOBILE EXPERIENCE TRIGGER
  // Touch-optimized trigger with minimum 40px height
  // ==========================================
  if (shouldUseMobileSheet) {
    return (
      <div className={`relative ${className}`}>
        {/* Mobile Trigger Button */}
        <button
          type="button"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          className="flex items-center space-x-1.5 bg-[#0d1424] active:bg-[#131d33] border border-[#1d2b42] active:border-cyan-500/60 rounded-lg px-2.5 py-1.5 min-h-[38px] text-[11px] font-mono font-bold text-slate-200 transition-all truncate shadow-sm touch-manipulation"
          title="Select Global Exchange / Provider"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          {activeOption.id === 'ALL' ? (
            <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-sm shadow-emerald-400/40" />
          )}
          <span className="truncate max-w-[85px] sm:max-w-[120px]">
            {activeOption.name.replace(' Exchanges', '')}
          </span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 hidden sm:inline-block">
            {activeOption.tag}
          </span>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-cyan-400' : ''
            }`}
          />
        </button>

        {/* Portal-rendered Mobile Bottom Sheet */}
        {renderMobilePortal()}
      </div>
    );
  }

  // ==========================================
  // DESKTOP EXPERIENCE
  // High-Density Financial Dropdown with Search & Keyboard Nav
  // ==========================================
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={handleKeyDown}
        className={`flex items-center space-x-2 bg-[#0d1424] hover:bg-[#131d33] border rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold transition-all shadow-sm ${
          isOpen
            ? 'border-cyan-500/70 text-cyan-300 ring-1 ring-cyan-500/30'
            : 'border-[#1d2b42] hover:border-cyan-500/40 text-slate-200'
        }`}
        title="Select Global Exchange or Multi-Exchange Aggregator"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {activeOption.id === 'ALL' ? (
          <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-sm shadow-emerald-400/50" />
        )}
        <span className="text-white tracking-wide">{activeOption.name}</span>
        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/40">
          {activeOption.tag}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-cyan-400' : ''
          }`}
        />
      </button>

      {/* Searchable Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1.5 w-80 bg-[#0c121e] border border-[#1b253b] rounded-xl shadow-2xl py-2 z-50 font-mono text-xs animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#182338]"
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          {/* Header & Title */}
          <div className="px-3 pb-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Select Exchange
            </span>
            <span className="text-[9px] text-cyan-400/80 bg-cyan-950/50 px-1.5 py-0.2 rounded border border-cyan-800/30">
              Live Providers
            </span>
          </div>

          {/* Search Input Box */}
          <div className="p-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search exchange..."
                className="w-full pl-8 pr-7 py-1.5 bg-[#070b12] border border-[#1b253b] focus:border-cyan-500/70 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white"
                  aria-label="Clear search text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtered Exchanges List */}
          <div
            ref={listContainerRef}
            className="py-1 max-h-72 overflow-y-auto no-scrollbar space-y-0.5 px-1"
          >
            {filteredExchanges.length === 0 ? (
              <div className="py-6 text-center text-slate-400 font-sans text-xs">
                <p>No exchanges matching &ldquo;{searchQuery}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-1 text-[11px] text-cyan-400 hover:underline font-mono"
                >
                  Reset search
                </button>
              </div>
            ) : (
              filteredExchanges.map((opt, idx) => {
                const isSelected = opt.id === activeExchange;
                const isHighlighted = idx === highlightedIndex;
                const isAll = opt.id === 'ALL';

                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-exchange-item
                    onClick={() => handleSelect(opt.id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors text-left ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                        : isHighlighted
                        ? 'bg-[#121c2e] text-white'
                        : 'text-slate-300 hover:bg-[#121c2e] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {isAll ? (
                        <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-400">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                        </div>
                      ) : (
                        renderStatusDot(opt.status, opt.isHealthy)
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold truncate text-xs">{opt.name}</span>
                          {opt.isPopular && !isAll && (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/30 uppercase">
                              Top
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-sans truncate leading-none mt-0.5">
                          {opt.marketType || opt.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-[#090e18] border border-[#172236]">
                        {opt.tag}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Stats Strip with dynamic count */}
          <div className="px-3 pt-2 pb-1 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              {searchQuery
                ? `${filteredExchanges.length} of ${activeExchangeCount} exchanges available`
                : `${activeExchangeCount} exchanges available`}
            </span>
            <span className="text-[9px] text-slate-500 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Multi-Source Registry</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
