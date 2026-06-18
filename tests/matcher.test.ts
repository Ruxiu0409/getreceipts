import { describe, it, expect } from "vitest";
import { match } from "../src/matcher";
import type { Claim, Facts, ToolCall } from "../src/types";

const claim = (type: Claim["type"], captures: Record<string, string> = {}): Claim => ({
  type,
  raw: "(raw sentence)",
  captures,
});

const facts = (partial: Partial<Facts>): Facts => ({
  toolCalls: [],
  changedFiles: [],
  gitAvailable: true,
  pathExists: () => false,
  ...partial,
});

const bash = (command: string, isError = false): ToolCall => ({ name: "Bash", command, isError });

describe("matcher: TESTS_PASSED", () => {
  it("flags when no test command ran this turn", () => {
    const f = match([claim("TESTS_PASSED")], facts({ toolCalls: [bash("ls -la")] }));
    expect(f).toHaveLength(1);
    expect(f[0]!.message).toMatch(/no test/i);
    expect(f[0]!.evidence.length).toBeGreaterThan(0);
  });

  it("is silent when a test command passed", () => {
    expect(match([claim("TESTS_PASSED")], facts({ toolCalls: [bash("npm test")] }))).toHaveLength(0);
  });

  it("flags when the test command ran but failed", () => {
    const f = match([claim("TESTS_PASSED")], facts({ toolCalls: [bash("npm test", true)] }));
    expect(f).toHaveLength(1);
    expect(f[0]!.message).toMatch(/fail/i);
  });

  it("is silent when one run failed but a later run passed", () => {
    const f = match(
      [claim("TESTS_PASSED")],
      facts({ toolCalls: [bash("npm test", true), bash("npm test", false)] }),
    );
    expect(f).toHaveLength(0);
  });
});

describe("matcher: TESTS_PASSED — precision against unrecognized runners", () => {
  it("stays silent when an unrecognized but test-like command ran (custom script)", () => {
    const f = match([claim("TESTS_PASSED")], facts({ toolCalls: [bash("./scripts/run_tests.sh")] }));
    expect(f).toHaveLength(0);
  });

  it("still flags when only unrelated commands ran (claimed pass, did something else)", () => {
    const f = match([claim("TESTS_PASSED")], facts({ toolCalls: [bash("git status")] }));
    expect(f).toHaveLength(1);
  });

  it("still flags when literally no command ran", () => {
    expect(match([claim("TESTS_PASSED")], facts({ toolCalls: [] }))).toHaveLength(1);
  });
});

describe("matcher: CHECKS_PASSED", () => {
  it("stays silent when an unrecognized build-like command ran (e.g. 'make release-build')", () => {
    const f = match([claim("CHECKS_PASSED", { kind: "build" })], facts({ toolCalls: [bash("make release-build")] }));
    expect(f).toHaveLength(0);
  });

  it("flags when no check/build command ran", () => {
    const f = match([claim("CHECKS_PASSED", { kind: "build" })], facts({ toolCalls: [bash("ls")] }));
    expect(f).toHaveLength(1);
  });

  it("is silent when a build command passed", () => {
    expect(
      match([claim("CHECKS_PASSED", { kind: "build" })], facts({ toolCalls: [bash("npm run build")] })),
    ).toHaveLength(0);
  });
});

describe("matcher: FILE_EDITED", () => {
  it("flags a claimed file absent from the diff that does not exist", () => {
    const f = match(
      [claim("FILE_EDITED", { verb: "updated", path: "src/foo.ts" })],
      facts({ gitAvailable: true, changedFiles: [], pathExists: () => false }),
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.message).toMatch(/does not exist/i);
  });

  it("is silent when the file is in the git diff", () => {
    expect(
      match([claim("FILE_EDITED", { path: "src/foo.ts" })], facts({ changedFiles: ["src/foo.ts"] })),
    ).toHaveLength(0);
  });

  it("is silent when an edit tool touched the path (suffix match)", () => {
    expect(
      match(
        [claim("FILE_EDITED", { path: "foo.ts" })],
        facts({ toolCalls: [{ name: "Edit", filePath: "src/foo.ts", isError: false }], changedFiles: [] }),
      ),
    ).toHaveLength(0);
  });

  it("is silent when git is unavailable (cannot be trusted)", () => {
    expect(
      match([claim("FILE_EDITED", { path: "src/foo.ts" })], facts({ gitAvailable: false })),
    ).toHaveLength(0);
  });

  it("flags a file that exists but was not changed this turn (without the 'does not exist' wording)", () => {
    const f = match(
      [claim("FILE_EDITED", { verb: "modified", path: "src/foo.ts" })],
      facts({ changedFiles: ["src/bar.ts"], pathExists: () => true }),
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.message).not.toMatch(/does not exist/i);
  });
});
