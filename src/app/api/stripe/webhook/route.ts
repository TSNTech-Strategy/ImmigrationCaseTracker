import type Stripe from "stripe";
import { billingEnabled, billingService } from "@/lib/billing";
import { getStripe } from "@/lib/billing/stripe";

/**
 * Stripe webhook. Every request must carry a valid Stripe signature for our
 * STRIPE_WEBHOOK_SECRET; anything else is rejected before touching data.
 * Responses never echo payloads.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!billingEnabled() || !secret) return new Response("Billing is not configured.", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature.", { status: 400 });
  const body = await request.text(); // raw body: required for signature checks

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  try {
    const r = await billingService().handleEvent(event);
    return Response.json({ received: true, duplicate: r.duplicate });
  } catch (err) {
    console.error(`[stripe] ${event.type} ${event.id} failed:`, (err as Error)?.message);
    return new Response("Processing failed; Stripe will retry.", { status: 500 });
  }
}
