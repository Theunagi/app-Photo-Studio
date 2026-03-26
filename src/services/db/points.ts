/**
 * Points system — tracks user credits for generation.
 * Uses Supabase user_profiles table with atomic point deduction via RPC.
 */

import { supabase } from './supabase';

// --- Plans & Costs ---

export const PLANS = [
  { id: 'starter', name: 'Starter', price: 9.90, points: 100, features: ['100 credits / month', '~33 images 2K', '2K Resolution', 'All pipeline steps'] },
  { id: 'pro', name: 'Pro', price: 19.90, points: 200, features: ['200 credits / month', '~66 images 2K', '2K + 4K Resolution', 'All pipeline steps', 'Priority support'] },
  { id: 'business', name: 'Business', price: 49.90, points: 500, features: ['500 credits / month', '~166 images 2K', '2K + 4K Resolution', 'All pipeline steps', 'Priority support', 'Custom branding'] },
] as const;

/** Plan hierarchy for upgrade/downgrade logic */
export const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, business: 3 };
export function getPlanRank(planId: string): number { return PLAN_RANK[planId] ?? 0; }

export const GENERATION_COST: Record<string, number> = {
  '2K': 3,
  '4K': 4,
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
      .insert({ id: user.id, points_balance: 2, plan: 'free' })
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
 * Uses deduct_my_points which uses auth.uid() internally (no IDOR).
 */
export async function deductPoints(amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('deduct_my_points', {
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

/**
 * Refresh profile from server (call after purchase to get updated credits).
 * Uses the get_my_profile RPC for a clean server-side read.
 */
export async function refreshProfile(): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('get_my_profile');

  if (error || !data) {
    // Fallback to direct query
    return getOrCreateProfile();
  }

  return data as UserProfile;
}

/**
 * Get plan credits for a given plan ID.
 */
export function getCreditsForPlan(planId: string): number {
  const plan = PLANS.find(p => p.id === planId);
  return plan?.points ?? 0;
}

/**
 * Provision credits after a successful purchase.
 * Calls the secure provision-credits Edge Function which:
 *  1. Verifies the JWT
 *  2. Checks RevenueCat API for active subscription
 *  3. Maps product → credits server-side
 *  4. Updates DB with service_role
 *
 * The frontend CANNOT set arbitrary credit amounts.
 */
export async function provisionCredits(_planId: string): Promise<UserProfile> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-credits`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Provision credits: ${result.error ?? 'Unknown error'}`);
  }

  import.meta.env.DEV && console.log(`[Points] Provisioned ${result.credits} credits for plan "${result.plan}"`);

  // Return updated profile
  return refreshProfile();
}
