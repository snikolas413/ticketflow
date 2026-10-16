import { describe, expect, it } from "vitest";
import { allowedTransitions } from "./db";

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
