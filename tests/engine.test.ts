import { describe, it, expect } from "vitest";
import { analyzeTurn } from "../src/engine";
import type { Facts, TurnData } from "../src/types";

const facts = (partial: Partial<Facts>): Facts => ({
  toolCalls: [],
  changedFiles: [],
  gitAvailable: true,
  pathExists: () => false,
  ...partial,
});

describe("analyzeTurn (extract + match end to end)", () => {
  it("catches a false 'tests pass' claim when no test command ran", () => {
    const turn: TurnData = {
      assistantText: "Done — I added tests and all tests pass.",
      toolCalls: [{ name: "Bash", command: "ls", isError: false }],
    };
    const findings = analyzeTurn(turn, facts({ toolCalls: turn.toolCalls }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.claim.type).toBe("TESTS_PASSED");
  });

  it("stays silent when the claim is backed by a passing test run", () => {
    const turn: TurnData = {
      assistantText: "All tests pass.",
      toolCalls: [{ name: "Bash", command: "npm test", isError: false }],
    };
    expect(analyzeTurn(turn, facts({ toolCalls: turn.toolCalls }))).toHaveLength(0);
  });
});
