import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password · CasePingo" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      footer={
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
