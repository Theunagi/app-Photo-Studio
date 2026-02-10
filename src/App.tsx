import { useState, useCallback } from 'react';
import type { Project } from './models/project';
import HomeScreen from './screens/Home/HomeScreen';
import StudioScreen from './screens/Studio/StudioScreen';

type View = { screen: 'home' } | { screen: 'studio'; project: Project | null };

function App() {
  const [view, setView] = useState<View>({ screen: 'home' });

  const openStudio = useCallback((project: Project | null) => {
    setView({ screen: 'studio', project });
  }, []);

  const goHome = useCallback(() => {
    setView({ screen: 'home' });
  }, []);

  if (view.screen === 'studio') {
    return <StudioScreen project={view.project} onBack={goHome} />;
  }

  return <HomeScreen onOpenStudio={openStudio} />;
}

export default App;
