import { Link, router } from "expo-router";
import { useState } from "react";
import { Banner, Button, Field, H1, Screen, Small } from "../components/ui";
import { useAuth } from "../lib/auth";
import { registerForPush } from "../lib/push";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";

export default function SignIn() {
  const { t, checkMfa, refreshMe } = useAuth();
  const { c } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (e) {
      setBusy(false);
      setError(e.message.includes("confirm") ? "Please confirm your email first. Check your inbox for our link." : "That email and password don't match. Try again.");
      return;
    }
    if (await checkMfa()) {
      setBusy(false);
      router.replace("/mfa");
      return;
    }
    await refreshMe();
    registerForPush().catch(() => {});
    setBusy(false);
    router.replace("/cases");
  }

  return (
    <Screen>
      <H1>{t.signIn}</H1>
      {error && <Banner tone="danger">{error}</Banner>}
      <Field label={t.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
      <Field label={t.password} value={password} onChangeText={setPassword} secure autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <Button title={t.signIn} onPress={submit} loading={busy} disabled={!email || !password} />
      <Link href="/forgot-password" style={{ color: c.accent, fontWeight: "600", textAlign: "center" }}>
        {t.forgotPassword}
      </Link>
      <Small style={{ textAlign: "center" }}>{t.disclaimer}</Small>
    </Screen>
  );
}
