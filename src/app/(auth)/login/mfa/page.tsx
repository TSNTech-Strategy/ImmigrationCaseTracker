import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSessionState } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/paths";
import { signOutAction } from "../../actions";
import { MfaForm } from "./mfa-form";

export const instant = false;
export const metadata: Metadata = { title: "Two-factor sign-in · CasePingo" };

export default async function MfaPage({ searchParams }: PageProps<"/login/mfa">) {
  const { next } = await searchParams;
  const s = await getSessionState();
  if (s.state === "none") redirect("/login");
  if (s.state === "ok") redirect(safeNextPath(next));
  return (
    <AuthShell
      title="Enter your code"
      footer={
        <form action={signOutAction}>
          <button type="submit" className="underline underline-offset-2">
            Use a different account
          </button>
        </form>
      }
    >
      <MfaForm next={typeof next === "string" ? next : undefined} />
    </AuthShell>
  );
}
