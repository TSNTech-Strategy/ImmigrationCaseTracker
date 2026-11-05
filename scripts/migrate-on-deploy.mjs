// Apply database migrations as part of a build — except a Vercel preview
// (same rule as Scanvio). Previews would share the production database, so a
// migration on an unmerged branch would reach production before review.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "preview") {
  console.log("[migrate] Vercel preview: migrations skipped (they run on the production deploy).");
} else {
  execSync("npx --no-install prisma migrate deploy", { stdio: "inherit" });
}
