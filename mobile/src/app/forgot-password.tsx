import { useState } from "react";
import { Banner, Button, Field, H1, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { config } from "../lib/config";
import { supabase } from "../lib/supabase";

export default function ForgotPassword() {
  const { t } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <H1>{t.resetPassword}</H1>
      {sent ? (
        <Banner tone="success">{t.resetSent}</Banner>
      ) : (
        <>
          <Field label={t.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
          <Button
            title={t.resetPassword}
            loading={busy}
            disabled={!email.trim()}
            onPress={async () => {
              setBusy(true);
              // The reset link opens the website, where the new password is set.
              await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${config.siteUrl}/auth/confirm?next=/reset-password` });
              setBusy(false);
              setSent(true);
            }}
          />
        </>
      )}
    </Screen>
  );
}
