import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTranscriptTail } from "../src/transcript/read";

const dir = mkdtempSync(join(tmpdir(), "gr-read-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const write = (name: string, content: string) => {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
};

describe("readTranscriptTail", () => {
  it("returns the whole content for a small file", () => {
    const p = write("small.jsonl", "hello world");
    expect(readTranscriptTail(p, 1000)).toBe("hello world");
  });

  it("returns at most maxBytes but keeps the END of a large file (where the current turn is)", () => {
    const p = write("big.jsonl", "X".repeat(5000) + "\nLAST_TURN_MARKER");
    const out = readTranscriptTail(p, 1000)!;
    expect(out.length).toBeLessThanOrEqual(1000);
    expect(out).toContain("LAST_TURN_MARKER");
  });

  it("returns null for a missing file (caller stays silent)", () => {
    expect(readTranscriptTail(join(dir, "nope.jsonl"), 1000)).toBeNull();
  });
});
