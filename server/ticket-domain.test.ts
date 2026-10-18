import { describe, expect, it } from "vitest";
import { allowedTransitions } from "./db";
import { TICKET_STATUSES } from "@shared/ticket-types";

describe("ticket workflow foundation", () => {
  it("defines the complete supported transition matrix", () => {
    expect(allowedTransitions("open")).toEqual(["in_progress", "closed"]);
    expect(allowedTransitions("in_progress")).toEqual(["waiting_requester", "resolved", "open"]);
    expect(allowedTransitions("waiting_requester")).toEqual(["in_progress", "resolved"]);
    expect(allowedTransitions("resolved")).toEqual(["closed", "in_progress"]);
    expect(allowedTransitions("closed")).toEqual(["open"]);
  });

  it("only exposes known ticket statuses as transition targets", () => {
    for (const status of TICKET_STATUSES) {
      expect(allowedTransitions(status).every(target => TICKET_STATUSES.includes(target))).toBe(true);
    }
  });

  it("keeps closed tickets reopenable only through the explicit reopen path", () => {
    expect(allowedTransitions("closed")).toEqual(["open"]);
    expect(allowedTransitions("closed")).not.toContain("resolved");
    expect(allowedTransitions("closed")).not.toContain("in_progress");
  });
});
