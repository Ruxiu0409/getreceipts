import { describe, it, expect } from "vitest";
import { runClaudeCodeHook } from "../src/adapters/claude-code";
import type { Facts, ToolCall } from "../src/types";

// collect() in production sets facts.toolCalls = the turn's ledger, so tool calls
// must be encoded in the TRANSCRIPT, not injected via facts. This pass-through
// collector mirrors that while keeping git/fs out of the unit test.
const passThroughCollect = (toolCalls: ToolCall[]): Facts => ({
  toolCalls,
  changedFiles: [],
  gitAvailable: true,
  pathExists: () => false,
});

const textOnly = (assistantText: string) =>
  [
    JSON.stringify({ type: "user", promptId: "p1", message: { role: "user", content: "go" } }),
    JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: assistantText }] } }),
  ].join("\n");

const withPassingTestRun = (assistantText: string) =>
  [
    JSON.stringify({ type: "user", promptId: "p1", message: { role: "user", content: "go" } }),
    JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: assistantText },
          { type: "tool_use", id: "t1", name: "Bash", input: { command: "npm test" } },
        ],
      },
    }),
    JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok", is_error: false }] },
    }),
  ].join("\n");

const run = (transcript: string, extra = {}) =>
  runClaudeCodeHook(
    { transcript_path: "x", cwd: "/tmp", ...extra },
    { readTranscript: () => transcript, collect: passThroughCollect, ...extra },
  );

describe("runClaudeCodeHook", () => {
  it("stays silent when stop_hook_active is set, to avoid loops", () => {
    expect(run(textOnly("all tests pass"), { stop_hook_active: true })).toEqual({});
  });

  it("emits a systemMessage receipt when a claim is disproven", () => {
    const out = run(textOnly("Done — all tests pass."));
    expect(out.systemMessage).toMatch(/tests pass/i);
  });

  it("stays silent when the claim is backed by a passing test run in the transcript", () => {
    expect(run(withPassingTestRun("All tests pass."))).toEqual({});
  });

  it("fails open (silent) when the transcript cannot be read", () => {
    const out = runClaudeCodeHook({ transcript_path: "x" }, { readTranscript: () => null, collect: passThroughCollect });
    expect(out).toEqual({});
  });

  it("blocks (decision=block) in strict mode instead of just warning", () => {
    const out = run(textOnly("Done — all tests pass."), { strict: true });
    expect(out.decision).toBe("block");
    expect(out.reason).toMatch(/tests pass/i);
  });
});
