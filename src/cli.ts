import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runClaudeCodeHook } from "./adapters/claude-code";
import { analyzeTurn } from "./engine";
import { addStopHook, hasGetreceiptsHook, type Settings } from "./settings";
import type { Facts } from "./types";

const VERSION = "0.1.0";

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

/** The `Stop` hook handler. Reads the hook payload on stdin, prints hook output, ALWAYS exits 0. */
async function cmdHook(): Promise<void> {
  const strict = process.argv.includes("--strict");
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const output = runClaudeCodeHook(input, { strict });
    if (Object.keys(output).length > 0) process.stdout.write(JSON.stringify(output));
  } catch {
    // Fail open: never let a verifier bug block the user's turn.
  }
  process.exit(0);
}

function cmdInit(): void {
  const settingsPath = join(process.cwd(), ".claude", "settings.json");
  let settings: Settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Settings;
    } catch {
      console.error(`✗ ${settingsPath} is not valid JSON — fix or remove it, then re-run.`);
      process.exit(1);
    }
  }

  if (hasGetreceiptsHook(settings)) {
    console.log(`✓ getreceipts is already wired into ${settingsPath}`);
    return;
  }

  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(addStopHook(settings), null, 2)}\n`);
  console.log(`✓ Added the getreceipts Stop hook to ${settingsPath}`);
  console.log("  It now runs after every Claude Code turn and warns you when a claim doesn't check out.");
}

function cmdDoctor(): void {
  const lyingFacts: Facts = { toolCalls: [], changedFiles: [], gitAvailable: true, pathExists: () => false };
  const caught = analyzeTurn({ assistantText: "Done. All tests pass.", toolCalls: [] }, lyingFacts);
  const quiet = analyzeTurn({ assistantText: "Looks good — small tidy-up.", toolCalls: [] }, lyingFacts);

  const enginePass = caught.length === 1 && quiet.length === 0;
  const settingsPath = join(process.cwd(), ".claude", "settings.json");
  let wired = false;
  if (existsSync(settingsPath)) {
    try {
      wired = hasGetreceiptsHook(JSON.parse(readFileSync(settingsPath, "utf8")) as Settings);
    } catch {
      /* ignore */
    }
  }

  console.log(`getreceipts v${VERSION}  (node ${process.version})`);
  console.log(`  engine self-test: ${enginePass ? "PASS ✓" : "FAIL ✗"}  (catches a false claim, stays silent on a clean turn)`);
  console.log(`  settings file:    ${settingsPath}`);
  console.log(`  Stop hook wired:  ${wired ? "yes ✓" : "no — run `getreceipts init`"}`);
  process.exit(enginePass ? 0 : 1);
}

function cmdExplain(): void {
  console.log(`getreceipts checks three kinds of falsifiable claim, deterministically (no LLM):

  TESTS_PASSED   "all tests pass" / "the suite is green"
                 → flagged if no test command ran this turn, or it exited with an error
  CHECKS_PASSED  "the build succeeded" / "lint passes" / "type-check is clean"
                 → flagged if no matching check/build command ran, or it failed
  FILE_EDITED    "I updated \`src/foo.ts\`" / "created config/x.yaml"
                 → flagged if the path is absent from the git diff (and may not exist)

It stays SILENT unless a claim is provably false from git / filesystem / process facts.
Ignored on purpose (to avoid false positives): future/intent ("I'll run…"), conditional
("if the tests pass"), negated ("tests fail"), and anything inside a code fence.`);
}

async function main(): Promise<void> {
  switch (process.argv[2]) {
    case "hook":
      return cmdHook();
    case "init":
      return cmdInit();
    case "doctor":
      return cmdDoctor();
    case "explain":
      return cmdExplain();
    default:
      console.log(`getreceipts v${VERSION} — catch your AI coding agent claiming work it didn't do.

Usage:
  npx -y getreceipts init      Wire the Stop hook into ./.claude/settings.json
  getreceipts doctor           Self-test the engine and show whether the hook is wired
  getreceipts explain          Show exactly what is (and isn't) checked
  getreceipts hook             (internal) run the verifier on a hook payload from stdin`);
  }
}

void main();
