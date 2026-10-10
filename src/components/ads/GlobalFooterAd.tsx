import React from 'react';
import { useLocation } from 'react-router-dom';
import { ResponsiveAdSlot } from './ResponsiveAdSlot';
import { useHouseAdRotation } from './useHouseAdRotation';
import { ExchangeId, User } from '../../types';

interface GlobalFooterAdProps {
  user: User | null;
  activeExchange?: ExchangeId;
  onAdVisibilityChange?: (isVisible: boolean) => void;
}

export const GlobalFooterAd: React.FC<GlobalFooterAdProps> = ({
  user,
  activeExchange,
  onAdVisibilityChange
}) => {
  const location = useLocation();
  const userTier = user?.isPro ? 'PRO' : 'FREE';

  const {
    config,
    currentCreative,
    currentIndex,
    totalCreatives,
    isDismissed,
    recordClick,
    dismissAd
  } = useHouseAdRotation({
    userTier,
    exchange: activeExchange,
    placement: 'GLOBAL_SHELL'
  });

  // Route-specific placement rules:
  // If community is open and placement on community is disabled in admin config, do not render to avoid composer interference
  const isCommunityRoute = location.pathname.startsWith('/community') || location.pathname.startsWith('/forum');
  const shouldRenderOnCommunity = config?.placements?.communityEnabled ?? false;

  const isVisible = Boolean(
    config?.enabled &&
    currentCreative &&
    !isDismissed &&
    (!isCommunityRoute || shouldRenderOnCommunity)
  );

  // Notify parent of visibility for responsive layout padding
  React.useEffect(() => {
    if (onAdVisibilityChange) {
      onAdVisibilityChange(isVisible);
    }
  }, [isVisible, onAdVisibilityChange]);

  if (!isVisible || !currentCreative) {
    return null;
  }

  return (
    <>
      {/* ============================================================== */}
      {/* 1. DESKTOP AD CONTAINER (Bottom of viewport, hidden on mobile) */}
      {/* ============================================================== */}
      <aside
        aria-label="Desktop Advertisement Slot"
        className="hidden lg:block fixed bottom-0 left-0 right-0 z-30 pointer-events-none pb-1.5 px-4"
      >
        <div className="max-w-6xl mx-auto pointer-events-auto">
          <ResponsiveAdSlot
            creative={currentCreative}
            totalCreatives={totalCreatives}
            currentIndex={currentIndex}
            onRecordClick={recordClick}
            onDismiss={dismissAd}
            allowDismissal={config?.allowDismissal}
            providerType={config?.providerType === 'EXTERNAL_ONLY' ? 'EXTERNAL' : 'HOUSE'}
            isCompact={false}
          />
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MOBILE AD CONTAINER (Directly above MobileBottomNav, hidden on desktop) */}
      {/* ============================================================== */}
      <aside
        aria-label="Mobile Advertisement Slot"
        className="block lg:hidden fixed left-0 right-0 z-30 pointer-events-none px-2.5 pb-1 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          <ResponsiveAdSlot
            creative={currentCreative}
            totalCreatives={totalCreatives}
            currentIndex={currentIndex}
            onRecordClick={recordClick}
            onDismiss={dismissAd}
            allowDismissal={config?.allowDismissal}
            providerType={config?.providerType === 'EXTERNAL_ONLY' ? 'EXTERNAL' : 'HOUSE'}
            isCompact={true}
          />
        </div>
      </aside>
    </>
  );
};
