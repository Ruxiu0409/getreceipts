import { describe, it, expect } from "vitest";
import { isTestCommand, isCheckCommand } from "../src/recognizers";

describe("isTestCommand", () => {
  const yes = [
    "npm test",
    "npm run test",
    "pnpm test",
    "yarn test",
    "npx vitest run",
    "vitest",
    "jest --coverage",
    "pytest -q",
    "python -m pytest",
    "go test ./...",
    "cargo test",
    "bundle exec rspec",
  ];
  for (const c of yes) it(`is a test command: ${c}`, () => expect(isTestCommand(c)).toBe(true));

  const no = ["npm run build", "git status", "ls -la", "npm run lint", "tsc --noEmit"];
  for (const c of no) it(`is NOT a test command: ${c}`, () => expect(isTestCommand(c)).toBe(false));
});

describe("isCheckCommand (lint / typecheck / build)", () => {
  const yes = [
    "tsc --noEmit",
    "npm run typecheck",
    "eslint .",
    "npm run lint",
    "ruff check .",
    "mypy src",
    "npm run build",
    "vite build",
    "cargo build",
    "go build ./...",
  ];
  for (const c of yes) it(`is a check command: ${c}`, () => expect(isCheckCommand(c)).toBe(true));

  const no = ["git status", "ls", "cat file.txt", "echo hi"];
  for (const c of no) it(`is NOT a check command: ${c}`, () => expect(isCheckCommand(c)).toBe(false));
});
