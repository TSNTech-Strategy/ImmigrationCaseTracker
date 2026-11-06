import { useEffect, useState, type ReactNode } from "react";
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

/** Delay for the n-th item of a list, capped so long lists don't wait. */
export const stagger = (index: number, step = 80, start = 0, max = 6) => start + Math.min(index, max) * step;
