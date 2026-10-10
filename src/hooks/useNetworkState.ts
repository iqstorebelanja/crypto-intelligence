import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkState {
  isOnline: boolean;
  wasOffline: boolean;
  showBackOnlineBanner: boolean;
  isLowBandwidth: boolean;
  effectiveType: string;
}

export function useNetworkState(onReconnect?: () => void): NetworkState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [showBackOnlineBanner, setShowBackOnlineBanner] = useState<boolean>(false);
  const [effectiveType, setEffectiveType] = useState<string>('4g');
  const [isLowBandwidth, setIsLowBandwidth] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<any>(null);
  const bannerTimerRef = useRef<any>(null);

  useEffect(() => {
    // Inspect NetworkInformation API if available
    const updateConnectionStatus = () => {
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn) {
        const type = conn.effectiveType || '4g';
        setEffectiveType(type);
        setIsLowBandwidth(type === '2g' || type === 'slow-2g' || conn.saveData === true);
      }
    };

    updateConnectionStatus();
    const conn = (navigator as any).connection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', updateConnectionStatus);
    }

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowBackOnlineBanner(true);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => {
          setShowBackOnlineBanner(false);
        }, 4000);

        // Debounce reconnect callback to prevent storm
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (onReconnect) onReconnect();
        }, 800);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBackOnlineBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', updateConnectionStatus);
      }
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [wasOffline, onReconnect]);

  return {
    isOnline,
    wasOffline,
    showBackOnlineBanner,
    isLowBandwidth,
    effectiveType
  };
}
