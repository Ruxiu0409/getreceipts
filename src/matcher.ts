import type { Claim, Evidence, Facts, Finding, ToolCall } from "./types";
import { isCheckCommand, isTestCommand } from "./recognizers";

/**
 * Compares claims against observed facts and returns a Finding ONLY when there
 * is a provable contradiction. The guiding rule (confidence floor): flag only
 * what can be shown false from git / filesystem / tool-call facts. On any
 * ambiguity, stay silent — a false positive is far costlier than a missed lie.
 */
export function match(claims: Claim[], facts: Facts): Finding[] {
  const findings: Finding[] = [];
  for (const claim of claims) {
    const finding = matchOne(claim, facts);
    if (finding) findings.push(finding);
  }
  return findings;
}

interface BashRun {
  command: string;
  isError: boolean;
}

function bashRuns(toolCalls: ToolCall[]): BashRun[] {
  return toolCalls.flatMap((tc) =>
    tc.name === "Bash" && typeof tc.command === "string"
      ? [{ command: tc.command, isError: tc.isError }]
      : [],
  );
}

function normalizePath(p: string): string {
  return p.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

/** True if two paths refer to the same file, tolerating repo-relative vs nested forms. */
function pathsMatch(claimed: string, actual: string): boolean {
  const a = normalizePath(claimed);
  const b = normalizePath(actual);
  if (!a || !b) return false;
  return a === b || b.endsWith(`/${a}`) || a.endsWith(`/${b}`);
}

interface RunSpec {
  claimLabel: string;
  word: string;
  /** Precise recognizer — used to decide a run "ran and failed" (must be confident). */
  precise: (cmd: string) => boolean;
  /** Loose substring guard — if ANY command looks related, suppress the "nothing ran" flag. */
  looksRelated: (cmd: string) => boolean;
}

const has = (...needles: string[]) => (cmd: string) => {
  const c = cmd.toLowerCase();
  return needles.some((n) => c.includes(n));
};

const RUN_SPECS: Record<string, RunSpec> = {
  tests: { claimLabel: "tests pass", word: "test", precise: isTestCommand, looksRelated: has("test") },
  build: { claimLabel: "the build passed", word: "build", precise: isCheckCommand, looksRelated: has("build", "compile") },
  lint: { claimLabel: "lint passed", word: "lint", precise: isCheckCommand, looksRelated: has("lint") },
  typecheck: {
    claimLabel: "type-check passed",
    word: "type-check",
    precise: isCheckCommand,
    looksRelated: has("tsc", "typecheck", "type-check", "mypy", "pyright"),
  },
  checks: {
    claimLabel: "all checks passed",
    word: "check/build",
    precise: isCheckCommand,
    looksRelated: has("check", "build", "lint", "tsc", "typecheck", "compile"),
  },
};

function matchOne(claim: Claim, facts: Facts): Finding | null {
  switch (claim.type) {
    case "TESTS_PASSED":
      return matchRunClaim(claim, facts, RUN_SPECS.tests!);
    case "CHECKS_PASSED":
      return matchRunClaim(claim, facts, RUN_SPECS[claim.captures.kind ?? "checks"] ?? RUN_SPECS.checks!);
    case "FILE_EDITED":
      return matchFileEdited(claim, facts);
    default:
      return null;
  }
}

/**
 * Shared logic for "X passed" claims. Two tiers, precision-first:
 *  - If a PRECISELY-recognized command ran: flag only if every such run errored.
 *  - Else if anything even LOOKS related (custom runner, wrapper script): stay silent.
 *  - Else (claimed pass but nothing relevant ran at all): flag — the strong, near-tautological catch.
 */
function matchRunClaim(claim: Claim, facts: Facts, spec: RunSpec): Finding | null {
  const runs = bashRuns(facts.toolCalls);
  const recognized = runs.filter((r) => spec.precise(r.command));

  if (recognized.length > 0) {
    if (recognized.some((r) => !r.isError)) return null; // a recognized run passed → consistent
    const last = recognized[recognized.length - 1];
    return {
      claim,
      message: `Claimed ${spec.claimLabel}, but the ${spec.word} command that ran failed.`,
      evidence: [
        { label: "command", detail: last?.command ?? "(unknown)" },
        { label: "result", detail: "exited with an error" },
      ],
    };
  }

  // No precisely-recognized command. If something merely looks related, don't risk a false positive.
  if (runs.some((r) => spec.looksRelated(r.command))) return null;

  return {
    claim,
    message: `Claimed ${spec.claimLabel}, but no ${spec.word} command ran this turn.`,
    evidence: [{ label: "observed", detail: `no ${spec.word} command appears in this turn's tool calls` }],
  };
}

function matchFileEdited(claim: Claim, facts: Facts): Finding | null {
  // Without git we cannot reliably tell whether a Bash command wrote the file,
  // so we suppress this check entirely rather than risk a false positive.
  if (!facts.gitAvailable) return null;

  const path = claim.captures.path;
  if (!path) return null;

  const editedViaTool = facts.toolCalls.some((tc) => tc.filePath && pathsMatch(path, tc.filePath));
  const inDiff = facts.changedFiles.some((cf) => pathsMatch(path, cf));
  if (editedViaTool || inDiff) return null;

  const exists = facts.pathExists(path);
  const verb = claim.captures.verb ?? "edited";
  const observed: Evidence = exists
    ? { label: "observed", detail: "this file is not in the git diff and no edit tool touched it this turn" }
    : { label: "observed", detail: "this file is not in the git diff and does not exist in the repo" };

  return {
    claim,
    message: exists
      ? `Claimed to have ${verb} ${path}, but it was not changed this turn.`
      : `Claimed to have ${verb} ${path}, but it does not exist.`,
    evidence: [{ label: "path", detail: path }, observed],
  };
}
