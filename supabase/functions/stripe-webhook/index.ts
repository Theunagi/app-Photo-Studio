/**
 * Stripe Webhook Handler — Supabase Edge Function
 *
 * Listens for Stripe events to:
 * - Provision credits on subscription creation/renewal (invoice.paid)
 * - Update user plan on subscription changes
 * - Revoke access on subscription cancellation
 *
 * Setup:
 *   1. Set STRIPE_WEBHOOK_SECRET via: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *   2. Set STRIPE_SECRET_KEY via: supabase secrets set STRIPE_SECRET_KEY=sk_...
 *   3. In Stripe Dashboard → Webhooks, point to:
 *      https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 *   4. Subscribe to events: invoice.paid, customer.subscription.updated,
 *      customer.subscription.deleted, checkout.session.completed
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

// --- Plan configuration (must match frontend PLANS in points.ts) ---

const PLAN_CREDITS: Record<string, number> = {
  starter: 70,
  pro: 180,
  business: 420,
};

/** Map Stripe Price IDs or Product names to our plan IDs.
 *  Update these after creating products in Stripe Dashboard. */
function resolvePlanId(priceId: string, productName?: string): string {
  // Try to match by product name (case-insensitive)
  const name = (productName ?? '').toLowerCase();
  if (name.includes('business') || name.includes('lifetime')) return 'business';
  if (name.includes('pro') || name.includes('annual')) return 'pro';
  if (name.includes('starter') || name.includes('monthly')) return 'starter';

  // Fallback: check price ID patterns (configure these with your actual Stripe price IDs)
  const priceLower = priceId.toLowerCase();
  if (priceLower.includes('business')) return 'business';
  if (priceLower.includes('pro')) return 'pro';
  return 'starter';
}

// --- Stripe signature verification ---

async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    return await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
  }
}

// --- Supabase admin client (bypasses RLS) ---

function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// --- Event handlers ---

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = getAdminClient();
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) {
    console.warn('[Webhook] invoice.paid: no customer ID');
    return;
  }

  // Get subscription details to determine plan
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  let planId = 'starter';
  let productName = '';

  // Try to resolve plan from invoice line items
  const lineItems = invoice.lines?.data ?? [];
  if (lineItems.length > 0) {
    const priceId = lineItems[0].price?.id ?? '';
    productName = lineItems[0].description ?? '';
    planId = resolvePlanId(priceId, productName);
  }

  const credits = PLAN_CREDITS[planId] ?? PLAN_CREDITS.starter;

  console.log(`[Webhook] invoice.paid: customer=${customerId}, plan=${planId}, credits=${credits}`);

  // Find user by stripe_customer_id
  const { data: profile, error: findError } = await supabase
    .from('user_profiles')
    .select('id, points_balance, plan')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError || !profile) {
    // Try finding by metadata (RevenueCat stores app_user_id in customer metadata)
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      console.warn('[Webhook] Customer deleted, skipping');
      return;
    }

    const appUserId = customer.metadata?.app_user_id ?? customer.metadata?.rc_app_user_id;
    if (!appUserId) {
      console.warn(`[Webhook] Cannot find user for customer ${customerId}`);
      return;
    }

    // Update by Supabase user ID
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        points_balance: credits, // Reset to plan credits (monthly renewal)
        plan: planId,
        stripe_customer_id: customerId,
        current_period_end: invoice.lines?.data?.[0]?.period?.end
          ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
          : null,
      })
      .eq('id', appUserId);

    if (updateError) {
      console.error('[Webhook] Failed to update profile by app_user_id:', updateError);
    } else {
      console.log(`[Webhook] Credits provisioned: ${credits} for user ${appUserId}`);
    }

    // Log the payment event
    await logPaymentEvent(supabase, appUserId, 'invoice.paid', {
      customerId, planId, credits, invoiceId: invoice.id,
    });
    return;
  }

  // Update existing profile
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      points_balance: credits, // Reset to plan credits
      plan: planId,
      current_period_end: invoice.lines?.data?.[0]?.period?.end
        ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
        : null,
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error('[Webhook] Failed to update profile:', updateError);
  } else {
    console.log(`[Webhook] Credits provisioned: ${credits} for user ${profile.id}`);
  }

  await logPaymentEvent(supabase, profile.id, 'invoice.paid', {
    customerId, planId, credits, invoiceId: invoice.id,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = getAdminClient();
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  const priceId = subscription.items?.data?.[0]?.price?.id ?? '';
  const productName = subscription.items?.data?.[0]?.price?.nickname ?? '';
  const planId = resolvePlanId(priceId, productName);
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  console.log(`[Webhook] subscription.updated: customer=${customerId}, plan=${planId}, status=${subscription.status}`);

  const updates: Record<string, unknown> = {
    plan: planId,
    stripe_customer_id: customerId,
    current_period_end: periodEnd,
  };

  // If subscription is no longer active, downgrade to free
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    updates.plan = 'free';
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('[Webhook] Failed to update subscription:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = getAdminClient();
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  console.log(`[Webhook] subscription.deleted: customer=${customerId}`);

  const { error } = await supabase
    .from('user_profiles')
    .update({
      plan: 'free',
      current_period_end: null,
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('[Webhook] Failed to downgrade user:', error);
  }

  // Find user ID for logging
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    await logPaymentEvent(supabase, profile.id, 'subscription.deleted', {
      customerId, subscriptionId: subscription.id,
    });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const supabase = getAdminClient();
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;

  // client_reference_id is the Supabase user ID (set by frontend)
  const userId = session.client_reference_id;

  if (!customerId || !userId) {
    console.warn('[Webhook] checkout.session.completed: missing customer or user ID');
    return;
  }

  console.log(`[Webhook] checkout.session.completed: user=${userId}, customer=${customerId}`);

  // Link Stripe customer to our user
  const { error } = await supabase
    .from('user_profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);

  if (error) {
    console.error('[Webhook] Failed to link customer:', error);
  }

  await logPaymentEvent(supabase, userId, 'checkout.session.completed', {
    customerId, sessionId: session.id,
  });
}

// --- Payment event logging ---

async function logPaymentEvent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  eventType: string,
  metadata: Record<string, unknown>,
) {
  try {
    await supabase
      .from('payment_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        metadata,
      });
  } catch (err) {
    // Non-critical — just log
    console.warn('[Webhook] Failed to log payment event:', err);
  }
}

// --- Main handler ---

serve(async (req: Request) => {
  // Webhooks are POST only — no CORS needed (Stripe → server)
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    const event = await verifyStripeSignature(body, signature, webhookSecret);

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Webhook] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
