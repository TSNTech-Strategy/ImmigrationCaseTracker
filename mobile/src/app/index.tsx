import { Redirect } from "expo-router";
import { Loading } from "../components/ui";
import { useAuth } from "../lib/auth";

/** Start: cases if signed in, the two-factor step if needed, otherwise the welcome screen. */
export default function Index() {
  const { ready, session, needsMfa } = useAuth();
  if (!ready) return <Loading />;
  if (session && needsMfa) return <Redirect href="/mfa" />;
  return <Redirect href={session ? "/cases" : "/welcome"} />;
}
