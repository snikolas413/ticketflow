import { describe, expect, it } from "vitest";
import { calculateTicketSla } from "../shared/sla";

const policy = { firstResponseHours: 4, resolutionHours: 24 };
const now = new Date("2026-10-19T12:00:00.000Z");

describe("calculateTicketSla", () => {
  it("calculates first-response and resolution deadlines from ticket creation", () => {
    const result = calculateTicketSla({
      createdAt: "2026-10-19T10:00:00.000Z",
      status: "open",
      priority: "high",
      policy,
      now,
    });

    expect(result?.firstResponse?.dueAt.toISOString()).toBe("2026-10-19T14:00:00.000Z");
    expect(result?.firstResponse?.state).toBe("on_track");
    expect(result?.resolution?.dueAt.toISOString()).toBe("2026-10-20T10:00:00.000Z");
  });

  it("marks deadlines within one hour as at risk and overdue deadlines as breached", () => {
    const atRisk = calculateTicketSla({
      createdAt: "2026-10-19T09:30:00.000Z",
      status: "open",
      priority: "urgent",
      policy,
      now,
    });
    const breached = calculateTicketSla({
      createdAt: "2026-10-19T07:00:00.000Z",
      status: "open",
      priority: "urgent",
      policy,
      now,
    });

    expect(atRisk?.firstResponse?.state).toBe("at_risk");
    expect(breached?.firstResponse?.state).toBe("breached");
  });

  it("does not track first response after it has been recorded", () => {
    const result = calculateTicketSla({
      createdAt: "2026-10-19T08:00:00.000Z",
      firstRespondedAt: "2026-10-19T09:00:00.000Z",
      status: "in_progress",
      priority: "medium",
      policy,
      now,
    });

    expect(result?.firstResponse).toBeNull();
    expect(result?.resolution?.state).toBe("on_track");
  });

  it("omits active deadlines for resolved and closed tickets", () => {
    for (const status of ["resolved", "closed"] as const) {
      const result = calculateTicketSla({
        createdAt: "2026-10-17T08:00:00.000Z",
        status,
        priority: "low",
        policy,
        now,
      });
      expect(result).toEqual({ firstResponse: null, resolution: null });
    }
  });

  it("rejects invalid timestamps and invalid policy values", () => {
    expect(
      calculateTicketSla({
        createdAt: "not-a-date",
        status: "open",
        priority: "medium",
        policy,
        now,
      }),
    ).toBeNull();

    expect(
      calculateTicketSla({
        createdAt: "2026-10-19T08:00:00.000Z",
        status: "open",
        priority: "medium",
        policy: { firstResponseHours: 0, resolutionHours: -1 },
        now,
      }),
    ).toBeNull();
  });
});
