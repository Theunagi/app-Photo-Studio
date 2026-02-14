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
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    _initOk = true;
  } catch (err) {
    console.warn('[Supabase] createClient failed — falling back to IndexedDB:', err);
  }
} else {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — DB features disabled.');
}

/**
 * Supabase client instance. Only use after checking isSupabaseConfigured().
 */
export const supabase = _supabase as SupabaseClient;

/** Check if Supabase is properly configured and client was created */
export function isSupabaseConfigured(): boolean {
  return _initOk && _supabase !== null;
}

/** Run a quick connectivity test (call once at app startup) */
export async function testSupabaseConnection(): Promise<boolean> {
  if (!_initOk || !_supabase) {
    console.warn('[Supabase] Not configured — using IndexedDB');
    return false;
  }
  try {
    const { error } = await _supabase.from('projects').select('id').limit(1);
    if (error) {
      console.error('[Supabase] Connection test FAILED:', error.message);
      return false;
    }
    console.log('[Supabase] Connection OK — data will sync to cloud');
    return true;
  } catch (err) {
    console.error('[Supabase] Connection test FAILED:', err);
    return false;
  }
}
