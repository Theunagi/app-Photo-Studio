/**
 * Pricing Screen — Subscription plans with Stripe checkout.
 */

import { useState } from 'react';
import { PLANS } from '../../services/db/points';
import './PricingScreen.css';

interface PricingScreenProps {
  currentPlan: string;
  pointsBalance: number;
  userEmail?: string;
  userId?: string;
  onBack: () => void;
}

const STRIPE_LINKS: Record<string, string | undefined> = {
  starter: import.meta.env.VITE_STRIPE_LINK_STARTER,
  pro: import.meta.env.VITE_STRIPE_LINK_PRO,
  business: import.meta.env.VITE_STRIPE_LINK_BUSINESS,
};

const PricingScreen: React.FC<PricingScreenProps> = ({ currentPlan, pointsBalance, userEmail, userId, onBack }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = (planId: string) => {
    const link = STRIPE_LINKS[planId];
    if (!link) {
      alert('Payment link not configured. Add VITE_STRIPE_LINK_* to your .env file.');
      return;
    }

    setLoading(planId);
    const url = new URL(link);
    if (userId) url.searchParams.set('client_reference_id', userId);
    if (userEmail) url.searchParams.set('prefilled_email', userEmail);
    window.location.href = url.toString();
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
          <span className="balance-value">{pointsBalance} pts</span>
        </div>
      </header>

      <div className="pricing-hero">
        <h1>Choose your plan</h1>
        <p>Each generation costs <strong>2 pts</strong> (2K) or <strong>3 pts</strong> (4K)</p>
      </div>

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
                <span className="points-label">points / month</span>
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
                {loading === plan.id ? 'Redirecting...' : isCurrent ? 'Active' : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="pricing-footer">
        <p>Secure payment via Stripe. Cancel anytime.</p>
      </div>
    </div>
  );
};

export default PricingScreen;
