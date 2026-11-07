import { describe, expect, it } from "vitest";
import { caseJourney } from "../journeys";
import { NEXT_STEPS, caseGlance, glanceCounts, journeyShare, longDay, matchesFilter, nextStepFor, parseCaseFilter } from "../my-cases";
import { STATUS_GUIDE } from "../status-guide";

const NOW = new Date("2026-11-07T15:00:00Z");
type Point = { title: string; day: string };
/** A stored case: USCIS's history (oldest first) and the current status. */
function stored(formType: string | null, current: string | null, history: Point[] = [], filed?: string) {
  return {
    formType,
    statusTitleEn: current,
    uscisSubmittedRaw: filed ? `${filed}T00:00:00` : null,
    uscisModifiedRaw: history.length ? `${history[history.length - 1].day}T00:00:00` : null,
    uscisHistory: history.map((h) => ({ date: { raw: `${h.day}T00:00:00`, local: `${h.day}T00:00:00` }, textEn: h.title })),
  };
}
const glance = (c: ReturnType<typeof stored>, observedApprovalAt?: Date | null) => caseGlance(c, caseJourney(c, NOW), { now: NOW, observedApprovalAt });

describe("next step", () => {
  it("every status in the guide has a short next step in English and Spanish", () => {
    for (const g of STATUS_GUIDE) {
      const s = NEXT_STEPS[g.slug];
      expect(s, g.slug).toBeTruthy();
      expect(s.en.length, `${g.slug} (en)`).toBeLessThanOrEqual(40);
      expect(s.es.length, `${g.slug} (es)`).toBeLessThanOrEqual(52);
      expect(s.en).not.toMatch(/\.$/);
    }
    const slugs = new Set(STATUS_GUIDE.map((g) => g.slug));
    expect(Object.keys(NEXT_STEPS).filter((k) => !slugs.has(k))).toEqual([]);
  });

  it("matches the current status, and an approval depends on the form", () => {
    expect(nextStepFor("Interview Was Scheduled").en).toBe("Prepare for your interview");
    expect(nextStepFor("Request for Additional Evidence Was Sent").es).toBe("Envíe la evidencia antes de la fecha límite");
    expect(nextStepFor("Case Was Approved", "I-765").en).toBe("Watch for your card in the mail");
    expect(nextStepFor("Case Was Approved", "N-400").en).toBe("Watch for your oath ceremony notice");
    expect(nextStepFor("Case Was Approved", "I-130").en).toBe("Watch for your approval notice");
    expect(nextStepFor("Card Was Delivered To Me By The Post Office", "I-485").en).toBe("Check your card for mistakes");
  });

  it("wording the guide doesn't know gets a safe step from its kind", () => {
    expect(nextStepFor(null).en).toBe("Waiting for the first check");
    expect(nextStepFor("Notice Of Intent To Deny Was Sent").en).toBe("Read your latest USCIS notice");
    expect(nextStepFor("Some Brand New Wording").en).toBe("No action needed; watch for updates");
  });
});

