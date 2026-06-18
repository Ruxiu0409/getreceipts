export type ClaimType = "TESTS_PASSED" | "CHECKS_PASSED" | "FILE_EDITED";

export interface Claim {
  /** Which kind of falsifiable assertion the agent made. */
  type: ClaimType;
  /** The exact sentence we matched, used in the receipt. */
  raw: string;
  /** Extracted slots, e.g. { path: "src/foo.ts" } or { kind: "lint" }. */
  captures: Record<string, string>;
}

/** One tool invocation observed in the current turn's transcript. */
export interface ToolCall {
  /** Tool name, e.g. "Bash", "Edit", "Write", "MultiEdit". */
  name: string;
  /** The shell command, when name === "Bash". */
  command?: string;
  /** The edited file path, for Edit/Write/MultiEdit tools. */
  filePath?: string;
  /** Whether the tool result was an error (nonzero exit / failure). */
  isError: boolean;
}

/** The assistant prose + tool-call ledger for a single (current) turn. */
export interface TurnData {
  /** Concatenated assistant text blocks from this turn (the claims source). */
  assistantText: string;
  /** Tool calls the assistant made this turn, paired with their results. */
  toolCalls: ToolCall[];
}

/** Observed ground-truth facts for the current turn. Plain data so the matcher stays pure. */
export interface Facts {
  /** This turn's tool-call ledger. */
  toolCalls: ToolCall[];
  /** Repo-relative paths that git reports as changed (modified + staged + untracked). */
  changedFiles: string[];
  /** False when not in a git repo / git failed — the matcher then suppresses file claims. */
  gitAvailable: boolean;
  /** Does this path currently exist on disk (repo-relative or absolute)? */
  pathExists(path: string): boolean;
}

export interface Evidence {
  label: string;
  detail: string;
}

/** A provable contradiction between a claim and the observed facts. */
export interface Finding {
  claim: Claim;
  /** One-line human summary for the receipt. */
  message: string;
  /** The supporting facts — the receipt. Never a bare accusation. */
  evidence: Evidence[];
}
