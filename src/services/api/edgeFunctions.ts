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

  // Get a fresh session token for auth (refreshes if expired)
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token;
  // If no token or it might be stale, try refreshing
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed?.session?.access_token;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token ?? anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Edge function "${functionName}" timed out after 120s`);
    }
    throw err;
  }
  clearTimeout(timeout);

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

/**
 * Fetch an image from a URL and return it as a data URL.
 * Used to pull Storage URLs into client-side canvas operations.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
