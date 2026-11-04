import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

// Depends on the signed-in user / request, so it renders per request
// (Cache Components: allowed to block instead of prerendering a shell).
export const instant = false;

export const metadata: Metadata = { title: "Sign in · ImmigrationCaseTracker" };

const ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="underline underline-offset-2">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm
        next={typeof next === "string" ? next : undefined}
        initialError={typeof error === "string" ? ERRORS[error] : undefined}
      />
    </AuthShell>
  );
}
