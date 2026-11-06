import { router } from "expo-router";
import { useState } from "react";
import { Banner, Body, Button, Field, H1, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { registerForPush } from "../lib/push";
import { supabase } from "../lib/supabase";

export default function Mfa() {
  const { t, checkMfa, refreshMe, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setError(null);
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.[0];
    if (!factor) {
      setBusy(false);
      setError("No authenticator is set up for this account.");
      return;
    }
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (e) {
      setBusy(false);
      setError("That code didn't work. Check the time on your phone and try again.");
      return;
    }
    await checkMfa();
    await refreshMe();
    registerForPush().catch(() => {});
    setBusy(false);
    router.replace("/cases");
  }

  return (
    <Screen>
      <H1>{t.twoFactorTitle}</H1>
      <Body muted>{t.twoFactorBody}</Body>
      {error && <Banner tone="danger">{error}</Banner>}
      <Field label={t.code} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
      <Button title={t.verify} onPress={verify} loading={busy} disabled={code.trim().length !== 6} />
      <Button
        title={t.signOut}
        variant="secondary"
        onPress={async () => {
          await signOut();
          router.replace("/welcome");
        }}
      />
    </Screen>
  );
}
