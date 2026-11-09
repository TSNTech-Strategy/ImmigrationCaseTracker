import { FEATURES } from "@/lib/features";

/**
 * The outside companies that process customer data for CasePingo. One list feeds the public
 * Subprocessors page, the Data Processing Agreement and the Privacy Policy, so they never disagree.
 * When a provider is added or its role changes: update this list and `SUBPROCESSORS_UPDATED`,
 * and (per the DPA) email firm Owners at least 30 days before a new one starts receiving data.
 */

export type Subprocessor = {
  name: string;
  entity: string;
  purpose: string;
  data: string;
  location: string;
  /** Who it touches: everyone, law firms only, or the mobile app only. */
  scope: "All customers" | "Law firms" | "Mobile app" | "Paying customers";
  /** Off by default; listed so the change doesn't need a new notice. */
  active: boolean;
  url: string;
};

export const SUBPROCESSORS_UPDATED = "November 9, 2026";

export function subprocessors(): Subprocessor[] {
  return [
    {
      name: "Vercel",
      entity: "Vercel Inc.",
      purpose: "Website and API hosting",
      data: "All data the service handles passes through its servers while a page or request is processed",
      location: "United States (Washington, D.C. region)",
      scope: "All customers",
      active: true,
      url: "https://vercel.com/legal/privacy-policy",
    },
    {
      name: "Supabase",
      entity: "Supabase, Inc.",
      purpose: "Database, sign-in and encrypted file storage",
      data: "Accounts, cases and status history, firm clients and their profiles, tasks, deadlines, documents (encrypted before storage)",
      location: "United States",
      scope: "All customers",
      active: true,
      url: "https://supabase.com/privacy",
    },
    {
      name: "Inngest",
      entity: "Inngest, Inc.",
      purpose: "Scheduling background work (status checks, reminders, deletions)",
      data: "Record identifiers only (for example a case ID); no names, receipt numbers or documents",
      location: "United States",
      scope: "All customers",
      active: true,
      url: "https://www.inngest.com/privacy",
    },
    {
      name: "Resend",
      entity: "Plus Five Five, Inc. (Resend)",
      purpose: "Sending email: sign-in, alerts, client status updates and document requests",
      data: "Recipient email address and the message (names, masked receipt numbers, status text, upload links)",
      location: "United States",
      scope: "All customers",
      active: true,
      url: "https://resend.com/legal/privacy-policy",
    },
    {
      name: "Stripe",
      entity: "Stripe, Inc.",
      purpose: "Subscription billing and payments",
      data: "Payer name, email, billing address and tax ID; card details go to Stripe directly and never reach CasePingo",
      location: "United States",
      scope: "Paying customers",
      active: true,
      url: "https://stripe.com/privacy",
    },
    {
      name: "Cloudmersive",
      entity: "Cloudmersive, LLC",
      purpose: "Checking uploaded files for viruses and malware before they're stored",
      data: "The uploaded file and its name, for the time it takes to scan it",
      location: "United States",
      scope: "Law firms",
      active: true,
      url: "https://cloudmersive.com/privacy-policy",
    },
    {
      name: "Expo",
      entity: "650 Industries, Inc. (Expo)",
      purpose: "Delivering phone alerts from the mobile app",
      data: "The phone's push token and the alert (case nickname or masked receipt number, new status)",
      location: "United States",
      scope: "Mobile app",
      active: true,
      url: "https://expo.dev/privacy",
    },
    {
      name: "Apple and Google push services",
      entity: "Apple Inc. (APNs) and Google LLC (Firebase Cloud Messaging)",
      purpose: "Showing those alerts on iPhone and Android phones",
      data: "The push token and the alert text",
      location: "United States",
      scope: "Mobile app",
      active: true,
      url: "https://www.apple.com/legal/privacy/",
    },
    {
      name: "Anthropic",
      entity: "Anthropic, PBC",
      purpose: "The AI model behind the optional assistant",
      data: "Questions typed into the assistant and, when asked from a case, its form type and status text",
      location: "United States",
      scope: "All customers",
      active: FEATURES.assistant,
      url: "https://www.anthropic.com/legal/privacy",
    },
  ];
}
