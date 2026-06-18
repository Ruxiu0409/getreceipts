/**
 * Recognizes whether a shell command is a test run or a check/build run.
 *
 * We never EXECUTE anything — we only classify commands the agent already ran
 * (observed in the transcript) so the matcher can tell whether a "tests pass" /
 * "build succeeded" claim had any backing action at all. Data-driven so the
 * community can extend it per ecosystem.
 */

const TEST_PATTERNS: RegExp[] = [
  /\b(?:vitest|jest|mocha|ava|jasmine|pytest|rspec|phpunit|gotestsum|deno test)\b/i,
  /\bgo\s+test\b/i,
  /\bcargo\s+test\b/i,
  /\b(?:npm|pnpm|yarn|bun|npx)\s+(?:run\s+|exec\s+)?tests?\b/i,
  /\bpython\d?\s+-m\s+(?:unittest|pytest)\b/i,
  /\b(?:rake|mix|gradle|mvn)\s+test\b/i,
];

const CHECK_PATTERNS: RegExp[] = [
  /\btsc\b/i,
  /\b(?:npm|pnpm|yarn|bun|npx)\s+(?:run\s+|exec\s+)?(?:type-?check|typecheck|lint|build|check|compile)\b/i,
  /\b(?:eslint|biome|oxlint|prettier|stylelint)\b/i,
  /\b(?:ruff|mypy|pyright|flake8|pylint|black)\b/i,
  /\b(?:vite|next|nuxt|tsup|rollup|webpack|esbuild|turbo)\s+build\b/i,
  /\b(?:cargo|go)\s+build\b/i,
  /\bmake\s+(?:build|lint|check|typecheck)\b/i,
  /\bgradle\s+(?:build|check)\b/i,
];

function anyMatch(patterns: RegExp[], command: string): boolean {
  return patterns.some((p) => p.test(command));
}

export function isTestCommand(command: string): boolean {
  return anyMatch(TEST_PATTERNS, command);
}

export function isCheckCommand(command: string): boolean {
  return anyMatch(CHECK_PATTERNS, command);
}
