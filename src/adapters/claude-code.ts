import { analyzeTurn } from "../engine";
import { collectFacts } from "../fact-collector";
import { renderReceipt } from "../reporter";
import { sliceCurrentTurn } from "../transcript/jsonl";
import { readTranscriptTail } from "../transcript/read";
import type { Facts, ToolCall } from "../types";

/** The subset of the Claude Code `Stop` hook stdin payload we rely on. */
export interface HookInput {
  transcript_path?: string;
  cwd?: string;
  stop_hook_active?: boolean;
}

/** What we print to stdout for Claude Code to act on. `{}` means stay silent. */
export interface HookOutput {
  systemMessage?: string;
  decision?: "block";
  reason?: string;
}

export interface RunOptions {
  /** When true, block the turn and feed the receipt back to the agent to self-correct. */
  strict?: boolean;
  /** Injectable for tests; defaults to reading the file from disk. */
  readTranscript?: (path: string) => string | null;
  /** Injectable for tests; defaults to the real git/fs fact collector. */
  collect?: (toolCalls: ToolCall[], cwd: string) => Facts;
}

function defaultRead(path: string): string | null {
  return readTranscriptTail(path);
}

/**
 * Runs the verification for a single `Stop` hook invocation and returns the hook
 * output. Pure with respect to its options, so it is fully unit-testable. Fails
 * open: any missing data or unexpected shape yields silence, never a false alarm.
 */
export function runClaudeCodeHook(input: HookInput, opts: RunOptions = {}): HookOutput {
  // Already inside a forced continuation — never re-trigger (avoids loops).
  if (input.stop_hook_active) return {};

  const read = opts.readTranscript ?? defaultRead;
  const content = input.transcript_path ? read(input.transcript_path) : null;
  if (!content) return {};

  const turn = sliceCurrentTurn(content);
  const collect = opts.collect ?? collectFacts;
  const facts = collect(turn.toolCalls, input.cwd ?? process.cwd());

  const receipt = renderReceipt(analyzeTurn(turn, facts));
  if (!receipt) return {};

  return opts.strict ? { decision: "block", reason: receipt } : { systemMessage: receipt };
}