describe("groups and tiles", () => {
  it("puts each case in one group", () => {
    expect(glance(stored("I-485", "Request for Additional Evidence Was Sent")).group).toBe("attention");
    expect(glance(stored("N-400", "Interview Was Scheduled"))).toMatchObject({ group: "attention", interview: true });
    expect(glance(stored("N-400", "Ready to Be Scheduled for An Interview"))).toMatchObject({ group: "progress", interview: true });
    expect(glance(stored("I-765", "Case Is Being Actively Reviewed By USCIS"))).toMatchObject({ group: "progress", interview: false });
    expect(glance(stored("I-485", "Card Was Delivered To Me By The Post Office")).group).toBe("completed");
    expect(glance(stored("I-485", "Case Was Denied")).group).toBe("completed");
    // Something to do, even though no more steps are expected.
    expect(glance(stored("I-485", "Card Was Returned To USCIS")).group).toBe("attention");
    expect(glance(stored("I-485", null)).group).toBe("progress");
  });

  it("approved recently: in the last 30 days by USCIS's date, or when CasePingo saw it", () => {
    const recent = stored("I-765", "Case Was Approved", [
      { title: "Case Was Received", day: "2026-03-02" },
      { title: "Case Was Approved", day: "2026-10-20" },
    ]);
    const old = stored("I-765", "Case Was Approved", [
      { title: "Case Was Received", day: "2026-01-02" },
      { title: "Case Was Approved", day: "2026-09-01" },
    ]);
    expect(glance(recent).approvedRecently).toBe(true);
    expect(glance(old).approvedRecently).toBe(false);
    expect(glance(old, new Date("2026-11-01T00:00:00Z")).approvedRecently).toBe(true);
    expect(glance(stored("I-765", "Case Was Denied", [{ title: "Case Was Denied", day: "2026-11-01" }])).approvedRecently).toBe(false);
  });

  it("counts the tiles and filters the list", () => {
    const list = [
      glance(stored("I-485", "Request for Additional Evidence Was Sent")),
      glance(stored("N-400", "Interview Was Scheduled")),
      glance(stored("I-765", "Case Was Approved", [{ title: "Case Was Approved", day: "2026-11-01" }])),
      glance(stored("I-485", "Card Was Delivered To Me By The Post Office", [{ title: "Card Was Delivered To Me By The Post Office", day: "2025-01-05" }])),
      glance(stored("I-130", "Case Was Received")),
    ];
    expect(glanceCounts(list)).toEqual({ attention: 2, interview: 1, approved: 1, active: 4, completed: 1 });
    expect(list.filter((g) => matchesFilter(g, "active")).length + list.filter((g) => matchesFilter(g, "completed")).length).toBe(list.length);
    expect(parseCaseFilter("interview")).toBe("interview");
    expect(parseCaseFilter("everything")).toBeNull();
    expect(parseCaseFilter(["attention"])).toBeNull();
  });
});

describe("share my journey", () => {
  const approved = stored(
    "I-765",
    "Card Was Mailed To Me",
    [
      { title: "Case Was Received", day: "2026-03-02" },
      { title: "Case Was Updated To Show Fingerprints Were Taken", day: "2026-03-30" },
      { title: "Case Was Approved", day: "2026-10-02" },
      { title: "Card Was Mailed To Me", day: "2026-10-05" },
    ],
    "2026-03-02",
  );

  it("has the form, the approval day, the days it took and the dated steps, and no receipt number", () => {
    const s = journeyShare(approved, caseJourney(approved, NOW))!;
    expect(s).toMatchObject({ approvedOn: "2026-10-02", filed: "2026-03-02", days: 214 });
    expect(s.steps.map((x) => x.key)).toEqual(["received", "biometrics", "review", "decision", "card-mailed"]);
    expect(s.text.en).toBe(
      [
        "My Form I-765 (work permit) was approved on October 2, 2026, 214 days after filing.",
        "",
        "Received: March 2, 2026",
        "Biometrics: March 30, 2026",
        "Decision: October 2, 2026",
        "Card mailed: October 5, 2026",
        "",
        "Tracked with CasePingo: https://casepingo.com",
      ].join("\n"),
    );
    expect(s.text.es.split("\n")[0]).toBe("Mi Formulario I-765 (permiso de trabajo) fue aprobado el 2 de octubre de 2026, 214 días después de presentarlo.");
    expect(s.text.en + s.text.es).not.toMatch(/[A-Z]{3}\*|\d{10}/);
  });

  it("only for approved cases; without dates it still reads well", () => {
    const pending = stored("I-765", "Case Is Being Actively Reviewed By USCIS");
    expect(journeyShare(pending, caseJourney(pending, NOW))).toBeNull();
    const denied = stored("I-765", "Case Was Denied");
    expect(journeyShare(denied, caseJourney(denied, NOW))).toBeNull();
    const bare = stored(null, "Case Was Approved");
    const s = journeyShare(bare, caseJourney(bare, NOW))!;
    expect(s).toMatchObject({ approvedOn: null, days: null });
    expect(s.text.en).toBe("My case was approved.\n\nTracked with CasePingo: https://casepingo.com");
    // A petition keeps just the form code.
    const petition = stored("I-140", "Case Was Approved", [{ title: "Case Was Approved", day: "2026-09-09" }]);
    expect(journeyShare(petition, caseJourney(petition, NOW))!.text.en.split("\n")[0]).toBe("My Form I-140 was approved on September 9, 2026.");
  });

  it("formats days in either language whatever the server's time zone", () => {
    expect(longDay("2026-01-01", "en")).toBe("January 1, 2026");
    expect(longDay("2026-01-01", "es")).toBe("1 de enero de 2026");
  });
});
