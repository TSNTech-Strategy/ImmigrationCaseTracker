import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { Text } from "react-native";

/** One icon: an SF Symbol on iPhone, a Material Symbol on Android and the web. */
export function Icon({ ios, md, size = 20, color, fallback }: { ios: SFSymbol; md: AndroidSymbol; size?: number; color: string; fallback?: string }) {
  return (
    <SymbolView
      name={{ ios, android: md, web: md }}
      size={size}
      tintColor={color}
      fallback={fallback ? <Text style={{ color, fontSize: size * 0.9, lineHeight: size * 1.1 }}>{fallback}</Text> : null}
    />
  );
}
