import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { extractTextFromImage, isSupported } from "expo-text-extractor";
import { Platform } from "react-native";
import { findReceiptNumbers } from "./receipt-scan";

/**
 * Scan a USCIS receipt notice: take a photo (or choose one), read its text on the
 * phone (Apple Vision on iPhone, Google ML Kit on Android) and find the receipt
 * number. The photo is never uploaded, and our copy is deleted straight after.
 */

/** True where the phone can read text from a photo (iPhone and Android, not the web preview). */
export const canScanReceipts = Platform.OS !== "web" && isSupported;

export type ScanResult =
  | { kind: "found"; receipts: string[] }
  | { kind: "none" }
  | { kind: "cancelled" }
  | { kind: "denied" }
  | { kind: "failed" };

export async function scanReceipt(source: "camera" | "library"): Promise<ScanResult> {
  if (!canScanReceipts) return { kind: "failed" };
  try {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { kind: "denied" };
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false, base64: false, allowsEditing: false };
    const picked = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const uri = picked.canceled ? null : picked.assets?.[0]?.uri;
    if (!uri) return { kind: "cancelled" };
    try {
      const receipts = findReceiptNumbers(await extractTextFromImage(uri));
      return receipts.length ? { kind: "found", receipts } : { kind: "none" };
    } finally {
      // The picker's copy lives in our cache: delete it. Never touch anything else
      // (a photo chosen from the library stays in the library).
      try {
        if (uri.startsWith(Paths.cache.uri)) new File(uri).delete();
      } catch {
        // Already gone.
      }
    }
  } catch {
    return { kind: "failed" };
  }
}
