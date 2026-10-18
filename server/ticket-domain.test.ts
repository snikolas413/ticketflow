import { describe, expect, it } from "vitest";
import { allowedTransitions, isUserInTicketArea } from "./db";

describe("ticket workflow foundation", () => {
  it("allows the supported operational transitions", () => {
    expect(allowedTransitions("open")).toEqual(["in_progress", "closed"]);
    expect(allowedTransitions("in_progress")).toContain("resolved");
    expect(allowedTransitions("resolved")).toEqual(["closed", "in_progress"]);
  });

  it("keeps closed tickets reopenable only through the explicit reopen path", () => {
    expect(allowedTransitions("closed")).toEqual(["open"]);
    expect(allowedTransitions("closed")).not.toContain("resolved");
  });
});

describe("ticket area access", () => {
  const ticket = { departmentId: 10, teamId: 20 };

  it("allows an agent assigned to the same team", () => {
    expect(isUserInTicketArea({ profile: "agent", departmentId: 10, teamId: 20 }, ticket)).toBe(true);
  });

  it("allows an approver assigned to the same department when no team is assigned", () => {
    expect(isUserInTicketArea({ profile: "approver", departmentId: 10, teamId: null }, ticket)).toBe(true);
  });

  it("does not allow an agent from a different team to access by area", () => {
    expect(isUserInTicketArea({ profile: "agent", departmentId: 10, teamId: 21 }, ticket)).toBe(false);
  });

  it("does not allow an agent from a different department to access by area", () => {
    expect(isUserInTicketArea({ profile: "agent", departmentId: 11, teamId: null }, ticket)).toBe(false);
  });

  it("does not grant area access to requesters or managers through the agent rule", () => {
    expect(isUserInTicketArea({ profile: "requester", departmentId: 10, teamId: 20 }, ticket)).toBe(false);
    expect(isUserInTicketArea({ profile: "manager", departmentId: 10, teamId: 20 }, ticket)).toBe(false);
  });
});
