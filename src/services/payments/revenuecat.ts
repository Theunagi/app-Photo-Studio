/**
 * RevenueCat Web Billing integration.
 * Uses @revenuecat/purchases-js to handle Stripe subscriptions.
 *
 * Flow: configure → getOfferings → purchase(package) → credit points
 */

import { Purchases } from '@revenuecat/purchases-js';
import type { Offerings, Package, CustomerInfo } from '@revenuecat/purchases-js';

let purchasesInstance: Purchases | null = null;

/**
 * Initialize RevenueCat with the user's Supabase ID.
 * Call once after login.
 */
export function initRevenueCat(appUserId: string): Purchases {
  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY;
  if (!apiKey) throw new Error('VITE_REVENUECAT_API_KEY not set');

  purchasesInstance = Purchases.configure({
    apiKey,
    appUserId,
  });

  return purchasesInstance;
}

function getInstance(): Purchases {
  if (!purchasesInstance) throw new Error('RevenueCat not initialized');
  return purchasesInstance;
}

/**
 * Fetch available offerings (subscription plans).
 */
export async function fetchOfferings(): Promise<Offerings> {
  return getInstance().getOfferings();
}

/**
 * Get the current customer info (entitlements, active subscriptions).
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return getInstance().getCustomerInfo();
}

/**
 * Purchase a package. RevenueCat renders a Stripe Elements form
 * in the provided HTML element.
 *
 * @param rcPackage - The package to purchase (from offerings)
 * @param htmlTarget - DOM element where the payment form will render
 * @param customerEmail - Pre-fill the email field
 */
export async function purchasePackage(
  rcPackage: Package,
  htmlTarget: HTMLElement,
  customerEmail?: string,
): Promise<CustomerInfo> {
  const result = await getInstance().purchase({
    rcPackage,
    htmlTarget,
    customerEmail,
    selectedLocale: 'fr',
  });
  return result.customerInfo;
}

/**
 * Check if user has an active entitlement (subscription).
 */
export async function getActiveEntitlement(): Promise<string | null> {
  const info = await getCustomerInfo();
  const active = info.entitlements.active;

  // Check known entitlement IDs (configure these in RevenueCat dashboard)
  for (const id of ['business', 'pro', 'starter']) {
    if (active[id]?.isActive) return id;
  }
  return null;
}

/**
 * Check if RevenueCat is configured.
 */
export function isRevenueCatConfigured(): boolean {
  return !!import.meta.env.VITE_REVENUECAT_API_KEY;
}
