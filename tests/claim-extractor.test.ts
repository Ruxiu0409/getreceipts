import { describe, it, expect } from "vitest";
import { extractClaims } from "../src/claim-extractor";

const types = (text: string) => extractClaims(text).map((c) => c.type);
const findType = (text: string, t: string) =>
  extractClaims(text).find((c) => c.type === t);

describe("claim-extractor: TESTS_PASSED — must match", () => {
  const ok = [
    "I added a unit test and all tests pass.",
    "All tests pass.",
    "The test suite passes.",
    "Tests are green.",
    "Tests are now passing.",
  ];
  for (const text of ok) {
    it(`matches: ${JSON.stringify(text)}`, () => {
      expect(types(text)).toContain("TESTS_PASSED");
    });
  }
});

describe("claim-extractor: TESTS_PASSED — must NOT match (precision)", () => {
  const no: [string, string][] = [
    ["future will", "I'll run the tests to make sure they pass."],
    ["let's", "Let's add tests so the suite passes."],
    ["modal should", "The tests should pass now."],
    ["conditional if", "If the tests pass, we can ship."],
    ["negated not", "The tests are not passing yet."],
    ["negated fail", "Some tests fail right now."],
    ["going to", "I'm going to make the tests pass."],
    ["need to", "We need to get the tests passing."],
  ];
  for (const [label, text] of no) {
    it(`ignores: ${label}`, () => {
      expect(types(text)).not.toContain("TESTS_PASSED");
    });
  }
});

describe("claim-extractor: ignores hedged / uncertain claims", () => {
  const no: [string, string][] = [
    ["think", "I think all tests pass."],
    ["probably", "The tests probably pass."],
    ["seems", "It seems the build succeeded."],
    ["maybe", "Maybe the tests pass now."],
    ["looks like", "Looks like lint passes."],
  ];
  for (const [label, text] of no) {
    it(`ignores: ${label}`, () => {
      expect(extractClaims(text)).toHaveLength(0);
    });
  }
});

describe("claim-extractor: ignores fenced code blocks", () => {
  it("does not match a claim inside a ``` fence", () => {
    const text = "Here is an example:\n```\nconsole.log('all tests pass');\n```\nDone.";
    expect(extractClaims(text)).toHaveLength(0);
  });

  it("still matches a real claim outside the fence", () => {
    const text = "```\n// tests are green here in a comment\n```\nI ran them: all tests pass.";
    expect(types(text)).toContain("TESTS_PASSED");
  });
});

describe("claim-extractor: CHECKS_PASSED", () => {
  it("matches 'The build succeeded.' with kind=build", () => {
    expect(findType("The build succeeded.", "CHECKS_PASSED")?.captures.kind).toBe("build");
  });
  it("matches 'Lint passes.' with kind=lint", () => {
    expect(findType("Lint passes.", "CHECKS_PASSED")?.captures.kind).toBe("lint");
  });
  it("matches 'Type-check passes.' with kind=typecheck", () => {
    expect(findType("Type-check passes.", "CHECKS_PASSED")?.captures.kind).toBe("typecheck");
  });
  it("matches 'All checks pass.' with kind=checks", () => {
    expect(findType("All checks pass.", "CHECKS_PASSED")?.captures.kind).toBe("checks");
  });
  it("ignores modal 'The build should pass.'", () => {
    expect(types("The build should pass.")).not.toContain("CHECKS_PASSED");
  });
});

describe("claim-extractor: FILE_EDITED", () => {
  it("captures the path from an inline-backticked claim", () => {
    const c = findType("I updated `src/foo.ts` to add the handler.", "FILE_EDITED");
    expect(c?.captures.path).toBe("src/foo.ts");
    expect(c?.captures.verb?.toLowerCase()).toBe("updated");
  });
  it("captures a path with directories and no backticks", () => {
    expect(findType("Created config/redis.yaml for the cache.", "FILE_EDITED")?.captures.path).toBe(
      "config/redis.yaml",
    );
  });
  it("captures multiple edited files in one sentence", () => {
    const paths = extractClaims("I updated `a.ts` and created `b.ts`.")
      .filter((c) => c.type === "FILE_EDITED")
      .map((c) => c.captures.path)
      .sort();
    expect(paths).toEqual(["a.ts", "b.ts"]);
  });
  it("does not match when there is no path-like token", () => {
    expect(types("I updated the handler logic.")).not.toContain("FILE_EDITED");
  });
  it("ignores a future-tense edit", () => {
    expect(types("I'll update src/foo.ts next.")).not.toContain("FILE_EDITED");
  });
  it("ignores a path inside a fence", () => {
    expect(types("```\nedited src/foo.ts\n```")).not.toContain("FILE_EDITED");
  });
});
