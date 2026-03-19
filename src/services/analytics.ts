/**
 * Analytics — Google Ads conversion tracking + custom events.
 *
 * Usage:
 *   trackConversion('AW-XXXXX/yyyyyy');        // Google Ads conversion
 *   trackEvent('sign_up', { method: 'google' }); // Custom GA4 event
 */

type GtagFn = (...args: any[]) => void;

function getGtag(): GtagFn | null {
  return (window as any).gtag ?? null;
}

/**
 * Track a Google Ads conversion.
 * @param conversionId  e.g. "AW-123456789/abcDEFghiJKL"
 * @param value         optional monetary value
 * @param currency      default "EUR"
 */
export function trackConversion(
  conversionId: string,
  value?: number,
  currency = 'EUR',
) {
  const gtag = getGtag();
  if (!gtag) return;

  const params: Record<string, unknown> = {
    send_to: conversionId,
  };
  if (value !== undefined) {
    params.value = value;
    params.currency = currency;
  }
  gtag('event', 'conversion', params);
}

/**
 * Track a custom GA4 event.
 * @param eventName  e.g. "sign_up", "purchase", "generate_image"
 * @param params     optional event parameters
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', eventName, params);
}
