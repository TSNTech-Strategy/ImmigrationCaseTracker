import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Banner, Button, Check, Choice, Field, H2, Screen, Small } from "../../../components/ui";
import { api, ApiError, type AppConfig } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

export default function NewCase() {
  const { t } = useAuth();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [receipt, setReceipt] = useState("");
  const [nickname, setNickname] = useState("");
  const [basis, setBasis] = useState<"SELF" | "AUTHORIZED_BY_APPLICANT">("SELF");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<AppConfig>("/api/v1/config").then(setCfg).catch(() => setError({ message: "We couldn't load the consent wording. Try again." }));
  }, []);

  async function submit() {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ caseId: string }>("/api/v1/cases", {
        method: "POST",
        body: { receipt, nickname: nickname.trim() || null, basis, consent: true, statementVersion: cfg.consent.version },
      });
      router.replace(`/cases/${r.caseId}`);
    } catch (e) {
      setError(e instanceof ApiError ? { message: e.message, field: e.field } : { message: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {error && !error.field && <Banner tone="danger">{error.message}</Banner>}
      <Field
        label={t.receipt}
        value={receipt}
        onChangeText={(v) => setReceipt(v.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="EAC9999103402"
        hint={cfg?.receiptHint}
        error={error?.field === "receipt" ? error.message : undefined}
        maxLength={16}
      />
      <Field label={t.nickname} value={nickname} onChangeText={setNickname} placeholder={t.nicknamePlaceholder} maxLength={60} />
      <H2>{t.whoseCase}</H2>
      {cfg?.consent.options.map((o) => (
        <Choice key={o.basis} selected={basis === o.basis} onPress={() => setBasis(o.basis)} title={o.label} body={o.statement} />
      ))}
      <Check checked={consent} onChange={setConsent} label={t.confirmStatement} />
      {cfg && <Small>{cfg.consent.footnote}</Small>}
      <Button title={busy ? t.adding : t.add} onPress={submit} loading={busy} disabled={!cfg || !receipt.trim() || !consent} />
    </Screen>
  );
}
