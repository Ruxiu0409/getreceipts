# getreceipts 🧾

[![npm version](https://img.shields.io/npm/v/getreceipts.svg)](https://www.npmjs.com/package/getreceipts)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-107%20passing-brightgreen.svg)](#)

**Your AI coding agent says it added the tests and they pass. `getreceipts` checks.**

A deterministic, read-only watchdog that catches your coding agent **claiming work it didn't do** — "all tests pass" when no test ran, "I updated `src/foo.ts`" when the diff says otherwise. It runs after every Claude Code turn and stays completely silent unless a claim is **provably** false.

No LLM. No telemetry. No false-positive theatre. Just receipts.

```
⚠️  getreceipts — 2 unverified claims caught
  ✗ Claimed tests pass, but no test command ran this turn.
      • observed: no test command appears in this turn's tool calls
  ✗ Claimed to have updated src/missing.ts, but it does not exist.
      • path: src/missing.ts
      • observed: this file is not in the git diff and does not exist in the repo
```

> ⭐ If this catches your agent even once, **star the repo** — it helps other people find it.

## Quickstart

```bash
npx -y getreceipts init      # wires a Stop hook into ./.claude/settings.json
```

That's it. Zero config. From now on, after every Claude Code turn, getreceipts cross-checks the agent's claims against your git diff, the files on disk, and the commands it actually ran. Clean turn? You won't even notice it's there.

```bash
getreceipts doctor     # prove the engine works + check the hook is wired
getreceipts explain    # show exactly what is (and isn't) checked
```

## What it catches

| Claim | Flagged when… |
|-------|---------------|
| **"all tests pass"** / "the suite is green" | no test command ran this turn, or it exited with an error |
| **"the build succeeded"** / "lint passes" / "type-check is clean" | no matching check/build command ran, or it failed |
| **"I updated `src/foo.ts`"** / "created config/x.yaml" | the path is absent from the git diff (and may not even exist) |

## What it will **not** do (on purpose)

A tool that cries wolf gets uninstalled. getreceipts only fires when a claim contradicts an **observed fact** (git, filesystem, process result). It stays silent on anything it can't prove, including:

- future / intent — *"I'll run the tests"*, *"let's add a test"*
- conditional — *"if the tests pass…"*
- negated — *"tests are not passing yet"*
- anything inside a ``` code fence ```

It **never** runs your tests, installs anything, or touches your repo. Read-only, always.

## How it works

1. Claude Code fires its `Stop` hook when a turn ends and hands us the path to the session transcript.
2. We read the transcript JSONL, slice out **just this turn** (ignoring prior turns and subagents), and pull out the agent's prose + the tools it actually called.
3. We extract falsifiable **claims** from the prose with high-precision patterns.
4. We check each claim against observed facts and print a **receipt** only for provable contradictions — as a non-blocking warning (or, with `--strict`, we hand it back to the agent to fix).

Deterministic and rule-based by design: an anti-hallucination tool must not hallucinate.

## Why not just… a linter? an LLM judge?

- **Static AI-slop linters** check code, in CI, one language at a time. They can't see the agent's *claims* — "I ran the tests and they pass" is invisible to `tsc`/`eslint`.
- **LLM-judge hooks** re-introduce the exact problem they're meant to catch (cost, latency, and a model that can itself be wrong). getreceipts is pure rules over ground-truth facts — same answer every time, instant, offline.

## Roadmap

- More claim types (removed/renamed, "bumped version to X", "committed/pushed")
- File-reference & lockfile-import checks
- Adapters for Cursor, Codex, OpenCode (the engine is already agent-agnostic)
- MCP server mode (`verify_last_turn`) for any MCP-speaking agent
- CI mode: flag "PR description vs actual diff" mismatches
- Community **check-packs** — installable rule bundles

## Contributing

The claim patterns and command recognizers are deliberately data-driven so they're easy to extend. PRs that add a missed real-world claim phrasing (with a test) or a test-runner are very welcome — **every new pattern needs a passing test and zero new false positives** in the corpus.

## License

MIT
