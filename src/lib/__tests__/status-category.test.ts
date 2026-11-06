import { describe, expect, it } from "vitest";
import { statusCategory } from "../status-category";

describe("statusCategory", () => {
  it("groups real USCIS status titles", () => {
    expect(statusCategory("Case Was Received")).toBe("progress");
    expect(statusCategory("Case Is Being Actively Reviewed By USCIS")).toBe("progress");
    expect(statusCategory("Fingerprint Fee Was Received")).toBe("progress");
    expect(statusCategory("Request for Additional Evidence Was Sent")).toBe("action");
    expect(statusCategory("Interview Was Scheduled")).toBe("action");
    expect(statusCategory("Case Was Approved")).toBe("done");
    expect(statusCategory("New Card Is Being Produced")).toBe("done");
    expect(statusCategory("Card Was Mailed To Me")).toBe("done");
    expect(statusCategory("Case Was Denied")).toBe("stop");
    expect(statusCategory("Case Rejected Because I Sent An Incorrect Fee")).toBe("stop");
    expect(statusCategory(null)).toBe("none");
  });
});
