import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { receiptFrame, type Rect, type Size } from "../lib/receipt-frame";
import { readFramedPhoto, type ScanResult } from "../lib/scan";
import { font, radius, space, useTheme } from "../lib/theme";
import { Icon } from "./icon";
import { Button, Small } from "./ui";

/** Shade outside the frame, and the frame's corner brackets: blue, so they show on white paper and on the shade. */
const DIM = "rgba(3, 8, 18, 0.58)";
const BRACKET = "#3D8BFF";
const CORNER = 26;
const STROKE = 4;
const FRAME_RADIUS = 12;
/** Format example shown under the camera (3 letters and 10 numbers). */
const EXAMPLE = "IOE0123456789";

function Corners({ frame }: { frame: Rect }) {
  const { x, y, width, height } = frame;
  const base = { position: "absolute" as const, width: CORNER, height: CORNER, borderColor: BRACKET };
  return (
    <>
      <View style={[base, { left: x, top: y, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: FRAME_RADIUS }]} />
      <View style={[base, { left: x + width - CORNER, top: y, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: FRAME_RADIUS }]} />
      <View style={[base, { left: x, top: y + height - CORNER, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: FRAME_RADIUS }]} />
      <View style={[base, { left: x + width - CORNER, top: y + height - CORNER, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: FRAME_RADIUS }]} />
    </>
  );
}

/** Everything drawn over the live picture: the shade, the frame, its label and hint. */
function FrameOverlay({ box, frame, reading }: { box: Size; frame: Rect; reading: boolean }) {
  const { t } = useAuth();
  const { x, y, width, height } = frame;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: y, backgroundColor: DIM }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: y + height, bottom: 0, backgroundColor: DIM }} />
      <View style={{ position: "absolute", left: 0, top: y, width: x, height, backgroundColor: DIM }} />
      <View style={{ position: "absolute", left: x + width, top: y, width: box.width - x - width, height, backgroundColor: DIM }} />
      <Text style={{ position: "absolute", left: x + 2, top: y - 26, color: "#FFFFFF", fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" }}>
        {t.scanFrameLabel}
      </Text>
      <View style={{ position: "absolute", left: x, top: y, width, height, borderRadius: FRAME_RADIUS, borderWidth: 1.5, borderColor: "rgba(61, 139, 255, 0.6)" }} />
      <Corners frame={frame} />
      {reading && (
        <View style={{ position: "absolute", left: x, top: y, width, height, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3, 8, 18, 0.35)", borderRadius: FRAME_RADIUS }}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
      <View style={{ position: "absolute", left: 0, right: 0, top: y + height + 14, alignItems: "center" }}>
        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600", backgroundColor: "rgba(0, 0, 0, 0.35)", paddingHorizontal: space(3), paddingVertical: space(1), borderRadius: 999, overflow: "hidden" }}>
          {reading ? t.scanReading : t.scanFrameHint}
        </Text>
      </View>
    </View>
  );
}

/** "Where is my receipt number?": opens to a short explanation. */
function WhereIsIt() {
  const { t } = useAuth();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        aria-expanded={open}
        accessibilityLabel={t.scanWhereTitle}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space(2), paddingHorizontal: space(4), minHeight: 48, backgroundColor: pressed ? c.surface2 : "transparent" })}
      >
        <Icon ios="questionmark.circle" md="help" size={18} color={c.accent} fallback="?" />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: c.text }}>{t.scanWhereTitle}</Text>
        <Icon ios={open ? "chevron.up" : "chevron.down"} md={open ? "expand_less" : "expand_more"} size={14} color={c.muted} fallback={open ? "˄" : "˅"} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: space(4), paddingBottom: space(4) }}>
          <Text style={{ fontSize: 14, lineHeight: 20, color: c.text }}>{t.scanWhereBody}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The Scan tab of Add a case: a live camera with a frame for the receipt number,
 * like a document scanner focused on one line. "Take photo" reads only what's in
 * the frame (then the whole photo if needed), on the phone; nothing is uploaded.
 */
