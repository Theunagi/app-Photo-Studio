/**
 * Analytics — Google Ads + GA4 conversion & event tracking.
 *
 * Events tracked:
 *   sign_up        — first-time user login (Google OAuth)
 *   begin_checkout — user clicks pricing CTA / "Start Free Trial"
 *   purchase       — successful Stripe payment return
 *   generate_image — pipeline completed successfully
 *   generate_lifestyle — lifestyle image generated
 *
 * Google Ads conversion tracking uses the AW-xxx ID from env.
 * All events are also sent to GA4 for funnel analysis.
 */

type GtagFn = (...args: any[]) => void;

function getGtag(): GtagFn | null {
  return (window as any).gtag ?? null;
}

const ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID ?? '';

/**
 * Track a Google Ads conversion + GA4 event in one call.
 * @param eventName  GA4 event name (e.g. "sign_up", "purchase")
 * @param value      optional monetary value
 * @param currency   default "EUR"
 * @param extra      additional GA4 params
 */
export function trackConversion(
  eventName: string,
  value?: number,
  currency = 'EUR',
  extra?: Record<string, unknown>,
) {
  const gtag = getGtag();
  if (!gtag) return;

  const params: Record<string, unknown> = { ...extra };
  if (value !== undefined) {
    params.value = value;
    params.currency = currency;
  }

  // GA4 event
  gtag('event', eventName, params);

  // Google Ads conversion (if ADS_ID configured)
  if (ADS_ID) {
    gtag('event', 'conversion', {
      send_to: ADS_ID,
      ...params,
    });
  }
}

/**
 * Track a custom GA4 event (no Google Ads conversion).
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', eventName, params);
}

// ─── Pre-built event helpers ─────────────────────────────────────────────────

/** Track sign-up (first login) */
export function trackSignUp(method = 'google') {
  trackConversion('sign_up', undefined, 'EUR', { method });
}

/** Track pricing CTA click */
export function trackBeginCheckout(plan?: string) {
  trackEvent('begin_checkout', { plan });
}

/** Track successful Stripe payment */
export function trackPurchase(value: number, plan?: string) {
  trackConversion('purchase', value, 'EUR', { plan });
}

/** Track pipeline completion (studio generation) */
export function trackGenerateImage(resolution = '2K', credits = 2) {
  trackEvent('generate_image', { resolution, credits });
}

/** Track lifestyle generation */
export function trackGenerateLifestyle() {
  trackEvent('generate_lifestyle');
}

/** Track page view (for SPA navigation) */
export function trackPageView(pagePath: string, pageTitle?: string) {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
  });
}
