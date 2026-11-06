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

  it("doesn't treat side requests or acknowledgements as decisions or to-dos", () => {
    expect(statusCategory("Expedite Request Denied")).toBe("progress");
    expect(statusCategory("Response To USCIS' Request For Evidence Was Received")).toBe("progress");
    expect(statusCategory("Request to Reschedule My Appointment Was Received")).toBe("progress");
    expect(statusCategory("Request for Initial Evidence Was Sent")).toBe("action");
    expect(statusCategory("Notice Explaining USCIS Actions Was Mailed")).toBe("action");
    expect(statusCategory("Withdrawal Acknowledgement Notice Was Sent")).toBe("stop");
    expect(statusCategory("Card Is Being Returned to USCIS by Post Office")).toBe("stop");
    expect(statusCategory("Oath Ceremony Was Scheduled")).toBe("done");
  });
});
