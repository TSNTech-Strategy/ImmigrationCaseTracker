import { FLASH_COOKIE, readFlash } from "@/lib/ui/flash";
import { Toast } from "./toast";

/** Shows the one-time message an action left for this page (see lib/ui/flash), then clears it. */
export async function FlashToast() {
  const f = await readFlash();
  if (!f) return null;
  return <Toast key={`${f.kind}:${f.title}`} kind={f.kind} title={f.title} detail={f.detail} clearCookie={FLASH_COOKIE} />;
}
