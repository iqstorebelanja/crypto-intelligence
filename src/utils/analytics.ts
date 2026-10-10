import { ProductAnalyticsEventType, FeedbackCategory } from '../types';

/**
 * Client-Side Privacy-Conscious Telemetry & Feedback Helper
 * Never sends passwords, session tokens, API keys, or payment credentials.
 */
export async function trackEvent(
  eventType: ProductAnalyticsEventType,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Fire and forget
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ eventType, metadata })
    }).catch(() => {
      // Intentionally silent on analytics errors
    });
  } catch {
    // Silent
  }
}

export async function submitUserFeedback(params: {
  category: FeedbackCategory;
  rating: number;
  message: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/analytics/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function trackPerfTiming(
  type: 'page_load' | 'scanner_load' | 'coin_load' | 'ai_response' | 'api_call',
  durationMs: number
): void {
  try {
    const isMobile = window.innerWidth < 768;
    fetch('/api/analytics/perf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type, durationMs, isMobile })
    }).catch(() => {});
  } catch {
    // Silent
  }
}
