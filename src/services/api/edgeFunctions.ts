/**
 * Edge Function Caller
 * Central module for calling Supabase Edge Functions.
 * Replaces all direct API calls to external services.
 *
 * Uses raw fetch instead of supabase.functions.invoke to get
 * detailed error messages from the Edge Function response body.
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Cannot call edge functions.');
  }

  // Get the current session token for auth
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token ?? anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    // Read the actual error body from the Edge Function
    let errorDetail = '';
    try {
      const errorBody = await resp.text();
      errorDetail = errorBody.slice(0, 500);
    } catch {
      errorDetail = `HTTP ${resp.status}`;
    }
    throw new Error(`Edge function "${functionName}" failed (${resp.status}): ${errorDetail}`);
  }

  const data = await resp.json();

  if (data?.error) {
    throw new Error(`Edge function "${functionName}": ${data.error}`);
  }

  return data as T;
}
