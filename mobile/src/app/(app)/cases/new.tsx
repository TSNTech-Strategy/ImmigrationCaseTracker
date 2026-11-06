import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Banner, Button, Card, Check, Choice, Field, H2, Screen, Small } from "../../../components/ui";
import { api, ApiError, type AppConfig } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { canScanReceipts, scanReceipt } from "../../../lib/scan";
import { space } from "../../../lib/theme";

export default function NewCase() {
  const { t } = useAuth();
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [receipt, setReceipt] = useState("");
  const [nickname, setNickname] = useState("");
  const [basis, setBasis] = useState<"SELF" | "AUTHORIZED_BY_APPLICANT">("SELF");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState<"camera" | "library" | null>(null);
  const [scanNote, setScanNote] = useState<{ tone: "success" | "info"; text: string } | null>(null);
  const [choices, setChoices] = useState<string[]>([]);

  useEffect(() => {
    api<AppConfig>("/api/v1/config").then(setCfg).catch(() => setError({ message: "We couldn't load the consent wording. Try again." }));
  }, []);

  const pickReceipt = useCallback(
    (value: string) => {
      setReceipt(value);
      setChoices([]);
      setScanNote({ tone: "success", text: t.scanFound(value) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    [t],
  );

  // Photo → text on the phone → receipt number in the field. The person still
  // checks the number and confirms the consent statement before it's added.
  const runScan = useCallback(
    async (source: "camera" | "library") => {
      setScanning(source);
      setScanNote(null);
      setChoices([]);
      setError(null);
      const r = await scanReceipt(source);
      setScanning(null);
      if (r.kind === "found" && r.receipts.length === 1) pickReceipt(r.receipts[0]);
      else if (r.kind === "found") {
        setChoices(r.receipts.slice(0, 4));
        setScanNote({ tone: "info", text: t.scanMany });
      } else if (r.kind === "none") setScanNote({ tone: "info", text: t.scanNone });
      else if (r.kind === "denied") setScanNote({ tone: "info", text: t.scanNoCamera });
      else if (r.kind === "failed") setScanNote({ tone: "info", text: t.scanFailed });
    },
    [t, pickReceipt],
  );

  // Opened from "Scan your receipt notice": go to the camera once this screen has slid in.
  const autoScan = useRef(scan === "camera" && canScanReceipts);
  useEffect(() => {
    if (!autoScan.current) return;
    autoScan.current = false;
    const timer = setTimeout(() => runScan("camera"), 450);
    return () => clearTimeout(timer);
  }, [runScan]);

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
      {canScanReceipts && (
        <Card style={{ padding: space(4), gap: space(3) }}>
          <View style={{ gap: space(1) }}>
            <H2>{t.scanTitle}</H2>
            <Small>{t.scanBody}</Small>
          </View>
          <Button
            title={scanning === "camera" ? t.scanReading : t.scanCamera}
            onPress={() => runScan("camera")}
            loading={scanning === "camera"}
            disabled={scanning !== null}
            icon={{ ios: "camera.viewfinder", md: "document_scanner", fallback: "▣" }}
          />
          <Button
            title={scanning === "library" ? t.scanReading : t.scanLibrary}
            variant="secondary"
            onPress={() => runScan("library")}
            loading={scanning === "library"}
            disabled={scanning !== null}
            icon={{ ios: "photo.on.rectangle", md: "photo_library", fallback: "▤" }}
          />
        </Card>
      )}
      {scanNote && <Banner tone={scanNote.tone}>{scanNote.text}</Banner>}
      {choices.map((value) => (
        <Choice key={value} selected={receipt === value} onPress={() => pickReceipt(value)} title={value} />
      ))}
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
