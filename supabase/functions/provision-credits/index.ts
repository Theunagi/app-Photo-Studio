/**
 * Secure credit provisioning Edge Function.
 *
 * Flow:
 *  1. Verify JWT (user is authenticated)
 *  2. Try RevenueCat API to verify active entitlement
 *  3. Fallback: Try Stripe API to verify active subscription
 *  4. Map product → credits server-side
 *  5. Provision credits via service_role (bypasses RLS)
 *
 * This replaces the insecure provision_my_credits RPC.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

// Plan ID → credits mapping (single source of truth, server-side)
const PLAN_CREDITS: Record<string, { credits: number; products: string[] }> = {
  starter:  { credits: 100, products: ['starter_v2', 'starter'] },
  pro:      { credits: 200, products: ['pro_v2', 'pro'] },
  business: { credits: 500, products: ['business_v2', 'business'] },
};

// Price amount (cents) → plan mapping for Stripe fallback
const PRICE_TO_PLAN: Record<number, string> = {
  990: 'starter',   // 9.90€
  1990: 'pro',      // 19.90€
  4990: 'business', // 49.90€
};

/** Resolve plan from Stripe price amount or product name */
function resolvePlanFromStripe(amountInCents?: number, productName?: string): string | null {
  if (amountInCents && PRICE_TO_PLAN[amountInCents]) {
    return PRICE_TO_PLAN[amountInCents];
  }
  const name = (productName ?? '').toLowerCase();
  if (name.includes('business') || name.includes('lifetime')) return 'business';
  if (name.includes('pro') || name.includes('annual')) return 'pro';
  if (name.includes('starter') || name.includes('monthly')) return 'starter';
  return null;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // 1. Verify JWT
    const { userId } = await verifyAuth(req);
    console.log(`[provision-credits] User: ${userId}`);

    let activePlan: string | null = null;
    let activeCredits = 0;
    let verificationSource = 'none';

    // ── Strategy 1: RevenueCat API ───────────────────────────────────────
    const rcApiKey = Deno.env.get('REVENUECAT_API_KEY');
    if (rcApiKey) {
      try {
        console.log('[provision-credits] Trying RevenueCat verification...');
        const rcResponse = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${userId}`,
          { headers: { Authorization: `Bearer ${rcApiKey}` } }
        );

        if (rcResponse.ok) {
          const rcData = await rcResponse.json();
          const subscriptions = rcData.subscriber?.subscriptions ?? {};
          const entitlements = rcData.subscriber?.entitlements ?? {};

          console.log('[provision-credits] RC subscriptions:', JSON.stringify(Object.keys(subscriptions)));
          console.log('[provision-credits] RC entitlements:', JSON.stringify(Object.keys(entitlements)));

          // Check subscriptions
          for (const [planId, config] of Object.entries(PLAN_CREDITS)) {
            for (const productId of config.products) {
              const sub = subscriptions[productId];
              if (sub) {
                const expiresDate = new Date(sub.expires_date);
                if (expiresDate > new Date() && !sub.refunded_at) {
                  activePlan = planId;
                  activeCredits = config.credits;
                  verificationSource = 'revenuecat_subscription';
                  break;
                }
              }
            }
            if (activePlan) break;
          }

          // Check entitlements as fallback
          if (!activePlan) {
            for (const [entKey, entitlement] of Object.entries(entitlements)) {
              const ent = entitlement as { expires_date?: string; product_identifier?: string };
              const expiresDate = ent.expires_date ? new Date(ent.expires_date) : null;
              if (expiresDate && expiresDate > new Date()) {
                // Try matching product identifier
                for (const [planId, config] of Object.entries(PLAN_CREDITS)) {
                  if (ent.product_identifier && config.products.includes(ent.product_identifier)) {
                    activePlan = planId;
                    activeCredits = config.credits;
                    verificationSource = 'revenuecat_entitlement';
                    break;
                  }
                }
                // If no product match, try entitlement key name (use PLAN_CREDITS as source of truth)
                if (!activePlan) {
                  const keyLower = entKey.toLowerCase();
                  if (keyLower.includes('business')) { activePlan = 'business'; activeCredits = PLAN_CREDITS.business.credits; }
                  else if (keyLower.includes('pro')) { activePlan = 'pro'; activeCredits = PLAN_CREDITS.pro.credits; }
                  else if (keyLower.includes('starter')) { activePlan = 'starter'; activeCredits = PLAN_CREDITS.starter.credits; }
                  if (activePlan) verificationSource = 'revenuecat_entitlement_key';
                }
              }
              if (activePlan) break;
            }
          }

          // Last RC fallback: if any active entitlement exists, use the highest plan
          if (!activePlan && Object.keys(entitlements).length > 0) {
            // User has entitlements but we couldn't match — default to checking by active status
            for (const [, entitlement] of Object.entries(entitlements)) {
              const ent = entitlement as { expires_date?: string; is_active?: boolean };
              if (ent.is_active || (ent.expires_date && new Date(ent.expires_date) > new Date())) {
                // Can't determine plan precisely — will try Stripe
                console.log('[provision-credits] RC has active entitlement but no plan match');
                break;
              }
            }
          }
        } else {
          console.warn(`[provision-credits] RevenueCat API returned ${rcResponse.status}`);
          const errBody = await rcResponse.text().catch(() => '');
          console.warn(`[provision-credits] RC error body: ${errBody.slice(0, 200)}`);
        }
      } catch (rcErr) {
        console.warn('[provision-credits] RevenueCat check failed:', rcErr);
      }
    }

    // ── Strategy 2: Stripe API fallback ──────────────────────────────────
    if (!activePlan) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (stripeKey) {
        try {
          console.log('[provision-credits] Trying Stripe verification...');
          const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
          });

          // Search for customer by email or metadata
          const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );

          // Get user email from Supabase auth
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
          const userEmail = user?.email;

          if (userEmail) {
            // Search Stripe customers by email
            const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
            const customer = customers.data[0];

            if (customer) {
              console.log(`[provision-credits] Found Stripe customer: ${customer.id}`);

              // Update stripe_customer_id in profile
              await supabaseAdmin
                .from('user_profiles')
                .update({ stripe_customer_id: customer.id })
                .eq('id', userId);

              // Check active subscriptions
              const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'active',
                limit: 5,
              });

              for (const sub of subscriptions.data) {
                const item = sub.items.data[0];
                if (item) {
                  const amount = item.price?.unit_amount ?? 0;
                  const productName = item.price?.nickname ?? '';
                  const plan = resolvePlanFromStripe(amount, productName);

                  if (plan) {
                    activePlan = plan;
                    activeCredits = PLAN_CREDITS[plan].credits;
                    verificationSource = 'stripe_subscription';
                    console.log(`[provision-credits] Stripe match: plan=${plan}, amount=${amount}`);
                    break;
                  }
                }
              }

              // Also check recent successful payments (for one-time purchases)
              if (!activePlan) {
                const charges = await stripe.charges.list({
                  customer: customer.id,
                  limit: 5,
                });

                for (const charge of charges.data) {
                  if (charge.paid && !charge.refunded) {
                    const plan = resolvePlanFromStripe(charge.amount);
                    if (plan) {
                      activePlan = plan;
                      activeCredits = PLAN_CREDITS[plan].credits;
                      verificationSource = 'stripe_charge';
                      console.log(`[provision-credits] Stripe charge match: plan=${plan}, amount=${charge.amount}`);
                      break;
                    }
                  }
                }
              }
            } else {
              console.warn(`[provision-credits] No Stripe customer found for email: ${userEmail}`);
            }
          }
        } catch (stripeErr) {
          console.error('[provision-credits] Stripe check failed:', stripeErr);
        }
      }
    }

    // ── No plan found ────────────────────────────────────────────────────
    if (!activePlan || activeCredits === 0) {
      console.error(`[provision-credits] No active subscription found for user ${userId}`);
      return new Response(
        JSON.stringify({ error: 'No active subscription found. Please contact support.' }),
        { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Provision credits ─────────────────────────────────────────────
    console.log(`[provision-credits] Provisioning: plan=${activePlan}, credits=${activeCredits}, source=${verificationSource}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get current plan to detect upgrade
    const { data: currentProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    const currentPlan = currentProfile?.plan ?? 'free';
    const isUpgrade = currentPlan !== activePlan && currentPlan !== 'free';

    // Atomic provision via RPC (row-locked, no race condition)
    const { data: result, error } = await supabaseAdmin.rpc('provision_credits_atomic', {
      p_user_id: userId,
      p_plan: activePlan,
      p_credits: activeCredits,
      p_is_upgrade: isUpgrade,
    });

    if (error) throw new Error(`Atomic provision failed: ${error.message}`);

    const row = Array.isArray(result) ? result[0] : result;

    // Log the provisioning event
    await supabaseAdmin.from('payment_events').insert({
      user_id: userId,
      event_type: 'credits_provisioned',
      metadata: {
        plan: activePlan,
        previousPlan: row.previous_plan,
        credits: activeCredits,
        previousBalance: row.previous_balance,
        newBalance: row.new_balance,
        isUpgrade,
        source: verificationSource,
      },
    });

    console.log(`[provision-credits] Success: plan=${activePlan}, balance=${row.new_balance}, upgrade=${isUpgrade}`);

    return new Response(
      JSON.stringify({
        success: true,
        plan: activePlan,
        credits: activeCredits,
        balance: row.new_balance,
        isUpgrade,
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[provision-credits] Error:', message);
    const status = message.includes('auth') || message.includes('Auth') ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
