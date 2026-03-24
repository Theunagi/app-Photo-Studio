import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Project } from './models/project';
import { getProject } from './services/db/projectDB';
import { testSupabaseConnection, onAuthStateChange, getCurrentUser, signOut, type SupabaseDiagnostic } from './services/db/supabase';
import { getOrCreateProfile, refreshProfile as refreshProfileFromServer, type UserProfile } from './services/db/points';
import CookieBanner from './components/CookieBanner';
import { trackSignUp, trackPurchase, trackPageView } from './services/analytics';

// Lazy-loaded screens — code splitting reduces initial bundle size
const HomeScreen = lazy(() => import('./screens/Home/HomeScreen'));
const StudioScreen = lazy(() => import('./screens/Studio/StudioScreen'));
const PricingScreen = lazy(() => import('./screens/Pricing/PricingScreen'));
const LoginScreen = lazy(() => import('./screens/Login/LoginScreen'));
const UploadScreen = lazy(() => import('./screens/Upload/UploadScreen'));
const LandingScreen = lazy(() => import('./screens/Landing/LandingScreen'));
const MentionsLegales = lazy(() => import('./screens/Legal/MentionsLegales'));
const CGV = lazy(() => import('./screens/Legal/CGV'));
const Confidentialite = lazy(() => import('./screens/Legal/Confidentialite'));
const CookiesPage = lazy(() => import('./screens/Legal/Cookies'));
const CGU = lazy(() => import('./screens/Legal/CGU'));
const SettingsScreen = lazy(() => import('./screens/Settings/SettingsScreen'));

type View =
  | { screen: 'home'; collectionFilter?: string; showNewProject?: boolean }
  | { screen: 'studio'; project: Project | null }
  | { screen: 'pricing' }
  | { screen: 'upload' }
  | { screen: 'settings' }
  | { screen: 'loading' }
  | { screen: 'legal'; page: 'mentions-legales' | 'cgv' | 'confidentialite' | 'cookies' | 'cgu' };

interface AppUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
}

/** Shared loading fallback for lazy-loaded screens */
const ScreenLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-muted, #888)', fontSize: '14px' }}>
    Loading...
  </div>
);

