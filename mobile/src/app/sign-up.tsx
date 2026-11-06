import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Text } from "react-native";
import { Banner, Button, Check, Field, H1, Screen, Small } from "../components/ui";
import { useAuth } from "../lib/auth";
import { config } from "../lib/config";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";

export default function SignUp() {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const passwordProblem =
    password && (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) ? "Use at least 10 characters, with a letter and a number." : undefined;

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${config.siteUrl}/auth/confirm?next=/cases`,
        data: { name: name.trim(), locale: lang, terms_version: "2026-11-05", terms_accepted_at: new Date().toISOString() },
      },
    });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Screen>
        <H1>{t.createAccount}</H1>
        <Banner tone="success">{t.signUpDone}</Banner>
        <Button title={t.signIn} onPress={() => router.replace("/sign-in")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>{t.createAccount}</H1>
      {error && <Banner tone="danger">{error}</Banner>}
      <Field label={t.name} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <Field label={t.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
      <Field label={t.password} value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" error={passwordProblem} hint="At least 10 characters, with a letter and a number." />
      <Check checked={agree} onChange={setAgree} label={t.agreeTerms} />
      <Text style={{ color: c.accent, fontWeight: "600" }} onPress={() => WebBrowser.openBrowserAsync(`${config.siteUrl}/terms`)}>
        {t.terms}
      </Text>
      <Text style={{ color: c.accent, fontWeight: "600" }} onPress={() => WebBrowser.openBrowserAsync(`${config.siteUrl}/privacy`)}>
        {t.privacy}
      </Text>
      <Button title={t.createAccount} onPress={submit} loading={busy} disabled={!name.trim() || !email.trim() || !password || Boolean(passwordProblem) || !agree} />
      <Small style={{ textAlign: "center" }}>{t.disclaimer}</Small>
    </Screen>
  );
}
