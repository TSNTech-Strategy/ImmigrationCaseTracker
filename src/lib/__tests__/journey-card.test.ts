import { describe, expect, it } from "vitest";
import { renderJourneyCard } from "../journey-card";
import { approvedSealSvg } from "../journey-seal";

describe("Share my journey picture", () => {
  it("draws the seal with 12 stars", () => {
    expect(approvedSealSvg().match(/<polygon points=/g)).toHaveLength(14); // 12 stars + 2 ribbon tails
  });

  it("renders a 1080 × 1350 PNG in both languages", async () => {
    const share = {
      approvedOn: "2024-11-15",
      filed: "2024-02-26",
      days: 263,
      steps: [
        { key: "received", label: { en: "Received", es: "Recibido" }, date: "2024-02-26" },
        { key: "decision", label: { en: "Decision", es: "Decisión" }, date: "2024-11-15" },
      ],
      text: { en: "", es: "" },
    };
    for (const lang of ["en", "es"] as const) {
      const res = await renderJourneyCard({ share, formCode: "I-485", scenario: { en: "Green card", es: "Tarjeta de residencia" }, lang });
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      const png = Buffer.from(await res.arrayBuffer());
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(1080);
      expect(png.readUInt32BE(20)).toBe(1350);
    }
  }, 60_000);
});
