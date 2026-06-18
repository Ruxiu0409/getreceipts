import { describe, it, expect } from "vitest";
import { renderReceipt } from "../src/reporter";
import type { Finding } from "../src/types";

const finding = (message: string, evidence: { label: string; detail: string }[] = []): Finding => ({
  claim: { type: "TESTS_PASSED", raw: "", captures: {} },
  message,
  evidence,
});

describe("renderReceipt", () => {
  it("returns an empty string when there are no findings (silence)", () => {
    expect(renderReceipt([])).toBe("");
  });

  it("renders the message and its evidence", () => {
    const out = renderReceipt([
      finding("Claimed tests pass, but no test command ran this turn.", [
        { label: "observed", detail: "no test command appears in this turn's tool calls" },
      ]),
    ]);
    expect(out).toContain("Claimed tests pass");
    expect(out).toContain("no test command appears");
  });

  it("includes the count of caught claims in the header", () => {
    const out = renderReceipt([finding("a"), finding("b")]);
    expect(out).toMatch(/2/);
  });
});
