import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { COUNTRIES } from "@/lib/firms/profile";
import { CreateClientForm } from "../forms";

export const metadata: Metadata = { title: "New client · CasePingo" };

export default async function NewClientPage() {
  const user = await requireUser("/firm/clients/new");
  if (!(await firmService().getContext(user.id))) redirect("/firm");
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <Link href="/firm/clients" className="text-sm font-medium text-[var(--accent)] hover:underline">
        ← Clients
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New client</h1>
        <p className="text-sm text-[var(--muted)]">Add clients before their receipts arrive, then link cases as USCIS notices come in. Only your firm sees these details.</p>
      </div>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <CreateClientForm countries={COUNTRIES} />
      </section>
    </div>
  );
}
