import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Banner, Button, Card, Field, Screen, Small } from "../../../components/ui";
import { LargeHeader } from "../../../components/cases";
import { IconTile, LangSwitch, type Glyph, type Tint } from "../../../components/feature";
import { Icon } from "../../../components/icon";
import { FadeInDown, stagger } from "../../../components/motion";
import { api, ApiError, type Me } from "../../../lib/api";
import { APPEARANCE_CHOICES, setAppearance, useAppearance, type AppearanceChoice } from "../../../lib/appearance";
import { useAuth } from "../../../lib/auth";
import { config } from "../../../lib/config";
import { trialDaysLeft } from "../../../lib/i18n";
import { registerForPush } from "../../../lib/push";
import { useRefreshOnForeground } from "../../../lib/use-refresh";
import { radius, space, useTheme } from "../../../lib/theme";

/** A titled group of rows on one rounded card. */
function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space(2) }}>
      {title && (
        <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted, marginLeft: space(1) }}>
          {title}
        </Text>
      )}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg + 2, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>{children}</View>
      {footer}
    </View>
  );
}

/**
 * One row: tinted icon tile, title and optional text, and a switch or chevron on the right.
 * `below` sits under the title; `wide` goes under the whole row, across the card.
 */
function Row({
  glyph,
  tint,
  title,
  text,
  right,
  below,
  wide,
  onPress,
  first,
  danger,
}: {
  glyph: Glyph;
  tint: Tint;
  title: string;
  text?: string;
  right?: ReactNode;
  below?: ReactNode;
  wide?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
}) {
  const { c } = useTheme();
  const main = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3.5) }}>
      <IconTile glyph={glyph} tint={tint} size={40} />
      <View style={{ flex: 1, gap: space(1.5) }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: danger ? c.danger : c.text }}>{title}</Text>
        {text ? <Text style={{ fontSize: 13, color: c.muted, lineHeight: 18 }}>{text}</Text> : null}
        {below}
      </View>
      {right ?? (onPress ? <Icon ios="chevron.right" md="chevron_right" size={14} color={c.muted} fallback="›" /> : null)}
    </View>
  );
  const body = wide ? (
    <View>
      {main}
      <View style={{ paddingHorizontal: space(4), paddingBottom: space(4), marginTop: -space(1) }}>{wide}</View>
    </View>
  ) : (
    main
  );
  return (
    <>
      {!first && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: space(4) + 40 + space(3) }} />}
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: c.surface2 }}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </>
  );
}

const APPEARANCE_ICONS: Record<AppearanceChoice, Glyph> = {
  auto: { ios: "circle.lefthalf.filled", md: "contrast", fallback: "◐" },
  light: { ios: "sun.max", md: "light_mode", fallback: "☀" },
  dark: { ios: "moon", md: "dark_mode", fallback: "☾" },
};

