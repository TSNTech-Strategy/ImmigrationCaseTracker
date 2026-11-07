"use client";

import { useState } from "react";

type Labels = { share: string; download: string; copy: string; copied: string; downloaded: string; failed: string };

/**
 * Share the journey picture: the system share sheet where the browser can share files (phones),
 * otherwise a download. The message can be copied too. No receipt number in either.
 */
export function JourneyShareActions({ imageUrl, text, title, labels }: { imageUrl: string; text: string; title: string; labels: Labels }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], "casepingo-journey.png", { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "casepingo-journey.png";
        a.click();
        URL.revokeObjectURL(url);
        setNote(labels.downloaded);
      }
    } catch (e) {
      // Closing the share sheet isn't an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNote(labels.copied);
    } catch {
      setNote(labels.failed);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d9a632] bg-[#f2c14e] px-5 py-3 text-base font-extrabold tracking-wide text-[#0f1b2d] hover:bg-[#e0ae3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        {labels.share.toUpperCase()}
      </button>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
        <a href={imageUrl} download="casepingo-journey.png" className="font-semibold text-white underline-offset-2 hover:underline">
          {labels.download}
        </a>
        <button type="button" onClick={copy} className="font-semibold text-white underline-offset-2 hover:underline">
          {labels.copy}
        </button>
      </div>
      <p role="status" className="min-h-5 text-sm text-[#f2c14e]">
        {note}
      </p>
    </div>
  );
}
