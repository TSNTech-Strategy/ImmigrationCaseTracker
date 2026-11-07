import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { CasesTabs, CourtGuide } from "@/components/my-cases-ui";

export const metadata: Metadata = { title: "Immigration court · CasePingo" };

/** My cases → Immigration court: EOIR's own tools. CasePingo never checks court cases or keeps A-Numbers. */
export default async function CourtCasesPage() {
  const user = await requireUser("/cases/court");
  const es = user.locale === "es";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
      <CasesTabs current="court" es={es} />
      <CourtGuide es={es} />
    </>
  );
}
