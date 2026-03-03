/**
 * Secure credit provisioning Edge Function.
 *
 * Flow:
 *  1. Verify JWT (user is authenticated)
 *  2. Call RevenueCat API to verify the user has an active entitlement
 *  3. Map the product to credits
 *  4. Provision credits via service_role (not callable from frontend directly)
 *
 * This replaces the insecure provision_my_credits RPC that could be called
 * from the browser console with arbitrary credit amounts.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';

// Plan ID → credits mapping (single source of truth, server-side)
const PLAN_CREDITS: Record<string, { credits: number; products: string[] }> = {
  starter:  { credits: 70,  products: ['starter_v2'] },
  pro:      { credits: 180, products: ['pro_v2'] },
  business: { credits: 420, products: ['business_v2'] },
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // 1. Verify JWT
    const { userId } = await verifyAuth(req);

    // 2. Call RevenueCat API to verify active entitlements
    const rcApiKey = Deno.env.get('REVENUECAT_API_KEY');
    if (!rcApiKey) throw new Error('REVENUECAT_API_KEY not configured');

    const rcResponse = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${userId}`,
      { headers: { Authorization: `Bearer ${rcApiKey}` } }
    );

    if (!rcResponse.ok) {
      throw new Error(`RevenueCat API error: ${rcResponse.status}`);
    }

    const rcData = await rcResponse.json();
    const subscriptions = rcData.subscriber?.subscriptions ?? {};
    const entitlements = rcData.subscriber?.entitlements ?? {};

    // 3. Find the active subscription and map to plan
    let activePlan: string | null = null;
    let activeCredits = 0;

    for (const [planId, config] of Object.entries(PLAN_CREDITS)) {
      for (const productId of config.products) {
        const sub = subscriptions[productId];
        if (sub) {
          const expiresDate = new Date(sub.expires_date);
          if (expiresDate > new Date() && !sub.refunded_at) {
            activePlan = planId;
            activeCredits = config.credits;
            break;
          }
        }
      }
      if (activePlan) break;
    }

    // Also check entitlements as fallback
    if (!activePlan) {
      for (const [, entitlement] of Object.entries(entitlements)) {
        const ent = entitlement as { expires_date: string; product_identifier: string };
        const expiresDate = new Date(ent.expires_date);
        if (expiresDate > new Date()) {
          for (const [planId, config] of Object.entries(PLAN_CREDITS)) {
            if (config.products.includes(ent.product_identifier)) {
              activePlan = planId;
              activeCredits = config.credits;
              break;
            }
          }
        }
        if (activePlan) break;
      }
    }

    if (!activePlan || activeCredits === 0) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 4. Provision credits using service_role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch current profile to determine upgrade vs renewal
    const { data: currentProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('points_balance, plan')
      .eq('id', userId)
      .single();

    const currentPlan = currentProfile?.plan ?? 'free';
    const currentBalance = currentProfile?.points_balance ?? 0;

    // Determine if this is an UPGRADE (different plan) or RENEWAL (same plan)
    // Upgrade: cumulate existing balance + new plan credits
    // Renewal (same plan, monthly reset): reset to plan credits
    const isUpgrade = currentPlan !== activePlan && currentPlan !== 'free';
    const newBalance = isUpgrade
      ? currentBalance + activeCredits  // Cumulate on upgrade
      : activeCredits;                  // Reset on renewal or first subscription

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ points_balance: newBalance, plan: activePlan })
      .eq('id', userId)
      .select('points_balance, plan')
      .single();

    if (error) throw new Error(`DB update failed: ${error.message}`);

    // 5. Log the provisioning event
    await supabaseAdmin.from('payment_events').insert({
      user_id: userId,
      event_type: 'credits_provisioned',
      metadata: {
        plan: activePlan,
        previousPlan: currentPlan,
        credits: activeCredits,
        previousBalance: currentBalance,
        newBalance,
        isUpgrade,
        source: 'revenuecat_verified',
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        plan: activePlan,
        credits: activeCredits,
        balance: data.points_balance,
        isUpgrade,
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('auth') || message.includes('Auth') ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
