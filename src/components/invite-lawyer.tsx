import { SITE } from "@/lib/site";

/**
 * "Does your lawyer use CasePingo?" A plain email the person sends their own lawyer, inviting the
 * firm to CasePingo Pro. It carries no case details (no receipt number, no status), only a link to
 * the firm plans, tagged so we can count how many firms arrive this way.
 */
export function inviteLawyerMailto(es: boolean, siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${SITE.domain}`): string {
  const link = `${siteUrl.replace(/\/$/, "")}/pricing?ref=client-invite#firms`;
  const subject = es ? "¿Podría usar CasePingo para mi caso?" : "Could you use CasePingo for my case?";
  const body = es
    ? `Hola:\n\nUso CasePingo para seguir el estado de mi caso con USCIS. También tiene una versión para despachos de abogados (CasePingo Pro) que revisa los casos de todos sus clientes automáticamente y nos avisa de los cambios. Quizás le sea útil:\n\n${link}\n\nGracias.`
    : `Hi,\n\nI use CasePingo to follow my USCIS case. It also has a version for law firms (CasePingo Pro) that checks all your clients' cases automatically and keeps clients updated. It might be useful to you:\n\n${link}\n\nThank you.`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function InviteLawyerCard({ es }: { es: boolean }) {
  return (
    <a
      href={inviteLawyerMailto(es)}
      className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
    >
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0zM8 21h8" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="font-semibold">{es ? "¿Su abogado usa CasePingo?" : "Does your lawyer use CasePingo?"}</span>
          <span className="text-sm text-[var(--muted)]">
            {es
              ? "Invítelo: con CasePingo Pro su despacho le avisa de cada cambio. El correo no incluye datos de su caso."
              : "Invite them: with CasePingo Pro, their office keeps you updated on every change. The email includes no case details."}
          </span>
        </span>
      </span>
      <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </a>
  );
}
