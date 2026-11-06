import { Platform, useColorScheme } from "react-native";

/** Same tokens as the website (src/app/globals.css). */
const light = {
  background: "#F5F7FB",
  surface: "#FFFFFF",
  surface2: "#EEF2F8",
  border: "#DCE3EE",
  text: "#0F1B2D",
  heading: "#0A2345",
  muted: "#56637A",
  accent: "#1758A8",
  accentPressed: "#10478C",
  accentSoft: "#E6EFFB",
  onAccent: "#FFFFFF",
  brandRed: "#E43B53",
  danger: "#B42318",
  dangerSoft: "#FDECEA",
  success: "#1E7A43",
  successSoft: "#E7F5EC",
  /** Status kinds, same as the website's --st-* tokens. */
  st: {
    progress: { fg: "#1758A8", bg: "#E6EFFB" },
    action: { fg: "#9A5B00", bg: "#FDF1DC" },
    done: { fg: "#1E7A43", bg: "#E7F5EC" },
    stop: { fg: "#B42318", bg: "#FDECEA" },
    none: { fg: "#56637A", bg: "#EEF2F8" },
  },
  /** Celebration stars: brand red and blue. */
  stars: ["#E43B53", "#1758A8", "#5B8FD9"],
};
const dark: typeof light = {
  background: "#0A1220",
  surface: "#111B2E",
  surface2: "#0E1727",
  border: "#23324B",
  text: "#E7EDF6",
  heading: "#F1F5FB",
  muted: "#9AA9C1",
  accent: "#6EA8FF",
  accentPressed: "#93BFFF",
  accentSoft: "#15284A",
  onAccent: "#07101F",
  brandRed: "#FF6B7D",
  danger: "#F2877D",
  dangerSoft: "#3A1714",
  success: "#6FCF97",
  successSoft: "#11291C",
  st: {
    progress: { fg: "#8DBBFF", bg: "#15284A" },
    action: { fg: "#F5C26B", bg: "#3A2A0C" },
    done: { fg: "#6FCF97", bg: "#11291C" },
    stop: { fg: "#F2877D", bg: "#3A1714" },
    none: { fg: "#9AA9C1", bg: "#16223A" },
  },
  stars: ["#FF6B7D", "#6EA8FF", "#FFFFFF"],
};
export type Colors = typeof light;

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { c: isDark ? dark : light, isDark };
}

export const radius = { sm: 8, md: 12, lg: 16 };
export const space = (n: number) => n * 4;
export const font = {
  h1: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.2 },
  body: { fontSize: 16 },
  small: { fontSize: 14 },
  tiny: { fontSize: 12 },
  mono: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
};
