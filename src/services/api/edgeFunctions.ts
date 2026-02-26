/**
 * Edge Function Caller
 * Central module for calling Supabase Edge Functions.
 * Replaces all direct API calls to external services.
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Cannot call edge functions.');
  }

  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    throw new Error(`Edge function "${functionName}" failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`Edge function "${functionName}": ${data.error}`);
  }

  return data as T;
}
