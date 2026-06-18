import type { ToolCall, TurnData } from "../types";

/**
 * Parses a Claude Code session transcript (JSONL) and extracts ONLY the current
 * turn: the assistant prose and tool-call ledger since the last real user
 * prompt. Schema confirmed against a live session:
 *   - real user prompts:  { type: "user", promptId, message.content: string }
 *   - tool results:       { type: "user", message.content: [{ type: "tool_result", tool_use_id, is_error }] }
 *   - assistant messages: { type: "assistant", message.content: [ {type:"text"} | {type:"tool_use"} | {type:"thinking"} ] }
 *   - subagent lines:     isSidechain: true   (ignored — not the main agent's claims)
 *   - noise events:       queue-operation / mode / last-prompt / attachment (skipped)
 */

interface ContentBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
}

interface Entry {
  type?: string;
  isSidechain?: boolean;
  promptId?: string;
  message?: { role?: string; content?: string | ContentBlock[] };
}

function parseLines(jsonl: string): Entry[] {
  const out: Entry[] = [];
  for (const line of jsonl.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s) as Entry);
    } catch {
      // Transcripts can contain partial/garbled lines; skip rather than throw.
    }
  }
  return out;
}

function isRealUserPrompt(e: Entry): boolean {
  if (e.type !== "user") return false;
  return e.promptId != null || typeof e.message?.content === "string";
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function sliceCurrentTurn(jsonl: string): TurnData {
  const main = parseLines(jsonl).filter((e) => e.isSidechain !== true);

  let start = -1;
  for (let i = 0; i < main.length; i++) {
    if (isRealUserPrompt(main[i]!)) start = i;
  }
  const turn = start >= 0 ? main.slice(start + 1) : main;

  const texts: string[] = [];
  const toolUses: ContentBlock[] = [];
  const resultIsError = new Map<string, boolean>();

  for (const e of turn) {
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    if (e.type === "assistant") {
      for (const b of content) {
        if (b.type === "text" && typeof b.text === "string") texts.push(b.text);
        else if (b.type === "tool_use") toolUses.push(b);
      }
    } else if (e.type === "user") {
      for (const b of content) {
        if (b.type === "tool_result" && b.tool_use_id) {
          resultIsError.set(b.tool_use_id, b.is_error === true);
        }
      }
    }
  }

  const toolCalls: ToolCall[] = toolUses.map((tu) => {
    const input = tu.input ?? {};
    return {
      name: tu.name ?? "",
      command: asString(input.command),
      filePath: asString(input.file_path) ?? asString(input.notebook_path),
      isError: tu.id ? (resultIsError.get(tu.id) ?? false) : false,
    };
  });

  return { assistantText: texts.join("\n"), toolCalls };
}
