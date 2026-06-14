import Stripe from "stripe";
import { env } from "../config/env.js";

export const stripe = new Stripe(env.stripe.secretKey, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

// Create a Stripe Connect Express account for a reader.
export async function createConnectAccount(email: string): Promise<string> {
  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      transfers: { requested: true },
    },
  });
  return account.id;
}

export async function createOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string) {
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return link.url;
}

// Ensure a Stripe Customer exists for a client (for saved top-up payments).
export async function ensureCustomer(email: string, existingId?: string | null): Promise<string> {
  if (existingId) return existingId;
  const customer = await stripe.customers.create({ email });
  return customer.id;
}
