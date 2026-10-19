import { describe, expect, it } from "vitest";
import { getTicketAge } from "../shared/ticket-age";

const now = new Date("2026-10-19T12:00:00.000Z").getTime();

describe("getTicketAge", () => {
  it("labels tickets younger than one hour", () => {
    expect(getTicketAge("2026-10-19T11:30:00.000Z", "open", now)).toMatchObject({
      label: "Aberto há menos de 1h",
      tone: "normal",
      elapsedHours: 0,
    });
  });

  it("warns at 24 hours and marks critical at 72 hours", () => {
    expect(getTicketAge("2026-10-18T12:00:00.000Z", "open", now)?.tone).toBe("warning");
    expect(getTicketAge("2026-10-16T12:00:00.000Z", "in_progress", now)?.tone).toBe("critical");
  });

  it("does not show an aging indicator for resolved or closed tickets", () => {
    expect(getTicketAge("2026-10-10T12:00:00.000Z", "resolved", now)).toBeNull();
    expect(getTicketAge("2026-10-10T12:00:00.000Z", "closed", now)).toBeNull();
  });

  it("ignores invalid timestamps", () => {
    expect(getTicketAge("not-a-date", "open", now)).toBeNull();
  });
});
