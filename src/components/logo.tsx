import Link from "next/link";

/**
 * CasePingo logo: the app mark plus the two-tone wordmark (brand kit v1).
 * The wordmark is live text so it stays crisp and adapts to dark mode
 * ("Case" uses the page's foreground colour, "Pingo" the brand red).
 */
export function Logo({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const text = size === "sm" ? "text-base" : "text-lg";
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label="CasePingo home">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG mark */}
      <img src="/brand/casepingo-mark.svg" alt="" width={32} height={32} className={`${box} rounded-lg`} />
      <span className={`${text} font-extrabold tracking-tight`}>
        <span className="text-[var(--brand-ink)]">Case</span>
        <span className="text-[var(--brand-red)]">Pingo</span>
      </span>
    </Link>
  );
}
