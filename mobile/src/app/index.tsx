import { Redirect } from "expo-router";
import { Loading } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useLaunchHidden } from "../lib/launch";

/** Start: cases if signed in, the two-factor step if needed, otherwise the welcome screen. */
export default function Index() {
  const { ready, session, needsMfa } = useAuth();
  const launchHidden = useLaunchHidden();
  // The launch screen covers this; a spinner only if starting takes unusually long.
  if (!ready) return launchHidden ? <Loading /> : null;
  if (session && needsMfa) return <Redirect href="/mfa" />;
  return <Redirect href={session ? "/cases" : "/welcome"} />;
}
