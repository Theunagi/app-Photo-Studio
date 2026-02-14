import { useState, useCallback, useEffect } from 'react';
import type { Project } from './models/project';
import { getProject } from './services/db/projectDB';
import { testSupabaseConnection } from './services/db/supabase';
import HomeScreen from './screens/Home/HomeScreen';
import StudioScreen from './screens/Studio/StudioScreen';

type View =
  | { screen: 'home' }
  | { screen: 'studio'; project: Project | null }
  | { screen: 'loading' };

function App() {
  const [view, setView] = useState<View>({ screen: 'home' });

  // Test Supabase connection on startup — result logged to browser console
  useEffect(() => { testSupabaseConnection(); }, []);

  const openStudio = useCallback(async (project: Project | null) => {
    if (!project) {
      // Fast generation — no project to hydrate
      setView({ screen: 'studio', project: null });
      return;
    }

    // Hydrate full project (downloads images from Supabase Storage if needed)
    setView({ screen: 'loading' });
    try {
      const full = await getProject(project.id);
      setView({ screen: 'studio', project: full ?? project });
    } catch (err) {
      console.error('Failed to load project:', err);
      setView({ screen: 'studio', project });
    }
  }, []);

  const goHome = useCallback(() => {
    setView({ screen: 'home' });
  }, []);

  if (view.screen === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-muted)', fontSize: '14px' }}>
        Loading project...
      </div>
    );
  }

  if (view.screen === 'studio') {
    return <StudioScreen project={view.project} onBack={goHome} />;
  }

  return <HomeScreen onOpenStudio={openStudio} />;
}

export default App;
