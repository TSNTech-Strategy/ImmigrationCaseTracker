"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { billingEnabled, billingService } from "@/lib/billing";
import { createEntitlements } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };
const OFF: FormState = { error: "Paid plans aren't available yet." };
const STRIPE_DOWN: FormState = { error: "We couldn't reach our payment provider. Please try again in a minute." };

/** Go to Stripe Checkout (or the portal, for someone who already pays). */
export async function checkoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (!billingEnabled()) return OFF;
  const kind = formData.get("kind");
  const choice =
    kind === "premium"
      ? { kind: "premium" as const, interval: formData.get("interval") === "year" ? ("year" as const) : ("month" as const) }
      : kind === "firm"
        ? {
            kind: "firm" as const,
            plan: formData.get("plan") === "SOLO" ? ("SOLO" as const) : formData.get("plan") === "PLUS" ? ("PLUS" as const) : ("FIRM" as const),
            interval: formData.get("interval") === "year" ? ("year" as const) : ("month" as const),
          }
        : null;
  if (!choice) return { error: "Choose a plan." };
  let url: string;
  try {
    const r = await billingService().startCheckout(user.id, choice);
    if (!r.ok) return { error: r.error };
    url = r.url;
  } catch (err) {
    console.error("[billing] checkout failed:", (err as Error)?.message);
    return STRIPE_DOWN;
  }
  redirect(url);
}

/** Stripe's customer portal: cancel, change card or plan, invoices. */
export async function portalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (!billingEnabled()) return OFF;
  let url: string;
  try {
    const r = await billingService().openPortal(user.id, formData.get("scope") === "firm" ? "firm" : "user");
    if (!r.ok) return { error: r.error };
    url = r.url;
  } catch (err) {
    console.error("[billing] portal failed:", (err as Error)?.message);
    return STRIPE_DOWN;
  }
  redirect(url);
}

/** Free plan: check this case instead of the one currently checked. */
export async function chooseCheckedCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const caseId = String(formData.get("caseId") ?? "");
  const r = await createEntitlements({ db: prisma }).chooseCheckedCase(user.id, caseId);
  if (!r.ok) return { error: r.error };
  redirect(`/cases/${encodeURIComponent(caseId)}?notice=now-checked`);
}
