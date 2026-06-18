import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { collectFacts } from "../src/fact-collector";

const g = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { stdio: "ignore" });

describe("collectFacts (git integration)", () => {
  let repo: string;

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gr-repo-"));
    g(repo, "init", "-q");
    g(repo, "config", "user.email", "t@t.co");
    g(repo, "config", "user.name", "t");
    writeFileSync(join(repo, "tracked.ts"), "export const a = 1;\n");
    g(repo, "add", ".");
    g(repo, "commit", "-qm", "init");
    writeFileSync(join(repo, "tracked.ts"), "export const a = 2;\n"); // modified
    writeFileSync(join(repo, "new.ts"), "export const b = 1;\n"); // untracked
  });

  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it("reports gitAvailable=true inside a repo", () => {
    expect(collectFacts([], repo).gitAvailable).toBe(true);
  });

  it("lists modified and untracked files", () => {
    const cf = collectFacts([], repo).changedFiles;
    expect(cf).toContain("tracked.ts");
    expect(cf).toContain("new.ts");
  });

  it("resolves pathExists against the repo root", () => {
    const f = collectFacts([], repo);
    expect(f.pathExists("tracked.ts")).toBe(true);
    expect(f.pathExists("nope.ts")).toBe(false);
  });

  it("reports gitAvailable=false outside a repo", () => {
    const nonRepo = mkdtempSync(join(tmpdir(), "gr-nogit-"));
    try {
      expect(collectFacts([], nonRepo).gitAvailable).toBe(false);
    } finally {
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });

  it("passes the provided tool-call ledger through unchanged", () => {
    const facts = collectFacts([{ name: "Bash", command: "npm test", isError: false }], repo);
    expect(facts.toolCalls).toHaveLength(1);
  });
});
