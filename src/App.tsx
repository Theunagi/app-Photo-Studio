import { useState, useCallback, useEffect } from 'react';
import type { Project } from './models/project';
import { getProject } from './services/db/projectDB';
import { testSupabaseConnection, type SupabaseDiagnostic } from './services/db/supabase';
import HomeScreen from './screens/Home/HomeScreen';
import StudioScreen from './screens/Studio/StudioScreen';

type View =
  | { screen: 'home' }
  | { screen: 'studio'; project: Project | null }
  | { screen: 'loading' };

function App() {
  const [view, setView] = useState<View>({ screen: 'home' });
  const [diag, setDiag] = useState<SupabaseDiagnostic | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    testSupabaseConnection().then(d => {
      setDiag(d);
      if (d.configured) setShowDiag(true);
    });
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

  const goHome = useCallback(() => { setView({ screen: 'home' }); }, []);

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
      {!diag.dbConnected && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#a0a0a0', lineHeight: 1.5 }}>
          Table missing? Run in SQL Editor:<br/>
          <code style={{ background: '#2a2a3a', padding: '2px 6px', borderRadius: 4, fontSize: 10, wordBreak: 'break-all' }}>
            CREATE TABLE projects (id uuid PRIMARY KEY, name text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), thumbnail text, config jsonb DEFAULT '{"{}"}'::jsonb, results jsonb DEFAULT '{"{}"}'::jsonb);
          </code>
        </div>
      )}
      {diag.dbConnected && !diag.dbWritable && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#a0a0a0', lineHeight: 1.5 }}>
          RLS blocking writes? Run:<br/>
          <code style={{ background: '#2a2a3a', padding: '2px 6px', borderRadius: 4, fontSize: 10, wordBreak: 'break-all' }}>
            CREATE POLICY "anon_all" ON projects FOR ALL USING (true) WITH CHECK (true);
          </code>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {view.screen === 'studio'
        ? <StudioScreen project={view.project} onBack={goHome} />
        : <HomeScreen onOpenStudio={openStudio} />}
      {diagBanner}
    </>
  );
}

export default App;
