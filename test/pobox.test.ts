import { describe, it, expect } from "vitest";
import { isPoBox } from "../src/pobox";

describe("isPoBox", () => {
  it.each([
    ["PO Box 123", null], ["P.O. Box 9", null], ["p o box 44", null], ["POB 12", null],
    ["Post Office Box 7", null], ["123 Main St", "PO Box 5"], ["Box 221B", null],
  ])("detects %s / %s", (a1, a2) => expect(isPoBox(a1, a2)).toBe(true));

  it.each([
    ["123 Main St", null], ["Boxwood Lane 4", null], ["12 Pobla Ave", "Apt 3"], [null, null],
  ])("does not flag %s / %s", (a1, a2) => expect(isPoBox(a1, a2)).toBe(false));
});
