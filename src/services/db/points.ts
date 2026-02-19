/**
 * Points system — tracks user credits for generation.
 * Uses Supabase user_profiles table with atomic point deduction via RPC.
 */

import { supabase } from './supabase';

// --- Plans & Costs ---

export const PLANS = [
  { id: 'starter', name: 'Starter', price: 9.90, points: 70, features: ['70 credits', '~35 images 2K', '~23 images 4K', 'All pipeline steps'] },
  { id: 'pro', name: 'Pro', price: 19.90, points: 180, features: ['180 credits', '~90 images 2K', '~60 images 4K', 'All pipeline steps', 'Priority support'] },
  { id: 'business', name: 'Business', price: 39.90, points: 420, features: ['420 credits', '~210 images 2K', '~140 images 4K', 'All pipeline steps', 'Priority support', 'Custom branding'] },
] as const;

export const GENERATION_COST: Record<string, number> = {
  '2K': 2,
  '4K': 3,
};

// --- Profile ---

export interface UserProfile {
  id: string;
  points_balance: number;
  plan: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
}

export async function getOrCreateProfile(): Promise<UserProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (data) return data as UserProfile;

  // Profile not found — create one (5 free credits)
  if (error?.code === 'PGRST116') {
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({ id: user.id, points_balance: 5, plan: 'free' })
      .select()
      .single();
    if (insertError) throw new Error(`Create profile: ${insertError.message}`);
    return newProfile as UserProfile;
  }

  throw new Error(`Get profile: ${error?.message}`);
}

export async function getPointsBalance(): Promise<number> {
  const profile = await getOrCreateProfile();
  return profile.points_balance;
}

/**
 * Atomically deduct points. Returns new balance.
 * Throws if insufficient points.
 */
export async function deductPoints(amount: number): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('deduct_points', {
    user_id_input: user.id,
    amount_input: amount,
  });

  if (error) {
    if (error.message.includes('Insufficient')) throw new Error('Crédits insuffisants');
    throw new Error(`Deduct points: ${error.message}`);
  }

  return data as number;
}

export async function hasEnoughPoints(amount: number): Promise<boolean> {
  const balance = await getPointsBalance();
  return balance >= amount;
}
