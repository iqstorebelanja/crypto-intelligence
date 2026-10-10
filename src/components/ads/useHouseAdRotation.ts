import { useCallback, useEffect, useRef, useState } from 'react';
import { GlobalAdConfig, HouseAd, HouseAdAudience } from '../../types';

interface UseHouseAdRotationProps {
  userTier?: HouseAdAudience;
  exchange?: string;
  placement?: 'DESKTOP_FOOTER' | 'MOBILE_FOOTER' | 'COMMUNITY' | 'GLOBAL_SHELL';
}

export function useHouseAdRotation({
  userTier = 'FREE',
  exchange,
  placement = 'DESKTOP_FOOTER'
}: UseHouseAdRotationProps = {}) {
  const [config, setConfig] = useState<GlobalAdConfig | null>(null);
  const [creatives, setCreatives] = useState<HouseAd[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isTabVisible, setIsTabVisible] = useState<boolean>(() => !document.hidden);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      const snoozeUntil = localStorage.getItem('ci_ad_snooze_until');
      if (snoozeUntil && parseInt(snoozeUntil, 10) > Date.now()) {
        return true;
      }
    } catch {
      // fallback
    }
    return false;
  });

  const lastImpressionRecordedRef = useRef<string | null>(null);
  const timerRef = useRef<any>(null);

  // 1. Fetch Ad Config & Active Creatives
  useEffect(() => {
    let isMounted = true;

    async function loadAdData() {
      try {
        const [configRes, creativesRes] = await Promise.all([
          fetch('/api/advertising/config'),
          fetch(`/api/advertising/creatives?tier=${userTier}${exchange ? `&exchange=${exchange}` : ''}`)
        ]);

        if (!isMounted) return;

        if (configRes.ok) {
          const cfg = await configRes.json();
          setConfig(cfg);
        }

        if (creativesRes.ok) {
          const json = await creativesRes.json();
          if (json.creatives && Array.isArray(json.creatives)) {
            setCreatives(json.creatives);
          }
        }
      } catch (err) {
        // Silent fallback - never block the main app
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAdData();

    return () => {
      isMounted = false;
    };
  }, [userTier, exchange]);

  // 2. Visibility Listener (Pause rotation in background tabs to save CPU/resources)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const currentCreative = creatives.length > 0 ? creatives[currentIndex % creatives.length] : null;

  // 3. Record Impression for active creative (once per creative rotation)
  useEffect(() => {
    if (!currentCreative || isDismissed || !isTabVisible) return;

    const creativeId = currentCreative.id;
    if (lastImpressionRecordedRef.current === creativeId) return;
    lastImpressionRecordedRef.current = creativeId;

    fetch('/api/advertising/events/impression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creativeId,
        placement,
        userTier,
        provider: 'HOUSE'
      })
    }).catch(() => {
      // Non-blocking telemetry
    });
  }, [currentCreative, isDismissed, isTabVisible, placement, userTier]);

  // 4. Creative Rotation Timer (default ~15 seconds, pauses when hidden or single creative)
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Guard conditions:
    // - Config disabled or rotation disabled
    // - Less than 2 creatives (no need to rotate single creative)
    // - Tab hidden (visibility-aware pause)
    // - User dismissed / snoozed
    if (!config || !config.enabled) return;
    if (!config.houseAdRotation.enabled) return;
    if (creatives.length <= 1) return;
    if (!isTabVisible) return;
    if (isDismissed) return;

    const intervalSeconds = Math.max(
      config.houseAdRotation.minIntervalSeconds || 10,
      config.houseAdRotation.intervalSeconds || 15
    );

    timerRef.current = setInterval(() => {
      setCurrentIndex(prevIndex => {
        if (creatives.length <= 1) return 0;

        if (config.houseAdRotation.randomizeOrder && creatives.length > 2) {
          // Avoid showing exact same creative twice consecutively
          let nextIndex = Math.floor(Math.random() * creatives.length);
          while (nextIndex === prevIndex) {
            nextIndex = Math.floor(Math.random() * creatives.length);
          }
          return nextIndex;
        }

        // Sequential controlled rotation
        return (prevIndex + 1) % creatives.length;
      });
    }, intervalSeconds * 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [config, creatives.length, isTabVisible, isDismissed]);

  // 5. Click Tracking
  const recordClick = useCallback((creative: HouseAd) => {
    fetch('/api/advertising/events/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creativeId: creative.id,
        placement,
        userTier,
        targetUrl: creative.targetUrl,
        provider: 'HOUSE'
      })
    }).catch(() => {
      // Non-blocking
    });
  }, [placement, userTier]);

  // 6. Dismiss / Snooze Action
  const dismissAd = useCallback(() => {
    setIsDismissed(true);
    const snoozeMinutes = config?.dismissSnoozeMinutes || 30;
    try {
      const snoozeUntil = Date.now() + snoozeMinutes * 60 * 1000;
      localStorage.setItem('ci_ad_snooze_until', snoozeUntil.toString());
    } catch {
      // fallback
    }
  }, [config?.dismissSnoozeMinutes]);

  const resumeAd = useCallback(() => {
    setIsDismissed(false);
    try {
      localStorage.removeItem('ci_ad_snooze_until');
    } catch {
      // fallback
    }
  }, []);

  return {
    config,
    creatives,
    currentCreative,
    currentIndex,
    totalCreatives: creatives.length,
    isLoading,
    isDismissed,
    isTabVisible,
    recordClick,
    dismissAd,
    resumeAd
  };
}
