import { describe, it, expect } from "vitest";
import { sliceCurrentTurn } from "../src/transcript/jsonl";

const line = (obj: unknown) => JSON.stringify(obj);

// Mirrors the REAL Claude Code transcript schema confirmed against a live session:
// user prompts carry a string content + promptId; tool results are `user` lines with
// array content + a tool_result block; assistant messages have a content block array.
const transcript = [
  // --- prior turn (must be excluded from the current turn) ---
  line({ type: "user", promptId: "p0", message: { role: "user", content: "first request" } }),
  line({
    type: "assistant",
    isSidechain: false,
    message: { role: "assistant", content: [{ type: "text", text: "Earlier I said all tests pass." }] },
  }),
  // --- current turn boundary ---
  line({ type: "user", promptId: "p1", message: { role: "user", content: "now do the thing" } }),
  line({
    type: "assistant",
    isSidechain: false,
    message: {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "secret reasoning, ignore me" },
        { type: "text", text: "Done. I updated `src/foo.ts` and all tests pass." },
        { type: "tool_use", id: "t1", name: "Bash", input: { command: "npm test", description: "run tests" } },
        { type: "tool_use", id: "t2", name: "Edit", input: { file_path: "src/foo.ts" } },
      ],
    },
  }),
  // tool results (user lines, array content, no promptId) + tool-specific toolUseResult
  line({
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok", is_error: false }] },
    toolUseResult: { stdout: "1 passed", stderr: "", interrupted: false },
  }),
  line({
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t2", content: "ok", is_error: false }] },
    toolUseResult: { filePath: "src/foo.ts" },
  }),
  // a subagent (sidechain) line that must be ignored entirely
  line({
    type: "assistant",
    isSidechain: true,
    message: { role: "assistant", content: [{ type: "text", text: "subagent: everything is broken and tests fail" }] },
  }),
  // noise event types that must be skipped without throwing
  line({ type: "mode", mode: "default" }),
  "not valid json at all",
].join("\n");

describe("sliceCurrentTurn", () => {
  const turn = sliceCurrentTurn(transcript);

  it("includes the current turn's assistant text", () => {
    expect(turn.assistantText).toContain("all tests pass");
    expect(turn.assistantText).toContain("src/foo.ts");
  });

  it("excludes prior-turn text", () => {
    expect(turn.assistantText).not.toContain("Earlier");
  });

  it("excludes subagent (sidechain) text", () => {
    expect(turn.assistantText).not.toContain("subagent");
  });

  it("excludes thinking blocks", () => {
    expect(turn.assistantText).not.toContain("secret reasoning");
  });

  it("builds the Bash tool-call ledger with the command", () => {
    const cmds = turn.toolCalls.filter((t) => t.name === "Bash").map((t) => t.command);
    expect(cmds).toContain("npm test");
  });

  it("captures the edited file path from an Edit tool call", () => {
    const edit = turn.toolCalls.find((t) => t.name === "Edit");
    expect(edit?.filePath).toBe("src/foo.ts");
  });

  it("pairs tool results, marking isError correctly", () => {
    const bash = turn.toolCalls.find((t) => t.name === "Bash");
    expect(bash?.isError).toBe(false);
  });
});

describe("sliceCurrentTurn: error pairing", () => {
  const t = [
    line({ type: "user", promptId: "p1", message: { role: "user", content: "go" } }),
    line({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "tool_use", id: "x1", name: "Bash", input: { command: "npm test" } }] },
    }),
    line({
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x1", content: "boom", is_error: true }] },
    }),
  ].join("\n");

  it("marks a failed tool result as isError true", () => {
    const bash = sliceCurrentTurn(t).toolCalls.find((c) => c.name === "Bash");
    expect(bash?.isError).toBe(true);
  });
});
