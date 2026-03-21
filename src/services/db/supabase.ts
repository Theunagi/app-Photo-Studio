/**
 * Supabase Client — Singleton
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from env.
 * Falls back gracefully if creation fails (app uses IndexedDB instead).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let _supabase: SupabaseClient | null = null;
let _initOk = false;

if (supabaseUrl && supabaseAnonKey) {
  try {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    _initOk = true;
  } catch (err) {
    import.meta.env.DEV && console.warn('[Supabase] createClient failed — falling back to IndexedDB:', err);
  }
} else {
  import.meta.env.DEV && console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — DB features disabled.');
}

/**
 * Supabase client instance. Only use after checking isSupabaseConfigured().
 */
export const supabase = _supabase as SupabaseClient;

/** Check if Supabase is properly configured and client was created */
export function isSupabaseConfigured(): boolean {
  return _initOk && _supabase !== null;
}

// --- Auth helpers ---

export async function signInWithGoogle() {
  if (!_supabase) throw new Error('Supabase not configured');
  const { error } = await _supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!_supabase) return;
  await _supabase.auth.signOut();
}

export function onAuthStateChange(callback: (user: { id: string; email?: string; name?: string; avatar?: string } | null) => void) {
  if (!_supabase) return { unsubscribe: () => {} };
  const { data } = _supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      const u = session.user;
      callback({
        id: u.id,
        email: u.email ?? undefined,
        name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? undefined,
        avatar: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? undefined,
      });
    } else {
      callback(null);
    }
  });
  return data.subscription;
}

export async function getCurrentUser() {
  if (!_supabase) return null;
  const { data } = await _supabase.auth.getUser();
  if (!data.user) return null;
  const u = data.user;
  return {
    id: u.id,
    email: u.email ?? undefined,
    name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? undefined,
    avatar: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? undefined,
  };
}

export interface SupabaseDiagnostic {
  configured: boolean;
  dbConnected: boolean;
  dbError?: string;
  dbWritable: boolean;
  dbWriteError?: string;
  storageConnected: boolean;
  storageError?: string;
  storageWritable: boolean;
  storageWriteError?: string;
}

/** Run a comprehensive connectivity test (call once at app startup) */
export async function testSupabaseConnection(): Promise<SupabaseDiagnostic> {
  const result: SupabaseDiagnostic = {
    configured: false, dbConnected: false, dbWritable: false,
    storageConnected: false, storageWritable: false,
  };
  if (!_initOk || !_supabase) {
    import.meta.env.DEV && console.warn('[Supabase] Not configured — using IndexedDB');
    return result;
  }
  result.configured = true;

  // 1. DB read
  try {
    const { error } = await _supabase.from('projects').select('id').limit(1);
    if (error) { result.dbError = error.message; }
    else { result.dbConnected = true; }
  } catch (err) { result.dbError = String(err); }

  // 2. DB write
  if (result.dbConnected) {
    try {
      const testId = '00000000-0000-0000-0000-000000000000';
      const { data: userData } = await _supabase.auth.getUser();
      const userId = userData?.user?.id;
      const { error } = await _supabase.from('projects').upsert({
        id: testId, name: '_test', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), config: {}, results: {},
        ...(userId ? { user_id: userId } : {}),
      }, { onConflict: 'id' });
      if (error) { result.dbWriteError = error.message; }
      else { result.dbWritable = true; await _supabase.from('projects').delete().eq('id', testId); }
    } catch (err) { result.dbWriteError = String(err); }
  }

  // 3. Storage read
  try {
    const { error } = await _supabase.storage.from('project-images').list('', { limit: 1 });
    if (error) { result.storageError = error.message; }
    else { result.storageConnected = true; }
  } catch (err) { result.storageError = String(err); }

  // 4. Storage write
  try {
    const testPath = '_test/check.txt';
    const { error } = await _supabase.storage
      .from('project-images')
      .upload(testPath, new Blob(['ok'], { type: 'text/plain' }), { contentType: 'text/plain', upsert: true });
    if (error) { result.storageWriteError = error.message; }
    else { result.storageWritable = true; await _supabase.storage.from('project-images').remove([testPath]); }
  } catch (err) { result.storageWriteError = String(err); }

  import.meta.env.DEV && console.log('[Supabase] Diagnostic:', JSON.stringify(result, null, 2));
  return result;
}
