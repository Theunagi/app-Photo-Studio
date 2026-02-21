/**
 * Pricing Screen — Subscription plans via RevenueCat + Stripe.
 * Falls back to direct Stripe Payment Links if RevenueCat is not configured.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PLANS } from '../../services/db/points';
import {
  isRevenueCatConfigured,
  initRevenueCat,
  fetchOfferings,
  purchasePackage,
  getActiveEntitlement,
} from '../../services/payments/revenuecat';
import type { Package } from '@revenuecat/purchases-js';
import './PricingScreen.css';

interface PricingScreenProps {
  currentPlan: string;
  pointsBalance: number;
  userEmail?: string;
  userId?: string;
  onBack: () => void;
  onPlanChanged?: () => void;
}

/** Map RevenueCat package identifiers to our plan IDs */
const RC_PACKAGE_TO_PLAN: Record<string, string> = {
  '$rc_monthly': 'starter',
  '$rc_annual': 'pro',
  '$rc_lifetime': 'business',
};

/** Fallback: Stripe Payment Links (used when RevenueCat is not configured) */
const STRIPE_LINKS: Record<string, string | undefined> = {
  starter: import.meta.env.VITE_STRIPE_LINK_STARTER,
  pro: import.meta.env.VITE_STRIPE_LINK_PRO,
  business: import.meta.env.VITE_STRIPE_LINK_BUSINESS,
};

const PricingScreen: React.FC<PricingScreenProps> = ({ currentPlan, pointsBalance, userEmail, userId, onBack, onPlanChanged }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rcPackages, setRcPackages] = useState<Map<string, Package>>(new Map());
  const [showCheckout, setShowCheckout] = useState(false);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const useRC = isRevenueCatConfigured();

  // Initialize RevenueCat and fetch offerings
  useEffect(() => {
    if (!useRC || !userId) return;

    try { initRevenueCat(userId); } catch { /* already initialized */ }

    fetchOfferings().then(offerings => {
      const current = offerings.current;
      if (!current) {
        console.warn('[RC] No current offering found');
        return;
      }

      const pkgMap = new Map<string, Package>();
      for (const pkg of current.availablePackages) {
        // Match by package identifier (e.g. "starter", "pro", "business")
        const planId = RC_PACKAGE_TO_PLAN[pkg.identifier] ?? pkg.identifier;
        pkgMap.set(planId, pkg);
      }
      setRcPackages(pkgMap);
      console.log('[RC] Offerings loaded:', [...pkgMap.keys()]);
    }).catch(err => {
      console.error('[RC] Failed to load offerings:', err);
    });
  }, [useRC, userId]);

  // Handle purchase via RevenueCat
  const handleRCPurchase = useCallback(async (planId: string) => {
    const pkg = rcPackages.get(planId);
    if (!pkg) {
      setError(`Package "${planId}" not found in RevenueCat offerings`);
      return;
    }

    setLoading(planId);
    setError(null);
    setShowCheckout(true);

    // Wait for checkout div to mount
    await new Promise(r => setTimeout(r, 100));

    if (!checkoutRef.current) {
      setError('Checkout container not found');
      setLoading(null);
      setShowCheckout(false);
      return;
    }

    try {
      await purchasePackage(pkg, checkoutRef.current, userEmail);

      // After successful purchase, check entitlement
      const activePlan = await getActiveEntitlement();
      console.log('[RC] Purchase complete, active plan:', activePlan);

      setShowCheckout(false);
      onPlanChanged?.();
      onBack();
    } catch (err) {
      console.error('[RC] Purchase failed:', err);
      setError(err instanceof Error ? err.message : 'Purchase failed');
      setShowCheckout(false);
    } finally {
      setLoading(null);
    }
  }, [rcPackages, userEmail, onBack, onPlanChanged]);

  // Fallback: direct Stripe Payment Links
  const handleStripePurchase = (planId: string) => {
    const link = STRIPE_LINKS[planId];
    if (!link) {
      setError('Payment link not configured. Add VITE_STRIPE_LINK_* to .env.');
      return;
    }
    setLoading(planId);
    const url = new URL(link);
    if (userId) url.searchParams.set('client_reference_id', userId);
    if (userEmail) url.searchParams.set('prefilled_email', userEmail);
    window.location.href = url.toString();
  };

  const handleSubscribe = (planId: string) => {
    if (useRC && rcPackages.has(planId)) {
      handleRCPurchase(planId);
    } else {
      handleStripePurchase(planId);
    }
  };

  return (
    <div className="pricing">
      <header className="pricing-header">
        <button className="pricing-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <div className="pricing-balance">
          <span className="balance-label">Your credits</span>
          <span className="balance-value">{pointsBalance} credits</span>
        </div>
      </header>

      <div className="pricing-hero">
        <h1>Choose your plan</h1>
        <p>Each generation costs <strong>2 credits</strong> (2K) or <strong>3 credits</strong> (4K)</p>
      </div>

      {error && (
        <div className="pricing-error">
          {error}
          <button onClick={() => setError(null)}>x</button>
        </div>
      )}

      <div className="pricing-cards">
        {PLANS.map((plan, index) => {
          const isCurrent = currentPlan === plan.id;
          const isPopular = index === 1;

          return (
            <div key={plan.id} className={`pricing-card ${isPopular ? 'popular' : ''} ${isCurrent ? 'current' : ''}`}>
              {isPopular && <div className="popular-badge">Most popular</div>}
              {isCurrent && <div className="current-badge">Current plan</div>}

              <h2>{plan.name}</h2>
              <div className="pricing-price">
                <span className="price-amount">{plan.price.toFixed(2).replace('.', ',')}€</span>
                <span className="price-period">/ month</span>
              </div>

              <div className="pricing-points">
                <span className="points-amount">{plan.points}</span>
                <span className="points-label">credits / month</span>
              </div>

              <ul className="pricing-features">
                {plan.features.map((feature, fi) => (
                  <li key={fi}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7.5l2.5 2.5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`pricing-btn ${isPopular ? 'pricing-btn-primary' : ''}`}
                onClick={() => handleSubscribe(plan.id)}
                disabled={isCurrent || loading === plan.id}
              >
                {loading === plan.id ? 'Processing...' : isCurrent ? 'Active' : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>

      {/* RevenueCat checkout overlay — Stripe Elements renders here */}
      {showCheckout && (
        <div className="rc-checkout-overlay">
          <div className="rc-checkout-container">
            <button className="rc-checkout-close" onClick={() => { setShowCheckout(false); setLoading(null); }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <div ref={checkoutRef} className="rc-checkout-target" />
          </div>
        </div>
      )}

      <div className="pricing-footer">
        <p>Secure payment via Stripe. Cancel anytime.</p>
      </div>
    </div>
  );
};

export default PricingScreen;
