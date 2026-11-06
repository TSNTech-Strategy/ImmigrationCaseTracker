import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Segmented } from "../../../components/feature";
import { ReceiptCamera } from "../../../components/receipt-camera";
import { Banner, Button, Check, Choice, Field, H2, Screen, Small } from "../../../components/ui";
import { api, ApiError, type AppConfig } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { canScanReceipts, scanLibraryPhoto, type ScanResult } from "../../../lib/scan";

export default function NewCase() {
  const { t } = useAuth();
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  // Type the number, or Scan it with the camera ("Scan your receipt notice" opens straight on Scan).
  const [mode, setMode] = useState<"type" | "scan">(scan === "camera" && canScanReceipts ? "scan" : "type");
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [receipt, setReceipt] = useState("");
  const [nickname, setNickname] = useState("");
  const [basis, setBasis] = useState<"SELF" | "AUTHORIZED_BY_APPLICANT">("SELF");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
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
  const showResult = useCallback(
    (r: ScanResult, source: "camera" | "library") => {
      if (r.kind === "found") {
        setMode("type");
        if (r.receipts.length === 1) pickReceipt(r.receipts[0]);
        else {
          setChoices(r.receipts.slice(0, 4));
          setScanNote({ tone: "info", text: t.scanMany });
        }
      } else if (r.kind === "none") setScanNote({ tone: "info", text: source === "camera" ? t.scanNoneFrame : t.scanNone });
      else if (r.kind === "failed") setScanNote({ tone: "info", text: t.scanFailed });
    },
    [t, pickReceipt],
  );

  async function choosePhoto() {
    setChoosing(true);
    setScanNote(null);
    setChoices([]);
    setError(null);
    const r = await scanLibraryPhoto();
    setChoosing(false);
    showResult(r, "library");
  }

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
      {canScanReceipts && (
        <Segmented
          label={t.addModeLabel}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setScanNote(null);
          }}
          options={[
            { value: "type", label: t.addTypeTab, glyph: { ios: "keyboard", md: "keyboard", fallback: "⌨" } },
            { value: "scan", label: t.addScanTab, glyph: { ios: "camera.viewfinder", md: "document_scanner", fallback: "▣" } },
          ]}
        />
      )}
      {error && !error.field && <Banner tone="danger">{error.message}</Banner>}
      {mode === "scan" ? (
        <>
          {scanNote && <Banner tone={scanNote.tone}>{scanNote.text}</Banner>}
          <ReceiptCamera
            onResult={(r) => {
              setScanNote(null);
              showResult(r, "camera");
            }}
            onChoosePhoto={choosePhoto}
            choosing={choosing}
          />
        </>
      ) : (
        <>
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
        </>
      )}
    </Screen>
  );
}
