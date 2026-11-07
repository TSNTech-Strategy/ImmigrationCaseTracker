import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";
import { authHeaders } from "./api";
import { config } from "./config";
import type { Lang } from "./i18n";

export type ShareResult = "shared" | "copied" | "failed";

/** Share text: the system share sheet, or on the web (no share sheet) a copy to the clipboard. */
export async function shareText(message: string): Promise<ShareResult> {
  try {
    await Share.share({ message });
    return "shared";
  } catch {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        return "copied";
      } catch {
        return "failed";
      }
    }
    return "failed";
  }
}

/**
 * "Share my journey": the picture of the approved case (made by the server, the same one the website shares),
 * through the phone's share sheet. If the picture can't be fetched, the text is shared instead.
 */
export async function shareJourney(caseId: string, text: string, lang: Lang, dialogTitle: string): Promise<ShareResult> {
  if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
    try {
      const target = new File(Paths.cache, `casepingo-journey-${caseId}-${lang}.png`);
      const file = await File.downloadFileAsync(`${config.apiUrl}/api/v1/cases/${caseId}/journey-card?lang=${lang}`, target, { headers: await authHeaders(), idempotent: true });
      // A real picture is tens of kilobytes; an error page is a few bytes of JSON.
      if (file.size > 2000) {
        await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle });
        return "shared";
      }
    } catch {
      // Offline or an older server: share the words instead.
    }
  }
  return shareText(text);
}
