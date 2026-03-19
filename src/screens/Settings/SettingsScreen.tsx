/**
 * Settings Screen — Tabbed settings with 6 sections.
 * Profil, Préférences, Sécurité, Plans & Facturation, Équipe, Référral
 */

import { useState, useCallback } from 'react';
import type { UserProfile } from '../../services/db/points';
import { PLANS, GENERATION_COST } from '../../services/db/points';
import './SettingsScreen.css';

type SettingsTab = 'profile' | 'preferences' | 'security' | 'billing';

interface SettingsScreenProps {
  onBack: () => void;
  user: { id: string; email?: string; name?: string; avatar?: string };
  profile: UserProfile | null;
  onSignOut: () => void;
  onGoPricing: () => void;
  onProfileUpdated?: () => void;
}

const TABS: { id: SettingsTab; label: string; icon: JSX.Element }[] = [
  {
    id: 'profile',
    label: 'Profil',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M2.5 14c0-2.5 2.2-4.5 5.5-4.5s5.5 2 5.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 3v2M6 9v4M10 3v6M10 13v0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="6" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="10" cy="11" r="2" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'billing',
    label: 'Plans & Billing',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M2 7h12" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  user,
  profile,
  onSignOut,
  onGoPricing,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [displayName, setDisplayName] = useState(user.name || '');
  const [defaultResolution, setDefaultResolution] = useState<'2K' | '4K'>('2K');
  const [emailNotifs, setEmailNotifs] = useState(true);
  const currentPlan = PLANS.find(p => p.id === profile?.plan) || null;
  const creditsUsed = currentPlan ? currentPlan.points - (profile?.points_balance ?? 0) : 0;
  const creditsTotal = currentPlan?.points ?? 0;
  const usagePercent = creditsTotal > 0 ? Math.min(100, Math.max(0, (creditsUsed / creditsTotal) * 100)) : 0;


  // ===================== TAB CONTENT =====================

  const renderProfile = () => (
    <>
      <div className="settings-section">
        <h3 className="settings-section-title">Profile Information</h3>
        <p className="settings-section-desc">Manage your personal information and account details.</p>

        <div className="settings-avatar-row">
          <div className="settings-avatar">
            {user.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              <span>{(user.name || user.email || 'U')[0].toUpperCase()}</span>
            )}
          </div>
          <div className="settings-avatar-info">
            <div className="settings-avatar-name">{user.name || 'User'}</div>
            <div className="settings-avatar-email">{user.email || 'No email'}</div>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-row-label">Full name</label>
          <div className="settings-row-value">
            <input
              type="text"
              className="settings-input"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-row-label">Email</label>
          <div className="settings-row-value">
            <input
              type="email"
              className="settings-input"
              value={user.email || ''}
              disabled
            />
            <p className="settings-input-hint">Managed by your Google account</p>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-row-label">User ID</label>
          <div className="settings-row-value">
            <input
              type="text"
              className="settings-input"
              value={user.id}
              readOnly
            />
            <p className="settings-input-hint">Used for support requests</p>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Danger Zone</h3>
        <p className="settings-section-desc">Irreversible actions on your account.</p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="settings-btn settings-btn-secondary" onClick={onSignOut}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign Out
          </button>
          <button className="settings-btn settings-btn-danger" disabled>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M5 4V2.5A.5.5 0 015.5 2h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Delete Account
          </button>
        </div>
      </div>
    </>
  );

  const renderPreferences = () => (
    <>
      <div className="settings-section">
        <h3 className="settings-section-title">Generation Defaults</h3>
        <p className="settings-section-desc">Set your default options for new generations.</p>

        <div className="settings-row">
          <label className="settings-row-label">Resolution</label>
          <div className="settings-row-value">
            <select
              className="settings-select"
              value={defaultResolution}
              onChange={e => setDefaultResolution(e.target.value as '2K' | '4K')}
            >
              <option value="2K">2K ({GENERATION_COST['2K']} credits)</option>
              <option value="4K">4K ({GENERATION_COST['4K']} credits)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Notifications</h3>
        <p className="settings-section-desc">Manage how you receive updates.</p>

        <div className="settings-toggle-row">
          <div className="settings-toggle-info">
            <div className="settings-toggle-name">Email notifications</div>
            <div className="settings-toggle-desc">Receive emails when your batch generations are complete.</div>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" checked={emailNotifs} onChange={e => setEmailNotifs(e.target.checked)} />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        <div className="settings-toggle-row">
          <div className="settings-toggle-info">
            <div className="settings-toggle-name">Product updates</div>
            <div className="settings-toggle-desc">Get notified about new features and improvements.</div>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" defaultChecked />
            <span className="settings-toggle-slider" />
          </label>
        </div>
      </div>

    </>
  );

  const renderSecurity = () => (
    <>
      <div className="settings-section">
        <h3 className="settings-section-title">Authentication</h3>
        <p className="settings-section-desc">Your account is secured via Google Sign-In.</p>

        <div className="settings-row">
          <label className="settings-row-label">Method</label>
          <div className="settings-row-value">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#1D1D1F' }}>Google Sign-In</span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#34C759', background: '#F0FFF4', padding: '3px 8px', borderRadius: '6px' }}>Active</span>
            </div>
            <p className="settings-input-hint">Your password and 2FA are managed by your Google account.</p>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Active Sessions</h3>
        <p className="settings-section-desc">Devices currently logged into your account.</p>

        <div className="settings-session-row">
          <div className="settings-session-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M6 15h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="settings-session-info">
            <div className="settings-session-device">Current Browser</div>
            <div className="settings-session-meta">Last active: Just now</div>
          </div>
          <span className="settings-session-active">Active</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Security Actions</h3>
        <p className="settings-section-desc">Additional security options for your account.</p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="settings-btn settings-btn-secondary" onClick={onSignOut}>
            Sign Out All Devices
          </button>
        </div>
      </div>
    </>
  );

  const renderBilling = () => (
    <>
      <div className="settings-section">
        <h3 className="settings-section-title">Current Plan</h3>
        <p className="settings-section-desc">Manage your subscription and credits.</p>

        <div className="settings-plan-card">
          <div className="settings-plan-info">
            <div className="settings-plan-name">
              {currentPlan ? currentPlan.name : 'Free'}
              {!currentPlan && <span style={{ fontSize: '12px', color: '#86868B', marginLeft: '8px' }}>5 credits</span>}
            </div>
            {currentPlan && (
              <div className="settings-plan-price">
                {currentPlan.price.toFixed(2).replace('.', ',')}€ / month
              </div>
            )}
          </div>
          <div className="settings-plan-credits">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 5v6M5.5 7.5l2.5-2.5 2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {profile?.points_balance ?? 0} credits
          </div>
        </div>

        {currentPlan && (
          <>
            <div className="settings-usage-bar">
              <div className="settings-usage-fill" style={{ width: `${usagePercent}%` }} />
            </div>
            <div className="settings-usage-label">
              {Math.max(0, creditsUsed)} / {creditsTotal} credits used this period
            </div>
          </>
        )}

        <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
          <button className="settings-btn settings-btn-orange" onClick={onGoPricing}>
            {currentPlan ? 'Change Plan' : 'Upgrade'}
          </button>
          {currentPlan && (
            <button className="settings-btn settings-btn-secondary" disabled>
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Billing Details</h3>
        <p className="settings-section-desc">Your payment information and invoices.</p>

        <div className="settings-row">
          <label className="settings-row-label">Payment method</label>
          <div className="settings-row-value">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
              <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
                <rect x="0.5" y="0.5" width="23" height="15" rx="2.5" stroke="#E8E8E4" fill="#FFF"/>
                <rect x="3" y="4" width="8" height="2" rx="1" fill="#E8E8E4"/>
                <rect x="3" y="8" width="5" height="2" rx="1" fill="#E8E8E4"/>
                <rect x="13" y="10" width="8" height="2" rx="1" fill="#E8E8E4"/>
              </svg>
              <span style={{ fontSize: '14px', color: '#1D1D1F' }}>
                {profile?.stripe_customer_id ? 'Stripe • Managed externally' : 'No payment method'}
              </span>
            </div>
            <p className="settings-input-hint">Payment is managed via Stripe. Contact support to update.</p>
          </div>
        </div>

        {profile?.current_period_end && (
          <div className="settings-row">
            <label className="settings-row-label">Next billing</label>
            <div className="settings-row-value">
              <p style={{ fontSize: '14px', color: '#1D1D1F', padding: '8px 0', margin: 0 }}>
                {new Date(profile.current_period_end).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Credit Costs</h3>
        <p className="settings-section-desc">How credits are consumed per generation.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ padding: '14px 16px', background: '#FAFAF8', borderRadius: '10px', border: '1px solid #F0F0EC' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1D1D1F' }}>{GENERATION_COST['2K']}</div>
            <div style={{ fontSize: '12px', color: '#86868B', marginTop: '2px' }}>credits / 2K image</div>
          </div>
          <div style={{ padding: '14px 16px', background: '#FAFAF8', borderRadius: '10px', border: '1px solid #F0F0EC' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1D1D1F' }}>{GENERATION_COST['4K']}</div>
            <div style={{ fontSize: '12px', color: '#86868B', marginTop: '2px' }}>credits / 4K image</div>
          </div>
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfile();
      case 'preferences': return renderPreferences();
      case 'security': return renderSecurity();
      case 'billing': return renderBilling();
    }
  };

  return (
    <div className="settings">
      {/* Header */}
      <header className="settings-header">
        <button className="settings-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="settings-header-title">Settings</span>
        <div className="settings-header-spacer" />
      </header>

      {/* Tab Navigation */}
      <nav className="settings-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="settings-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsScreen;
