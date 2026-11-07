import { describe, expect, it } from "vitest";
import { caseDays, dayOf, daysBetween, lineMapFor, scenarioFor } from "../journeys";

const keys = (m: ReturnType<typeof lineMapFor>) => m.steps.map((s) => s.key);
const states = (m: ReturnType<typeof lineMapFor>) => m.steps.map((s) => s.state[0]).join("");

describe("scenarios by form", () => {
  it("picks the line map for each kind of case", () => {
    expect(scenarioFor("I485").key).toBe("green-card");
    expect(scenarioFor("i-765").key).toBe("work-permit");
    expect(scenarioFor("N-400").key).toBe("citizenship");
    expect(scenarioFor("I-130").key).toBe("family-petition");
    expect(scenarioFor("I-131").key).toBe("travel-document");
    expect(scenarioFor("I-751").key).toBe("remove-conditions");
    expect(scenarioFor("I-730").key).toBe("asylee-relative");
    expect(scenarioFor("I-140").key).toBe("petition");
    expect(scenarioFor("I-539").key).toBe("general");
    expect(scenarioFor(null).key).toBe("general");
  });
});

describe("lineMapFor", () => {
  it("green card at biometrics: received is done with its date, biometrics is current", () => {
    const m = lineMapFor({
      formType: "I-485",
      currentTitleEn: "Fingerprints Were Taken",
      currentDate: "2024-03-11T00:00:00",
      history: [{ titleEn: "Case Was Received", date: "2024-02-26T00:00:00" }],
    });
    expect(keys(m)).toEqual(["received", "biometrics", "review", "decision", "card-mailed", "card-delivered"]);
    expect(states(m)).toBe("dcuuuu");
    expect(m.steps[0].date).toBe("2024-02-26");
    expect(m.steps[1].date).toBe("2024-03-11");
    expect(m.marker?.en).toBe("Fingerprints taken");
    expect(m).toMatchObject({ current: 1, tone: "progress", outcome: null, finished: false });
  });

  it("green card delivered: the journey is finished and skipped steps count as done", () => {
    const m = lineMapFor({
      formType: "I-485",
      currentTitleEn: "Card Was Delivered To Me By The Post Office",
      currentDate: "12-10-2024",
      history: [
        { titleEn: "Case Was Received", date: "2024-02-26T00:00:00" },
        { titleEn: "Case Was Approved", date: "2024-11-15T00:00:00" },
        { titleEn: "Card Was Mailed To Me", date: "2024-11-15T00:00:00" },
      ],
    });
    expect(states(m)).toBe("dddddc");
    expect(m.steps.map((s) => s.date)).toEqual(["2024-02-26", null, null, "2024-11-15", "2024-11-15", "2024-12-10"]);
    expect(m).toMatchObject({ current: 5, tone: "done", outcome: "approved", finished: true });
  });

  it("work permit approved: decision is current, the card steps are still ahead", () => {
    const m = lineMapFor({ formType: "I-765", currentTitleEn: "Case Was Approved", history: [] });
    expect(states(m)).toBe("dddcuu");
    expect(m.marker?.en).toBe("Approved");
    expect(m).toMatchObject({ outcome: "approved", finished: false, tone: "done" });
  });

  it("citizenship: reviewing and interview statuses sit on the interview step", () => {
    const reviewed = lineMapFor({ formType: "N-400", currentTitleEn: "Case Is Being Actively Reviewed By USCIS", history: [] });
    expect(keys(reviewed)).toEqual(["received", "biometrics", "interview", "decision", "oath"]);
    expect(reviewed.current).toBe(2);
    expect(reviewed.marker?.en).toBe("In review");
    const interview = lineMapFor({ formType: "N-400", currentTitleEn: "Interview Was Scheduled", history: [] });
    expect(interview).toMatchObject({ current: 2, tone: "action" });
    expect(interview.marker?.en).toBe("Interview scheduled");
    const oath = lineMapFor({ formType: "N-400", currentTitleEn: "Oath Ceremony Was Scheduled", history: [] });
    expect(oath).toMatchObject({ current: 4, finished: true, outcome: "approved" });
  });

  it("family petition: approval finishes the USCIS part; the visa center step only applies abroad", () => {
    const approved = lineMapFor({ formType: "I-130", currentTitleEn: "Case Was Approved", history: [] });
    expect(keys(approved)).toEqual(["received", "review", "decision", "state"]);
    expect(approved).toMatchObject({ current: 2, finished: true });
    const sent = lineMapFor({ formType: "I-130", currentTitleEn: "Case Was Sent To The Department of State", history: [] });
    expect(sent).toMatchObject({ current: 3, finished: true });
  });

  it("evidence requests and denials change the tone and the marker", () => {
    const rfe = lineMapFor({ formType: "I-539", currentTitleEn: "Request for Additional Evidence Was Sent", history: [] });
    expect(rfe).toMatchObject({ scenario: "general", current: 1, tone: "action", finished: false });
    expect(rfe.marker?.en).toBe("Evidence requested");
    const denied = lineMapFor({ formType: "I-485", currentTitleEn: "Case Was Denied", history: [] });
    expect(denied).toMatchObject({ current: 3, tone: "stop", outcome: "denied", finished: true });
    expect(denied.marker?.en).toBe("Denied");
    expect(states(denied)).toBe("dddcuu");
  });

  it("side statuses keep the furthest step; a reopened case goes back to review", () => {
    const moved = lineMapFor({
      formType: "I-485",
      currentTitleEn: "Case Was Transferred And A New Office Has Jurisdiction",
      history: [
        { titleEn: "Case Was Received", date: "2024-02-26T00:00:00" },
        { titleEn: "Fingerprints Were Taken", date: "2024-03-11T00:00:00" },
      ],
    });
    expect(moved.current).toBe(1);
    const reopened = lineMapFor({ formType: "I-485", currentTitleEn: "Case Was Reopened", history: [{ titleEn: "Case Was Denied", date: "2024-06-01T00:00:00" }] });
    expect(reopened).toMatchObject({ current: 2, outcome: null, finished: false });
  });

  it("travel documents and card production map onto the right steps", () => {
    expect(lineMapFor({ formType: "I-131", currentTitleEn: "Document Was Mailed To Me", history: [] })).toMatchObject({ current: 4, finished: true });
    const producing = lineMapFor({ formType: "I-765", currentTitleEn: "New Card Is Being Produced", history: [] });
    expect(producing.current).toBe(4);
    expect(producing.marker?.en).toBe("Card being made");
    expect(lineMapFor({ formType: "I-140", currentTitleEn: "Case Was Approved", history: [] })).toMatchObject({ scenario: "petition", current: 2, finished: true });
  });

  it("before the first check nothing is reached", () => {
    expect(lineMapFor({ formType: "I-485", currentTitleEn: null, history: [] })).toMatchObject({ current: -1, marker: null, finished: false });
  });
});

describe("days", () => {
  it("reads USCIS and ISO dates and counts days", () => {
    expect(dayOf("09-05-2023 14:28:46")).toBe("2023-09-05");
    expect(dayOf("2024-02-26T00:00:00")).toBe("2024-02-26");
    expect(dayOf(new Date("2024-12-10T15:00:00Z"))).toBe("2024-12-10");
    expect(dayOf("not a date")).toBeNull();
    expect(daysBetween("2024-02-26", "2024-12-06")).toBe(284);
  });

  it("total runs to the last update when finished, to today otherwise", () => {
    expect(caseDays({ filed: "2024-02-26", lastUpdate: "2024-12-06", finished: true, today: "2026-11-03" })).toEqual({ filed: "2024-02-26", lastUpdate: "2024-12-06", total: 284, sinceUpdate: 697 });
    expect(caseDays({ filed: "2026-10-01", lastUpdate: "2026-10-20", finished: false, today: "2026-11-01" })).toMatchObject({ total: 31, sinceUpdate: 12 });
    expect(caseDays({ filed: null, lastUpdate: null, finished: false, today: "2026-11-01" })).toEqual({ filed: null, lastUpdate: null, total: null, sinceUpdate: null });
  });
});
