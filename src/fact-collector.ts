import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { Facts, ToolCall } from "./types";

/**
 * Gathers observed ground-truth facts for the current turn. Strictly READ-ONLY:
 * we shell out to git for status and touch the filesystem for existence, but we
 * never run tests, install anything, or mutate the repo.
 */
export function collectFacts(toolCalls: ToolCall[], cwd: string): Facts {
  const insideWorktree = git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  const gitAvailable = insideWorktree?.trim() === "true";
  const changedFiles = gitAvailable ? parsePorcelain(git(cwd, ["status", "--porcelain"]) ?? "") : [];

  return {
    toolCalls,
    changedFiles,
    gitAvailable,
    pathExists: (p: string) => existsSync(isAbsolute(p) ? p : resolve(cwd, p)),
  };
}

function git(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    });
  } catch {
    return null;
  }
}

/** Parse `git status --porcelain` output into repo-relative changed paths. */
function parsePorcelain(out: string): string[] {
  const files: string[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    let p = line.slice(3); // strip the 2-char "XY" status + leading space
    const arrow = p.indexOf(" -> ");
    if (arrow >= 0) p = p.slice(arrow + 4); // for renames, keep the destination path
    p = p.trim().replace(/^"(.*)"$/, "$1"); // unquote paths git escapes
    if (p) files.push(p);
  }
  return files;
}
