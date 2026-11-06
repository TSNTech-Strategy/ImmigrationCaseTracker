import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { extractTextFromImage, isSupported } from "expo-text-extractor";
import { Platform } from "react-native";
import { frameToPhotoCrop, type Rect, type Size } from "./receipt-frame";
import { findReceiptNumbers } from "./receipt-scan";

/**
 * Scan a USCIS receipt notice: a photo from the in-app camera (framed on the
 * receipt number) or one chosen from the library; its text is read on the phone
 * (Apple Vision on iPhone, Google ML Kit on Android) to find the receipt number.
 * The photo is never uploaded, and our copies are deleted straight after.
 */

/** True where the phone can read text from a photo (iPhone and Android, not the web preview). */
export const canScanReceipts = Platform.OS !== "web" && isSupported;

export type ScanResult = { kind: "found"; receipts: string[] } | { kind: "none" } | { kind: "cancelled" } | { kind: "failed" };

/** Delete a copy we made (the camera's photo, a crop). Only ever inside our own cache. */
function deleteOurCopy(uri: string | null | undefined) {
  if (!uri) return;
  try {
    if (uri.startsWith(Paths.cache.uri)) new File(uri).delete();
  } catch {
    // Already gone.
  }
}

async function readText(uri: string): Promise<string[]> {
  return findReceiptNumbers(await extractTextFromImage(uri));
}

/**
 * A photo from the in-app camera: read only the part inside the receipt-number
 * frame first (sharper and faster, and it skips other numbers on the notice),
 * then the whole photo if the frame missed it. Both copies are deleted after.
 */
export async function readFramedPhoto(photo: { uri: string; width: number; height: number }, box: Size, frame: Rect): Promise<ScanResult> {
  if (!canScanReceipts) return { kind: "failed" };
  try {
    const crop = frameToPhotoCrop(box, frame, photo);
    if (crop) {
      let cropUri: string | null = null;
      try {
        const image = await ImageManipulator.manipulate(photo.uri).crop(crop).renderAsync();
        cropUri = (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 })).uri;
        const receipts = await readText(cropUri);
        if (receipts.length) return { kind: "found", receipts };
      } catch {
        // The crop didn't work out: read the whole photo below.
      } finally {
        deleteOurCopy(cropUri);
      }
    }
    const receipts = await readText(photo.uri);
    return receipts.length ? { kind: "found", receipts } : { kind: "none" };
  } catch {
    return { kind: "failed" };
  } finally {
    deleteOurCopy(photo.uri);
  }
}

/** A photo of the notice chosen from the phone's photos (when the camera can't be used, or it was photographed earlier). */
export async function scanLibraryPhoto(): Promise<ScanResult> {
  if (!canScanReceipts) return { kind: "failed" };
  try {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, exif: false, base64: false, allowsEditing: false });
    const uri = picked.canceled ? null : picked.assets?.[0]?.uri;
    if (!uri) return { kind: "cancelled" };
    try {
      const receipts = await readText(uri);
      return receipts.length ? { kind: "found", receipts } : { kind: "none" };
    } finally {
      // The picker's copy lives in our cache: delete it. Never touch anything else
      // (a photo chosen from the library stays in the library).
      deleteOurCopy(uri);
    }
  } catch {
    return { kind: "failed" };
  }
}
