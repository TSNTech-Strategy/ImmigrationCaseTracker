import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, type TextInputInstance, View } from "react-native";
import { Segmented } from "../../../components/feature";
import { Banner, Button, Card, Field, Screen, Small } from "../../../components/ui";
import { confirm } from "../../../lib/confirm";
import { useAuth } from "../../../lib/auth";
import { autoSlash, hearingDate, loadCourtCases, parseTime, parseUsDate, removeCourtCase, saveCourtCase, validANumber } from "../../../lib/court-cases";
import { font, radius, space, useTheme } from "../../../lib/theme";

/** The 9 boxes of an A-Number (3-3-3), typed into one hidden field. */
function ANumberBoxes({ value, onChange, label, error }: { value: string; onChange: (v: string) => void; label: string; error?: boolean }) {
  const { c } = useTheme();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
        <Text style={[font.mono, { fontSize: 20, fontWeight: "800", color: c.heading, marginRight: 2 }]}>A</Text>
        {Array.from({ length: 9 }, (_, i) => {
          const active = focused && (i === value.length || (i === 8 && value.length === 9));
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 50,
                borderRadius: radius.sm + 2,
                borderWidth: active ? 2 : StyleSheet.hairlineWidth * 2,
                borderColor: error ? c.danger : active ? c.accent : c.border,
                backgroundColor: c.surface2,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: i === 3 || i === 6 ? space(2) : 0,
              }}
            >
              <Text style={[font.mono, { fontSize: 20, fontWeight: "700", color: c.heading }]}>{value[i] ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 9))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="none"
        autoComplete="off"
        maxLength={9}
        caretHidden
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.011, color: "transparent" }}
      />
    </Pressable>
  );
}

/** Add or edit an immigration court case (kept on this phone only), with reminders before the hearing. */
export default function CourtCaseForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [aNumber, setANumber] = useState("");
  const [court, setCourt] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [half, setHalf] = useState<"AM" | "PM">("AM");
  const [error, setError] = useState<{ field: "a" | "date" | "time"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    loadCourtCases().then((list) => {
      const cs = list.find((x) => x.id === id);
      if (!cs) return;
      setANumber(cs.aNumber);
      setCourt(cs.court ?? "");
      if (cs.hearingAt) {
        const d = hearingDate(cs.hearingAt);
        setDate(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`);
        const h = d.getHours();
        setTime(`${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`);
        setHalf(h >= 12 ? "PM" : "AM");
      }
    });
  }, [id, isNew]);

  async function save() {
    if (!validANumber(aNumber)) return setError({ field: "a", message: t.courtErrANumber });
    let hearingAt: string | null = null;
    if (date.trim()) {
      const day = parseUsDate(date);
      if (!day) return setError({ field: "date", message: t.courtErrDate });
      const hm = time.trim() ? parseTime(time, half) : "09:00";
      if (!hm) return setError({ field: "time", message: t.courtErrTime });
      hearingAt = `${day}T${hm}`;
      if (hearingDate(hearingAt).getTime() < Date.now() - 12 * 3_600_000) return setError({ field: "date", message: t.courtErrPast });
    }
    setError(null);
    setBusy(true);
    try {
      await saveCourtCase({ id: isNew ? undefined : id, aNumber, court: court.trim() || null, hearingAt }, lang);
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t.courtFormTitle }} />
      <Card>
        <Text style={{ fontSize: 22, fontWeight: "900", color: c.heading }}>EOIR</Text>
        <Text style={{ fontSize: 15, fontWeight: "700", color: c.heading }}>{t.courtANumber}</Text>
        <ANumberBoxes
          value={aNumber}
          onChange={(v) => {
            setANumber(v);
            if (error?.field === "a") setError(null);
          }}
          label={t.courtANumber}
          error={error?.field === "a"}
        />
        <Small>{t.courtANumberHint}</Small>
        {error?.field === "a" && <Text style={{ color: c.danger, fontWeight: "600" }}>{error.message}</Text>}
      </Card>

      <Card>
        <Field label={t.courtCourt} value={court} onChangeText={setCourt} placeholder={t.courtCourtPh} maxLength={80} />
        <Text style={{ fontSize: 15, fontWeight: "700", color: c.heading, marginTop: space(1) }}>{t.courtHearing}</Text>
        <View style={{ flexDirection: "row", gap: space(3) }}>
          <View style={{ flex: 1.3, minWidth: 0 }}>
            <Field
              label={t.courtDate}
              value={date}
              onChangeText={(v) => {
                setDate(autoSlash(v));
                if (error?.field === "date") setError(null);
              }}
              placeholder="MM/DD/YYYY"
              keyboardType="number-pad"
              maxLength={10}
              error={error?.field === "date" ? error.message : undefined}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field
              label={t.courtTime}
              value={time}
              onChangeText={(v) => {
                setTime(v);
                if (error?.field === "time") setError(null);
              }} placeholder="9:00" keyboardType="numbers-and-punctuation" maxLength={5} error={error?.field === "time" ? error.message : undefined} />
          </View>
        </View>
        <Segmented
          label={t.courtTime}
          value={half}
          onChange={setHalf}
          options={[
            { value: "AM", label: "AM" },
            { value: "PM", label: "PM" },
          ]}
        />
      </Card>

      <Banner tone="info">{t.courtPrivacy}</Banner>
      <Button title={t.courtSave} onPress={save} loading={busy} />
      {!isNew && (
        <Button
          title={t.courtRemove}
          variant="danger"
          onPress={async () => {
            if (!(await confirm(t.courtRemoveConfirm, t.remove, t.cancel))) return;
            await removeCourtCase(id);
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
