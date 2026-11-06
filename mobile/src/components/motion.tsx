import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from "react-native";

/**
 * Entrance motion: content slides down a little into place while it fades in,
 * one item after another (`delay`). Icons can "drop" with a small spring.
 * Plays once when an item first appears; people who turn on Reduce Motion
 * see everything immediately.
 */

const nativeDriver = Platform.OS !== "web";

function useReduceMotion() {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => alive && setReduce(r))
      .catch(() => alive && setReduce(false));
    return () => {
      alive = false;
    };
  }, []);
  return reduce;
}

/** Fades in while moving down from slightly above its place. */
export function FadeInDown({ children, delay = 0, distance = 16, duration = 460, style }: { children: ReactNode; delay?: number; distance?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce === null) return;
    if (reduce) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver });
    anim.start();
    return () => anim.stop();
  }, [reduce, delay, distance, duration, progress]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-distance, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** An icon that drops into its tile with a small bounce. */
export function DropIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReduceMotion();
  const [y] = useState(() => new Animated.Value(-22));
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce === null) return;
    if (reduce) {
      y.setValue(0);
      opacity.setValue(1);
      return;
    }
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: nativeDriver }),
      Animated.spring(y, { toValue: 0, delay, friction: 5, tension: 120, useNativeDriver: nativeDriver }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduce, delay, y, opacity]);
  return <Animated.View style={{ opacity, transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

/** A soft pulse for loading placeholders (opacity 1 → 0.55 → 1). Still with Reduce Motion. */
export function Pulse({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduce !== false) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(opacity, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, opacity]);
  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}

/** Delay for the n-th item of a list, capped so long lists don't wait. */
export const stagger = (index: number, step = 80, start = 0, max = 6) => start + Math.min(index, max) * step;

/**
 * A highlight that walks down a list: -1 while the entrance plays, then 0, 1, 2…
 * every `every` ms, looping. Runs only while the screen is showing.
 * With Reduce Motion on, the first item stays highlighted and nothing moves.
 */
export function useSpotlight(count: number, { every = 2800, startAfter = 1400 }: { every?: number; startAfter?: number } = {}) {
  const reduce = useReduceMotion();
  const [index, setIndex] = useState(-1);
  useFocusEffect(
    useCallback(() => {
      if (reduce !== false || count < 2) return;
      let loop: ReturnType<typeof setInterval> | undefined;
      const start = setTimeout(() => {
        setIndex((i) => (i < 0 ? 0 : (i + 1) % count));
        loop = setInterval(() => setIndex((i) => (i + 1) % count), every);
      }, startAfter);
      return () => {
        clearTimeout(start);
        if (loop) clearInterval(loop);
      };
    }, [reduce, count, every, startAfter]),
  );
  return reduce ? 0 : index;
}

/** 0 → 1 when `active` turns on (and back), eased, for opacity and scale. */
export function useHighlight(active: boolean) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    const anim = Animated.timing(progress, { toValue: active ? 1 : 0, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver });
    anim.start();
    return () => anim.stop();
  }, [active, progress]);
  return progress;
}
