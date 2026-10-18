import { describe, expect, it } from "vitest";
import { allowedTransitions, isClaimAlreadyOwnedByUser } from "./db";

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


describe("ticket claim idempotency", () => {
  it("treats a repeated claim by the same user as already owned", () => {
    expect(isClaimAlreadyOwnedByUser(42, 42)).toBe(true);
  });

  it("does not treat a ticket owned by another user as already owned", () => {
    expect(isClaimAlreadyOwnedByUser(17, 42)).toBe(false);
  });

  it("does not treat an unassigned ticket as already owned", () => {
    expect(isClaimAlreadyOwnedByUser(null, 42)).toBe(false);
  });
});
