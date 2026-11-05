import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { requireUser } from "@/lib/auth/session";
import { ResetForm } from "./reset-form";

// Depends on the signed-in user / request, so it renders per request
// (Cache Components: allowed to block instead of prerendering a shell).
export const instant = false;

export const metadata: Metadata = { title: "Set a new password · CasePingo" };

// Reached from the emailed reset link, which signs the user in first.
export default async function ResetPasswordPage() {
  await requireUser("/reset-password");
  return (
    <AuthShell title="Set a new password">
      <ResetForm />
    </AuthShell>
  );
}