/** Map URL path to initial view state */
function pathToView(pathname: string): View | 'login' | 'landing' {
  switch (pathname) {
    case '/pricing': return { screen: 'pricing' };
    case '/upload': return { screen: 'upload' };
    case '/settings': return { screen: 'settings' };
    case '/login': return 'login';
    case '/mentions-legales': return { screen: 'legal', page: 'mentions-legales' };
    case '/cgv': return { screen: 'legal', page: 'cgv' };
    case '/confidentialite': return { screen: 'legal', page: 'confidentialite' };
    case '/cookies': return { screen: 'legal', page: 'cookies' };
    case '/cgu': return { screen: 'legal', page: 'cgu' };
    default: return { screen: 'home' };
  }
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive initial view from URL path
  const initialView = pathToView(location.pathname);
  const [view, setView] = useState<View>(
    typeof initialView === 'string' ? { screen: 'home' } : initialView
  );
  const [user, setUser] = useState<AppUser | null | undefined>(undefined); // undefined = loading
  const [showLogin, setShowLogin] = useState(initialView === 'login');
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

  // Track sign_up for first-time users
  useEffect(() => {
    if (user) {
      const signUpTracked = sessionStorage.getItem('ff_signup_tracked');
      if (!signUpTracked) {
        trackSignUp('google');
        sessionStorage.setItem('ff_signup_tracked', '1');
      }
    }
  }, [user]);

  // Load profile + run diagnostics after login
  useEffect(() => {
    if (user) {
      getOrCreateProfile().then(p => setProfile(p)).catch(console.error);
      testSupabaseConnection().then(d => {
        setDiag(d);
        // Only show diagnostic banner in development — never in production
        if (import.meta.env.DEV && d.configured && (!d.dbConnected || !d.dbWritable || !d.storageConnected || !d.storageWritable)) {
          setShowDiag(true);
        }
      });
    }
  }, [user]);

  // Refresh profile when returning from pricing / after generation
  const refreshProfile = useCallback(async () => {
    try {
      const p = await refreshProfileFromServer();
      setProfile(p);
    } catch {
      // Fallback to direct query
      try {
        const p = await getOrCreateProfile();
        setProfile(p);
      } catch { /* silent */ }
    }
  }, []);

  // Handle return from Stripe Payment Links (URL params: ?payment=success)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      // Track purchase conversion
      const plan = params.get('plan') ?? 'unknown';
      const priceMap: Record<string, number> = { starter: 9.90, pro: 19.90, business: 39.90 };
      trackPurchase(priceMap[plan] ?? 19.90, plan);
      // Clean URL
      navigate('/', { replace: true });
      // Refresh profile to pick up new credits (webhook may have fired)
      refreshProfile();
    }
  }, [refreshProfile, navigate]);

  // Sync browser back/forward navigation to view state
  useEffect(() => {
    const result = pathToView(location.pathname);
    if (result === 'login') {
      setShowLogin(true);
    } else if (result === 'landing') {
      setShowLogin(false);
      setView({ screen: 'home' });
    } else {
      setShowLogin(false);
      // Only sync non-studio views (studio needs project data)
      if (result.screen !== 'home' || view.screen !== 'studio') {
        setView(result);
      }
    }
    // Track SPA page views for GA4
    trackPageView(location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const openStudio = useCallback(async (project: Project | null) => {
    if (!project) {
      setView({ screen: 'studio', project: null });
      navigate('/studio', { replace: true });
      return;
    }
    setView({ screen: 'loading' });
    try {
      const full = await getProject(project.id);
      setView({ screen: 'studio', project: full ?? project });
      navigate(`/studio/${project.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to load project:', err);
      setView({ screen: 'studio', project });
      navigate(`/studio/${project.id}`, { replace: true });
    }
  }, [navigate]);

  const goHome = useCallback(() => { refreshProfile(); setView({ screen: 'home' }); navigate('/'); }, [refreshProfile, navigate]);
  const goHomeNewProject = useCallback(() => { refreshProfile(); setView({ screen: 'home', showNewProject: true }); navigate('/'); }, [refreshProfile, navigate]);
  const goPricing = useCallback(() => { setView({ screen: 'pricing' }); navigate('/pricing'); }, [navigate]);
  const goUpload = useCallback(() => { setView({ screen: 'upload' }); navigate('/upload'); }, [navigate]);
  const goSettings = useCallback(() => { setView({ screen: 'settings' }); navigate('/settings'); }, [navigate]);
  const goLegal = useCallback((page: 'mentions-legales' | 'cgv' | 'confidentialite' | 'cookies' | 'cgu') => {
    setView({ screen: 'legal', page });
    navigate(`/${page}`);
  }, [navigate]);
  const goLanding = useCallback(() => { setView({ screen: 'home' }); setShowLogin(false); navigate('/'); }, [navigate]);

  const goHomeWithCollection = useCallback((collectionId: string) => {
    refreshProfile();
    setView({ screen: 'home', collectionFilter: collectionId });
    navigate('/');
  }, [refreshProfile, navigate]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setView({ screen: 'home' });
    navigate('/');
  }, [navigate]);

  // Dev bypass login — only available in development mode
  const handleDevLogin = useCallback(() => {
    if (!import.meta.env.DEV) return; // Block in production
    setUser({
      id: 'dev-user-00000000',
      email: 'dev@localhost',
      name: 'Dev User',
    });
    navigate('/');
  }, [navigate]);

  // Loading auth state
  if (user === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-muted)', fontSize: '14px' }}>
        Loading...
      </div>
    );
  }

  // Legal pages — accessible without auth
  if (view.screen === 'legal') {
    const backFn = user ? goHome : goLanding;
    switch (view.page) {
      case 'mentions-legales': return <Suspense fallback={<ScreenLoader />}><MentionsLegales onBack={backFn} onLegalPage={goLegal} /><CookieBanner /></Suspense>;
      case 'cgv': return <Suspense fallback={<ScreenLoader />}><CGV onBack={backFn} /><CookieBanner /></Suspense>;
      case 'confidentialite': return <Suspense fallback={<ScreenLoader />}><Confidentialite onBack={backFn} /><CookieBanner /></Suspense>;
      case 'cookies': return <Suspense fallback={<ScreenLoader />}><CookiesPage onBack={backFn} /><CookieBanner /></Suspense>;
      case 'cgu': return <Suspense fallback={<ScreenLoader />}><CGU onBack={backFn} /><CookieBanner /></Suspense>;
    }
  }

  // Not logged in
  if (!user) {
    if (showLogin) {
      return <Suspense fallback={<ScreenLoader />}><LoginScreen onDevLogin={import.meta.env.DEV ? handleDevLogin : undefined} onBack={() => { setShowLogin(false); navigate('/'); }} /></Suspense>;
    }
    return <Suspense fallback={<ScreenLoader />}><LandingScreen onLogin={() => { setShowLogin(true); navigate('/login'); }} onLegalPage={goLegal} /><CookieBanner /></Suspense>;
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

  const renderScreen = () => {
    switch (view.screen) {
      case 'studio':
        return (
          <StudioScreen
            key={view.project?.id ?? '__fast__'}
            project={view.project}
            onBack={goHome}
            onNewProject={goHomeNewProject}
            onOpenStudio={openStudio}
            pointsBalance={profile?.points_balance ?? 0}
            onPointsChanged={refreshProfile}
            userName={user.name || user.email || 'User'}
            userAvatar={user.avatar}
            credits={profile?.points_balance}
            onSignOut={handleSignOut}
            onGoPricing={goPricing}
            onGoSettings={goSettings}
            onMassImport={goUpload}
          />
        );
      case 'pricing':
        return <PricingScreen currentPlan={profile?.plan ?? 'free'} pointsBalance={profile?.points_balance ?? 0} userEmail={user.email} userId={user.id} onBack={goHome} onPlanChanged={refreshProfile} />;
      case 'upload':
        return (
          <UploadScreen
            onBack={goHome}
            onDone={goHomeWithCollection}
            creditsAvailable={profile?.points_balance ?? 0}
            onCreditsChanged={refreshProfile}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            onBack={goHome}
            user={user}
            profile={profile}
            onSignOut={handleSignOut}
            onGoPricing={goPricing}
            onProfileUpdated={refreshProfile}
          />
        );
      default:
        return (
          <HomeScreen
            onOpenStudio={openStudio}
            onMassImport={goUpload}
            userName={user.name || user.email || 'User'}
            userAvatar={user.avatar}
            credits={profile?.points_balance}
            onSignOut={handleSignOut}
            onGoPricing={goPricing}
            onGoSettings={goSettings}
            collectionFilter={(view as { collectionFilter?: string }).collectionFilter}
            showNewProject={(view as { showNewProject?: boolean }).showNewProject}
          />
        );
    }
  };

  return (
    <Suspense fallback={<ScreenLoader />}>
      {renderScreen()}
      {diagBanner}
      <CookieBanner />
    </Suspense>
  );
}

export default App;