export function ReceiptCamera({ onResult, onChoosePhoto, choosing }: { onResult: (r: ScanResult) => void; onChoosePhoto: () => void; choosing: boolean }) {
  const { t } = useAuth();
  const { c } = useTheme();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [box, setBox] = useState<Size | null>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [reading, setReading] = useState(false);
  const granted = Boolean(permission?.granted);
  const frame = box ? receiptFrame(box) : null;

  // Some cameras never say they're ready: allow a photo after a moment anyway.
  useEffect(() => {
    if (!granted) return;
    const timer = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(timer);
  }, [granted]);

  async function takePhoto() {
    const cam = camera.current;
    if (!cam || !box || !frame || reading) return;
    setReading(true);
    try {
      const photo = await cam.takePictureAsync({ quality: 0.9, exif: false, base64: false });
      if (!photo?.uri) {
        onResult({ kind: "failed" });
        return;
      }
      // Hold the picture still while it's read.
      cam.pausePreview().catch(() => {});
      onResult(await readFramedPhoto(photo, box, frame));
    } catch {
      onResult({ kind: "failed" });
    } finally {
      setReading(false);
      camera.current?.resumePreview().catch(() => {});
    }
  }

  return (
    <View style={{ gap: space(3) }}>
      <View
        onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        style={{ width: "100%", aspectRatio: 1, borderRadius: radius.lg + 4, overflow: "hidden", backgroundColor: "#05080F" }}
      >
        {granted && focused && (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />
        )}
        {granted && box && frame && <FrameOverlay box={box} frame={frame} reading={reading} />}
        {granted && Platform.OS !== "web" && (
          <Pressable
            accessibilityRole="switch"
            aria-checked={torch}
            accessibilityLabel={t.scanTorch}
            onPress={() => setTorch((v) => !v)}
            hitSlop={8}
            style={{ position: "absolute", top: space(3), right: space(3), width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: torch ? "#FFFFFF" : "rgba(0, 0, 0, 0.45)" }}
          >
            <Icon ios={torch ? "bolt.fill" : "bolt.slash.fill"} md={torch ? "flash_on" : "flash_off"} size={18} color={torch ? "#0A1220" : "#FFFFFF"} fallback="ϟ" />
          </Pressable>
        )}
        {permission && !granted && (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", padding: space(6), gap: space(4) }]}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255, 255, 255, 0.12)", alignItems: "center", justifyContent: "center" }}>
              <Icon ios="camera" md="photo_camera" size={26} color="#FFFFFF" fallback="◉" />
            </View>
            <Text style={{ color: "#FFFFFF", textAlign: "center", fontSize: 15, lineHeight: 21 }}>{permission.canAskAgain ? t.scanCameraWhy : t.scanCameraOff}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: space(5), borderRadius: 999, justifyContent: "center", backgroundColor: pressed ? "#DCE3EE" : "#FFFFFF" })}
            >
              <Text style={{ color: "#0A1220", fontWeight: "700", fontSize: 15 }}>{permission.canAskAgain ? t.scanAllowCamera : t.scanOpenSettings}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space(2), rowGap: space(1) }}>
        <Text style={{ fontSize: 14, color: c.muted }}>{t.scanLookFor}:</Text>
        <Text style={{ fontSize: 14, fontWeight: "700", color: c.heading }}>Receipt Number</Text>
        <View style={{ paddingHorizontal: space(1.5), paddingVertical: 2, borderRadius: 6, backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border }}>
          <Text style={[font.mono, { fontSize: 13, color: c.text }]}>{EXAMPLE}</Text>
        </View>
      </View>

      {granted && (
        <Button
          title={reading ? t.scanReading : t.scanTakePhoto}
          onPress={takePhoto}
          loading={reading}
          disabled={!ready || choosing}
          icon={{ ios: "camera", md: "photo_camera", fallback: "◉" }}
        />
      )}
      <Button
        title={choosing ? t.scanReading : t.scanChooseInstead}
        variant="secondary"
        onPress={onChoosePhoto}
        loading={choosing}
        disabled={reading}
        icon={{ ios: "photo.on.rectangle", md: "photo_library", fallback: "▤" }}
      />
      <WhereIsIt />
      <Small>{t.scanPrivacy}</Small>
    </View>
  );
}
