/**
 * The daily USCIS sandbox run, published: runs the smoke test and, only when
 * every check passed, commits the new evidence lines, pushes, opens a pull
 * request to main and merges it (casepingo.com then deploys).
 *
 *   npm run uscis:smoke:publish                  # smoke test with --with-auth-error
 *   npm run uscis:smoke:publish -- --show-errors # extra flags go to the smoke test
 *   npm run uscis:smoke:publish -- --skip-if-done  # no-op when today's evidence is on main
 *
 * Only docs/uscis-evidence/ is staged; other local changes are left alone.
 * The PR is merged only when it contains nothing but evidence — if the branch
 * also carries unmerged code (another session's work), the PR is opened and
 * left for review, so an evidence run never ships unreviewed features.
 */
import { execFileSync, spawnSync } from "node:child_process";

const EVIDENCE_DIR = "docs/uscis-evidence/";

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const fail = (message: string): never => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};

const centralDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch === "main" || branch === "HEAD") fail(`Run this from your working branch, not "${branch}".`);

// --skip-if-done (used by the scheduled runs): today's evidence is already on main.
const args = process.argv.slice(2);
if (args.includes("--skip-if-done")) {
  run("git", ["fetch", "--quiet", "origin", "main"]);
  const done = run("git", ["log", "origin/main", "--oneline", "--fixed-strings", `--grep=USCIS sandbox evidence: ${centralDate}`]);
  if (done) {
    console.log(`✔ Evidence for ${centralDate} is already on main; nothing to do.`);
    process.exit(0);
  }
}

// 1. The smoke test itself (it appends to the evidence log either way).
const smokeArgs = ["--with-auth-error", ...args.filter((a) => a !== "--with-auth-error" && a !== "--skip-if-done")];
const smoke = spawnSync("npx", ["tsx", "--env-file=.env", "scripts/uscis-smoke.ts", ...smokeArgs], { stdio: "inherit" });
if (smoke.status !== 0) fail("Smoke test didn't pass, so nothing was committed or merged. The evidence lines are in your working tree.");

// 2. Commit only the evidence log.
const changed = run("git", ["status", "--porcelain", "--", EVIDENCE_DIR]);
if (!changed) fail("Smoke test passed but the evidence log didn't change.");
run("git", ["add", "--", EVIDENCE_DIR]);
run("git", ["commit", "-m", `USCIS sandbox evidence: ${centralDate}`, "-m", "All smoke checks passed (npm run uscis:smoke:publish).", "--", EVIDENCE_DIR]);
console.log(`\n✔ Committed evidence for ${centralDate}`);

// 3. Push on top of whatever else is on the branch.
run("git", ["pull", "--rebase", "--autostash", "--quiet"]);
run("git", ["push", "--quiet"]);
console.log(`✔ Pushed ${branch}`);

// 4. Open (or reuse) the PR to main.
run("git", ["fetch", "--quiet", "origin", "main"]);
const files = run("git", ["diff", "--name-only", "origin/main...HEAD"]).split("\n").filter(Boolean);
const open = JSON.parse(run("gh", ["pr", "list", "--head", branch, "--base", "main", "--state", "open", "--json", "number,url"])) as { number: number; url: string }[];
const evidenceOnly = files.length > 0 && files.every((f) => f.startsWith(EVIDENCE_DIR));
const url = open[0]?.url ??
  run("gh", [
    "pr", "create", "--base", "main", "--head", branch,
    "--title", evidenceOnly ? `USCIS sandbox evidence: ${centralDate}` : `${branch} (includes USCIS sandbox evidence: ${centralDate})`,
    "--body", `Daily USCIS sandbox smoke test: all checks passed. Evidence appended to \`${EVIDENCE_DIR}\`.\n\nOpened by \`npm run uscis:smoke:publish\`.`,
  ]);
console.log(`✔ Pull request: ${url}`);

// 5. Merge — but only an evidence-only PR.
if (!evidenceOnly) {
  const code = files.filter((f) => !f.startsWith(EVIDENCE_DIR));
  console.log(`\n⚠ Not merged: the branch also has unmerged changes outside ${EVIDENCE_DIR} (${code.length} files, e.g. ${code.slice(0, 3).join(", ")}).`);
  console.log("  Review and merge that PR yourself; the evidence goes in with it.");
  process.exit(0);
}
run("gh", ["pr", "merge", url, "--merge"]);
console.log("✔ Merged into main. casepingo.com will deploy it.");
