export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">ImmigrationCaseTracker</h1>
      <p className="text-lg leading-relaxed">
        An independent service for individuals, families and immigration law firms to follow authorized USCIS
        case statuses in one place.
      </p>
      <p className="text-sm leading-relaxed opacity-80">
        ImmigrationCaseTracker is not affiliated with or endorsed by USCIS or the Department of Homeland
        Security, and does not provide legal advice. USCIS is the authoritative source for case status.
      </p>
      <p className="text-sm opacity-60">Under construction.</p>
    </main>
  );
}
