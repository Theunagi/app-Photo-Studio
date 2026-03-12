import { useState, useEffect } from 'react';
import './CookieBanner.css';

type ConsentStatus = 'accepted' | 'refused' | null;

function getConsent(): ConsentStatus {
  return localStorage.getItem('cookie_consent') as ConsentStatus;
}

function setConsent(status: 'accepted' | 'refused') {
  localStorage.setItem('cookie_consent', status);
  localStorage.setItem('cookie_consent_date', new Date().toISOString());
}

// Load Google Analytics only if consent given
function loadAnalytics() {
  // Only load if not already loaded
  if (document.querySelector('script[src*="googletagmanager"]')) return;

  const gaId = import.meta.env.VITE_GA_ID;
  if (!gaId) return;

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  script.async = true;
  document.head.appendChild(script);

  script.onload = () => {
    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
    gtag('js', new Date());
    gtag('config', gaId);
  };
}

// Remove analytics cookies
function removeAnalyticsCookies() {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const name = cookie.split('=')[0].trim();
    if (name.startsWith('_ga') || name.startsWith('_gid')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getConsent();
    if (consent === null) {
      // Check if consent is older than 6 months
      setVisible(true);
    } else if (consent === 'accepted') {
      // Check expiry (6 months = ~182 days)
      const consentDate = localStorage.getItem('cookie_consent_date');
      if (consentDate) {
        const elapsed = Date.now() - new Date(consentDate).getTime();
        const sixMonths = 182 * 24 * 60 * 60 * 1000;
        if (elapsed > sixMonths) {
          // Expired — re-ask
          localStorage.removeItem('cookie_consent');
          localStorage.removeItem('cookie_consent_date');
          setVisible(true);
          return;
        }
      }
      loadAnalytics();
    }
    // If 'refused', do nothing — no analytics
  }, []);

  const handleAccept = () => {
    setConsent('accepted');
    setVisible(false);
    loadAnalytics();
  };

  const handleRefuse = () => {
    setConsent('refused');
    setVisible(false);
    removeAnalyticsCookies();
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <div className="cookie-banner-content">
        <div className="cookie-banner-text">
          <strong>Ce site utilise des cookies</strong>
          <p>
            Nous utilisons des cookies analytiques pour comprendre comment vous utilisez notre site
            et ameliorer votre experience. Aucun cookie publicitaire n'est utilise.
          </p>
        </div>
        <div className="cookie-banner-actions">
          <button className="cookie-btn cookie-btn-refuse" onClick={handleRefuse}>
            Tout refuser
          </button>
          <button className="cookie-btn cookie-btn-accept" onClick={handleAccept}>
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}
