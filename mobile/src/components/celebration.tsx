import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { radius, space, useTheme } from "../lib/theme";
import { Body, H2, Small } from "./ui";

/**
 * The approval moment: a short burst of red and blue stars, a success
 * vibration, and a written congratulations.
 *
 * - Built on React Native's own Animated (native driver), so no extra
 *   graphics engine ships in the app.
 * - Plays once per case on this phone; skipped when the phone asks for
 *   reduced motion (the written message always shows).
 * - Never blocks touches: the layer ignores them and disappears after ~2.6 s.
 */

const PLAYED_KEY = "casepingo:celebrated";
const DISMISSED_KEY = "casepingo:approval-dismissed";

async function readIds(key: string): Promise<string[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(key)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function addIds(key: string, ids: string[]) {
  try {
    const all = [...new Set([...(await readIds(key)), ...ids])].slice(-200);
    await AsyncStorage.setItem(key, JSON.stringify(all));
  } catch {
    // Storage unavailable: the celebration may simply replay.
  }
}

/** Which of these cases haven't had their burst on this phone yet (and marks them as played). */
export async function takeUnplayed(caseIds: string[]): Promise<string[]> {
  if (caseIds.length === 0) return [];
  const played = await readIds(PLAYED_KEY);
  const fresh = caseIds.filter((id) => !played.includes(id));
  if (fresh.length > 0) await addIds(PLAYED_KEY, fresh);
  return fresh;
}

export const dismissedApprovals = () => readIds(DISMISSED_KEY);
export const dismissApproval = (caseId: string) => addIds(DISMISSED_KEY, [caseId]);

// ---- Star burst ----------------------------------------------------------------

const DURATION_MS = 2600;
const SECONDS = DURATION_MS / 1000;
const GRAVITY = 900; // px/s², pulls stars down
const DRAG = 2.2; // 1/s, slows them like paper in air

type Particle = { x0: number; y0: number; vx: number; vy: number; size: number; color: string; spin: number; delay: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function makeParticles(width: number, height: number, colors: string[]): Particle[] {
  const out: Particle[] = [];
  const pick = () => colors[Math.floor(Math.random() * colors.length)];
  // Two cannons from the bottom corners, aimed up and inward.
  for (const side of [0, 1] as const) {
    for (let i = 0; i < 18; i++) {
      const angle = (side === 0 ? -60 : -120) * (Math.PI / 180) + rand(-0.35, 0.35);
      const speed = rand(850, 1350);
      out.push({ x0: side === 0 ? -10 : width + 10, y0: height * 0.82, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: rand(14, 26), color: pick(), spin: rand(-540, 540), delay: rand(0.01, 0.16) });
    }
  }
  // One burst from the middle.
  for (let i = 0; i < 30; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(280, 720);
    out.push({ x0: width / 2, y0: height * 0.36, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 120, size: rand(16, 30), color: pick(), spin: rand(-360, 360), delay: rand(0.17, 0.22) });
  }
  return out;
}

/** Position after t seconds with gravity and air drag (closed form, so it runs on the native driver). */
function position(p: Particle, t: number) {
  const k = (1 - Math.exp(-DRAG * t)) / DRAG;
  const terminal = GRAVITY / DRAG;
  return { x: p.x0 + p.vx * k, y: p.y0 + (p.vy - terminal) * k + terminal * t };
}

function Star({ p, progress }: { p: Particle; progress: Animated.Value }) {
  const steps = 10;
  const input: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let s = 0; s <= steps; s++) {
    const at = p.delay + ((1 - p.delay) * s) / steps;
    const { x, y } = position(p, (at - p.delay) * SECONDS);
    input.push(at);
    xs.push(x - p.size / 2);
    ys.push(y - p.size / 2);
  }
  const translateX = progress.interpolate({ inputRange: input, outputRange: xs, extrapolate: "clamp" });
  const translateY = progress.interpolate({ inputRange: input, outputRange: ys, extrapolate: "clamp" });
  const opacity = progress.interpolate({ inputRange: [0, p.delay, p.delay + 0.01, 0.72, 1], outputRange: [0, 0, 1, 1, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] });
  return (
    <Animated.Text style={{ position: "absolute", left: 0, top: 0, fontSize: p.size, lineHeight: p.size * 1.15, color: p.color, opacity, transform: [{ translateX }, { translateY }, { rotate }] }}>
      ★
    </Animated.Text>
  );
}

/** Plays the burst each time `playKey` changes to a new non-zero value. */
export function StarBurst({ playKey }: { playKey: number }) {
  const { width, height } = useWindowDimensions();
  const { c } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!playKey) return;
    let cancelled = false;
    (async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (cancelled || reduce) return;
      progress.setValue(0);
      setParticles(makeParticles(width, height, c.stars));
      Animated.timing(progress, { toValue: 1, duration: DURATION_MS, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }).start(() => {
        if (!cancelled) setParticles([]);
      });
    })();
    return () => {
      cancelled = true;
    };
    // Only a new playKey starts a burst; size and theme are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  if (particles.length === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) => (
        <Star key={`${playKey}-${i}`} p={p} progress={progress} />
      ))}
    </View>
  );
}

// ---- Congratulations card ---------------------------------------------------------

export function StarsMark({ size = 40 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Text style={{ position: "absolute", left: 0, top: -size * 0.12, fontSize: size * 0.78, color: c.brandRed }}>★</Text>
      <Text style={{ position: "absolute", left: size * 0.36, top: size * 0.22, fontSize: size * 0.62, color: c.accent }}>★</Text>
    </View>
  );
}

/** A thin red-and-blue stripe across the top of a card. */
export function FlagStripe() {
  const { c } = useTheme();
  return (
    <View style={{ height: 4, flexDirection: "row" }}>
      <View style={{ flex: 1, backgroundColor: c.brandRed }} />
      <View style={{ flex: 1, backgroundColor: c.accent }} />
    </View>
  );
}

export function CongratsCard({
  title,
  body,
  nextStep,
  approvedLine,
  replayLabel,
  onReplay,
}: {
  title: string;
  body: string;
  nextStep: string | null;
  approvedLine: string;
  replayLabel: string;
  onReplay: () => void;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="summary" style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
      <FlagStripe />
      <View style={{ flexDirection: "row", gap: space(3), padding: space(4) }}>
        <StarsMark />
        <View style={{ flex: 1, gap: space(1.5) }}>
          <H2>{title}</H2>
          <Body>{body}</Body>
          {nextStep ? <Small>{nextStep}</Small> : null}
          <Small style={{ fontSize: 12 }}>{approvedLine}</Small>
          <Pressable accessibilityRole="button" onPress={onReplay} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: space(1) }}>
            <Text style={{ color: c.accent, fontWeight: "600", fontSize: 14 }}>{replayLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