/** Automatic, Light or Dark, as three tiles. Kept on this phone and applied right away. */
function AppearancePicker() {
  const { t } = useAuth();
  const { c } = useTheme();
  const value = useAppearance();
  const labels: Record<AppearanceChoice, string> = { auto: t.appearanceAuto, light: t.appearanceLight, dark: t.appearanceDark };
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t.appearance} style={{ flexDirection: "row", gap: space(2) }}>
      {APPEARANCE_CHOICES.map((choice) => {
        const on = value === choice;
        const g = APPEARANCE_ICONS[choice];
        return (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={labels[choice]}
            onPress={() => setAppearance(choice)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 64,
              alignItems: "center",
              justifyContent: "center",
              gap: space(1),
              paddingHorizontal: space(1),
              paddingVertical: space(2.5),
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: on ? c.accent : c.border,
              backgroundColor: on ? c.accentSoft : pressed ? c.surface2 : c.surface,
            })}
          >
            <Icon ios={g.ios} md={g.md} size={20} color={on ? c.accent : c.muted} fallback={g.fallback} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 13, fontWeight: "700", color: on ? c.accent : c.text }}>
              {labels[choice]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function initials(name: string | null, email: string) {
  const parts = (name?.trim() || email).split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function Settings() {
  const { t, me, setMe, signOut, refreshMe } = useAuth();
  const { c } = useTheme();
  const [name, setName] = useState(me?.name ?? "");
  const [editingName, setEditingName] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useRefreshOnForeground(refreshMe);
  if (!me) return null;

  async function patch(body: Partial<{ name: string; locale: "en" | "es"; emailOnChange: boolean; pushOnChange: boolean }>) {
    try {
      setMe(await api<Me>("/api/v1/me", { method: "PATCH", body }));
      setNote({ tone: "success", text: t.saved });
    } catch (e) {
      setNote({ tone: "danger", text: e instanceof ApiError ? e.message : String(e) });
    }
  }

  const days = trialDaysLeft(me.plan.trialEndsAt);
  const switchColors = { trackColor: { true: c.accent, false: c.border }, thumbColor: "#FFFFFF" };
  return (
    <Screen tab>
      <LargeHeader title={t.settings} />
      {note && <Banner tone={note.tone}>{note.text}</Banner>}

      <FadeInDown>
        <Card style={{ padding: space(4), gap: space(3) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: c.onAccent, fontSize: 19, fontWeight: "800" }}>{initials(me.name, me.email)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: c.heading }} numberOfLines={1}>
                {me.name || me.email}
              </Text>
              {me.name ? (
                <Text style={{ fontSize: 14, color: c.muted }} numberOfLines={1}>
                  {me.email}
                </Text>
              ) : null}
            </View>
            {!editingName && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.editName}
                onPress={() => {
                  setName(me.name ?? "");
                  setEditingName(true);
                }} hitSlop={8} style={{ padding: space(1) }}>
                <Icon ios="pencil" md="edit" size={18} color={c.accent} fallback="✎" />
              </Pressable>
            )}
          </View>
          {editingName && (
            <View style={{ gap: space(2) }}>
              <Field label={t.name} value={name} onChangeText={setName} autoComplete="name" />
              <View style={{ flexDirection: "row", gap: space(2) }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t.cancel}
                    variant="secondary"
                    onPress={() => {
                      setName(me.name ?? "");
                      setEditingName(false);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t.save}
                    disabled={!name.trim() || name === me.name}
                    onPress={async () => {
                      await patch({ name: name.trim() });
                      setEditingName(false);
                    }}
                  />
                </View>
              </View>
            </View>
          )}
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(1, 80)}>
        <Group title={t.preferences} footer={<Small style={{ marginLeft: space(1) }}>{me.plan.alerts ? t.alertsNote : `${t.freePlan} ${t.alertsNote}`}</Small>}>
          <Row
            first
            glyph={{ ios: "globe", md: "translate", fallback: "文" }}
            tint="blue"
            title={t.language}
            below={
              <View style={{ alignSelf: "flex-start" }}>
                <LangSwitch value={me.locale} onChange={(l) => patch({ locale: l })} />
              </View>
            }
          />
          <Row
            glyph={{ ios: "circle.lefthalf.filled", md: "contrast", fallback: "◐" }}
            tint="navy"
            title={t.appearance}
            text={t.appearanceNote}
            wide={<AppearancePicker />}
          />
          <Row
            glyph={{ ios: "envelope", md: "mail", fallback: "@" }}
            tint="green"
            title={t.emailAlerts}
            right={<Switch value={me.alerts.email} onValueChange={(v) => patch({ emailOnChange: v })} accessibilityLabel={t.emailAlerts} {...switchColors} />}
          />
          <Row
            glyph={{ ios: "bell.badge", md: "notifications_active", fallback: "!" }}
            tint="amber"
            title={t.pushAlerts}
            right={
              <Switch
                value={me.alerts.push}
                accessibilityLabel={t.pushAlerts}
                {...switchColors}
                onValueChange={async (v) => {
                  if (v && Platform.OS !== "web") {
                    const r = await registerForPush();
                    if (r === "denied") {
                      setNote({ tone: "danger", text: t.pushDenied });
                      return;
                    }
                  }
                  await patch({ pushOnChange: v });
                }}
              />
            }
          />
        </Group>
      </FadeInDown>

      <FadeInDown delay={stagger(2, 80)}>
        <Group title={t.plan}>
          <Row
            first
            glyph={{ ios: "star.circle", md: "workspace_premium", fallback: "★" }}
            tint="navy"
            title={me.plan.name}
            text={days > 0 ? t.trialLeft(days) : me.plan.id === "FREE" ? t.freePlan : t.premiumPlan}
          />
        </Group>
      </FadeInDown>

      <FadeInDown delay={stagger(3, 80)}>
        <Group title={t.legal} footer={<Small style={{ marginLeft: space(1) }}>{t.disclaimer}</Small>}>
          <Row first glyph={{ ios: "hand.raised", md: "privacy_tip", fallback: "i" }} tint="blue" title={t.privacy} text={t.openWebsite} onPress={() => WebBrowser.openBrowserAsync(`${config.siteUrl}/privacy`)} />
          <Row glyph={{ ios: "doc.text", md: "description", fallback: "≡" }} tint="navy" title={t.terms} text={t.openWebsite} onPress={() => WebBrowser.openBrowserAsync(`${config.siteUrl}/terms`)} />
        </Group>
      </FadeInDown>

      <FadeInDown delay={stagger(4, 80)}>
        <Group title={t.account}>
          <Row
            first
            glyph={{ ios: "rectangle.portrait.and.arrow.right", md: "logout", fallback: "⇥" }}
            tint="red"
            title={busy === "signout" ? `${t.signOut}…` : t.signOut}
            danger
            onPress={async () => {
              setBusy("signout");
              await signOut();
              router.replace("/welcome");
            }}
          />
        </Group>
      </FadeInDown>

      <Card style={{ borderColor: c.danger }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.danger }}>{t.deleteAccount}</Text>
        <Small muted={false}>{t.deleteConfirm}</Small>
        <Field label={t.deleteType} value={deleteText} onChangeText={setDeleteText} autoCapitalize="characters" autoCorrect={false} />
        <Button
          title={t.deleteAccount}
          variant="danger"
          disabled={deleteText !== "DELETE"}
          loading={busy === "delete"}
          onPress={async () => {
            setBusy("delete");
            try {
              await api("/api/v1/me", { method: "DELETE", body: { confirm: "DELETE" } });
              await signOut();
              router.replace("/welcome");
            } catch (e) {
              setNote({ tone: "danger", text: e instanceof ApiError ? e.message : String(e) });
              setBusy(null);
            }
          }}
        />
      </Card>
      <Small style={{ textAlign: "center" }}>{t.version(Constants.expoConfig?.version ?? "1.0.0")}</Small>
    </Screen>
  );
}
