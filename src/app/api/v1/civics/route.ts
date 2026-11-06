import { CIVICS_LINKS, CIVICS_TEXT, CIVICS_VERSIONS, civicsTest, CURRENT, DEFAULT_VERSION, PRACTICE_PASS_SHARE } from "@/lib/civics";
import { respond } from "@/lib/mobile";

/** Civics test practice for the app (public, no sign-in): both official lists, the rules and the links. */
export function GET() {
  return respond({
    status: 200,
    body: {
      defaultVersion: DEFAULT_VERSION,
      currentAsOf: CURRENT.asOf,
      practicePassShare: PRACTICE_PASS_SHARE,
      text: CIVICS_TEXT,
      links: CIVICS_LINKS,
      versions: CIVICS_VERSIONS.map((v) => civicsTest(v)),
    },
  });
}
