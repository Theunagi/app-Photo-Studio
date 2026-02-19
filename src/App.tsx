import { useState, useCallback, useEffect } from 'react';
import type { Project } from './models/project';
import { getProject } from './services/db/projectDB';
import { testSupabaseConnection, onAuthStateChange, getCurrentUser, signOut, type SupabaseDiagnostic } from './services/db/supabase';
import { getOrCreateProfile, type UserProfile } from './services/db/points';
import HomeScreen from './screens/Home/HomeScreen';
import StudioScreen from './screens/Studio/StudioScreen';
import PricingScreen from './screens/Pricing/PricingScreen';
import LoginScreen from './screens/Login/LoginScreen';

type View =
  | { screen: 'home' }
  | { screen: 'studio'; project: Project | null }
  | { screen: 'pricing' }
  | { screen: 'loading' };

interface AppUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
}

function App() {
  const [view, setView] = useState<View>({ screen: 'home' });
  const [user, setUser] = useState<AppUser | null | undefined>(undefined); // undefined = loading
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [diag, setDiag] = useState<SupabaseDiagnostic | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  // Listen to auth state changes
  useEffect(() => {
    // Check current session first
    getCurrentUser().then(u => setUser(u));

    // Subscribe to changes
    const sub = onAuthStateChange(u => setUser(u));
    return () => {
      if (sub && 'unsubscribe' in sub) sub.unsubscribe();
    };
  }, []);

  // Load profile + run diagnostics after login
  useEffect(() => {
    if (user) {
      getOrCreateProfile().then(p => setProfile(p)).catch(console.error);
      testSupabaseConnection().then(d => {
        setDiag(d);
        if (d.configured && (!d.dbConnected || !d.dbWritable || !d.storageConnected || !d.storageWritable)) {
          setShowDiag(true);
        }
      });
    }
  }, [user]);

  // Refresh profile when returning from pricing / after generation
  const refreshProfile = useCallback(async () => {
    try {
      const p = await getOrCreateProfile();
      setProfile(p);
    } catch { /* silent */ }
  }, []);

  const openStudio = useCallback(async (project: Project | null) => {
    if (!project) {
      setView({ screen: 'studio', project: null });
      return;
    }
    setView({ screen: 'loading' });
    try {
      const full = await getProject(project.id);
      setView({ screen: 'studio', project: full ?? project });
    } catch (err) {
      console.error('Failed to load project:', err);
      setView({ screen: 'studio', project });
    }
  }, []);

  const goHome = useCallback(() => { refreshProfile(); setView({ screen: 'home' }); }, [refreshProfile]);
  const goPricing = useCallback(() => { setView({ screen: 'pricing' }); }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setView({ screen: 'home' });
  }, []);

  // Loading auth state
  if (user === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-muted)', fontSize: '14px' }}>
        Loading...
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <LoginScreen />;
  }

  // Loading project
  if (view.screen === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-muted)', fontSize: '14px' }}>
        Loading project...
      </div>
    );
  }

  const allOk = diag?.dbConnected && diag?.dbWritable && diag?.storageConnected && diag?.storageWritable;
  const Line = ({ ok, label, err }: { ok: boolean; label: string; err?: string }) => (
    <div style={{ color: ok ? '#4ade80' : '#f87171' }}>
      {ok ? 'OK' : 'FAIL'} — {label}{!ok && err ? `: ${err}` : ''}
    </div>
  );

  const diagBanner = showDiag && diag?.configured ? (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      background: '#1e1e2e', color: '#e0e0e0', padding: '14px 18px',
      borderRadius: 12, fontSize: 13, lineHeight: 1.7,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)', maxWidth: 380,
      border: `1px solid ${allOk ? '#22c55e' : '#ef4444'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Supabase Diagnostic</strong>
        <button onClick={() => setShowDiag(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>x</button>
      </div>
      <Line ok={diag.dbConnected} label='DB read (table "projects")' err={diag.dbError} />
      <Line ok={diag.dbWritable} label="DB write (upsert)" err={diag.dbWriteError} />
      <Line ok={diag.storageConnected} label="Storage read" err={diag.storageError} />
      <Line ok={diag.storageWritable} label="Storage write" err={diag.storageWriteError} />
    </div>
  ) : null;

  // User badge (points / avatar / sign out) — passed into headers
  const userBadge = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {profile && (
        <button
          onClick={goPricing}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11,
            fontWeight: 700, background: 'var(--color-surface)',
            border: '1px solid var(--color-primary)', color: 'var(--color-primary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {profile.points_balance} credits
        </button>
      )}
      {user.avatar && (
        <img src={user.avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--color-border)' }} />
      )}
      <button
        onClick={handleSignOut}
        style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 11,
          fontWeight: 600, background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', color: 'var(--color-text-dim)',
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </div>
  );

  const renderScreen = () => {
    switch (view.screen) {
      case 'studio':
        return <StudioScreen project={view.project} onBack={goHome} pointsBalance={profile?.points_balance ?? 0} onPointsChanged={refreshProfile} userBadge={userBadge} />;
      case 'pricing':
        return <PricingScreen currentPlan={profile?.plan ?? 'free'} pointsBalance={profile?.points_balance ?? 0} userEmail={user.email} userId={user.id} onBack={goHome} onPlanChanged={refreshProfile} />;
      default:
        return <HomeScreen onOpenStudio={openStudio} userBadge={userBadge} />;
    }
  };

  return (
    <>
      {renderScreen()}
      {diagBanner}
    </>
  );
}

export default App;
