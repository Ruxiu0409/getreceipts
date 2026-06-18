import type { Claim, ClaimType } from "./types";

/**
 * Turns assistant prose into falsifiable Claims.
 *
 * Design rule: PRECISION over recall. We would rather miss a real claim than
 * invent a false one — a single false positive destroys trust in an
 * anti-hallucination tool. So we only match plain, past/present-tense,
 * first-person assertions and skip anything hedged, future, conditional,
 * negated, or inside a code fence.
 */

/** Fenced code blocks (```...```) are examples/output, never the agent's claim. */
const FENCE = /```[\s\S]*?```/g;

/**
 * If any of these appear in the same sentence as a candidate match, we treat
 * the sentence as a non-assertion and skip it. Biased to over-skip on purpose.
 */
const DISQUALIFIER =
  /\b(?:will|i['’]ll|we['’]ll|you['’]ll|let['’]s|let me|gonna|going to|plan(?:ning)?(?: to)?|next|to-?do|should|would|could|might|may|must|hope|hopefully|expect(?:ing|ed)?|ensure|ensures|make sure|want to|need to|tr(?:y|ying) to|attempt|think|thinks|thought|believe|believes|guess|probably|maybe|perhaps|seems?|appears?|apparently|likely|presumably|looks? like|if|once|when|unless|after|before|assuming|as soon as|no|not|never|without|fail(?:s|ing|ed)?|broke|broken|error|errors?|cannot)\b/i;
/**
 * Any "n't" contraction (didn't, isn't, won't, …) is a negation. The apostrophe
 * is REQUIRED — otherwise "\w+nt" would match ordinary words like "Lint",
 * "point", "component", "implement" and wrongly silence real claims.
 */
const CONTRACTED_NEGATION = /\w*n['’]t\b/i;

/** A path-like token: either has a file extension, or contains a directory slash. */
const PATH =
  "(?:\\.{0,2}/)?(?:[\\w.\\-]+/)*[\\w.\\-]+\\.[A-Za-z][\\w]{0,9}|(?:\\.{0,2}/)?(?:[\\w.\\-]+/)+[\\w.\\-]+";

const EDIT_VERBS =
  "updated|modified|edited|changed|created|added|wrote|rewrote|refactored|fixed|removed|deleted|renamed|implemented";

interface Template {
  type: ClaimType;
  /** Must be a global, case-insensitive regex. */
  pattern: RegExp;
  capture?: (m: RegExpMatchArray) => Record<string, string>;
}

const TEMPLATES: Template[] = [
  {
    type: "TESTS_PASSED",
    pattern:
      /\btests?\s+(?:are\s+|is\s+)?(?:all\s+)?(?:now\s+)?(?:pass(?:ing|ed|es)?|green)\b/gi,
  },
  {
    type: "TESTS_PASSED",
    pattern: /\b(?:the\s+)?(?:test\s+)?suite\s+(?:is\s+)?(?:now\s+)?(?:pass(?:es|ing|ed)|green)\b/gi,
  },
  {
    type: "CHECKS_PASSED",
    pattern:
      /\bbuild\s+(?:is\s+)?(?:now\s+)?(?:succeed(?:ed|s)|pass(?:es|ed|ing)|green|clean|compiles?d?|works?)\b/gi,
    capture: () => ({ kind: "build" }),
  },
  {
    type: "CHECKS_PASSED",
    pattern: /\b(?:lint(?:ing|er)?|eslint)\s+(?:is\s+)?(?:now\s+)?(?:pass(?:es|ed|ing)?|clean|green|happy)\b/gi,
    capture: () => ({ kind: "lint" }),
  },
  {
    type: "CHECKS_PASSED",
    pattern:
      /\btype[\s-]?check(?:ing|s)?\s+(?:is\s+)?(?:now\s+)?(?:pass(?:es|ed|ing)?|clean|green|happy)\b/gi,
    capture: () => ({ kind: "typecheck" }),
  },
  {
    type: "CHECKS_PASSED",
    pattern: /\b(?:all\s+)?checks?\s+(?:are\s+)?(?:now\s+)?(?:pass(?:es|ed|ing)?|green)\b/gi,
    capture: () => ({ kind: "checks" }),
  },
  {
    type: "FILE_EDITED",
    pattern: new RegExp(`\\b(${EDIT_VERBS})\\b[^.\\n]{0,40}?\`?(${PATH})`, "gi"),
    capture: (m) => ({ verb: m[1] ?? "", path: m[2] ?? "" }),
  },
];

function isDisqualified(sentence: string): boolean {
  return DISQUALIFIER.test(sentence) || CONTRACTED_NEGATION.test(sentence);
}

/**
 * Split into rough sentences on newlines and on terminal punctuation that is
 * followed by whitespace. The trailing-whitespace requirement is important: it
 * stops us from splitting "src/foo.ts" (dot followed by a letter) or "v1.2.0"
 * into pieces, which would destroy the path/version tokens we need to capture.
 */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.?!;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractClaims(text: string): Claim[] {
  const prose = text.replace(FENCE, " ");
  const claims: Claim[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences(prose)) {
    if (isDisqualified(sentence)) continue;
    for (const tmpl of TEMPLATES) {
      for (const m of sentence.matchAll(tmpl.pattern)) {
        const captures = tmpl.capture ? tmpl.capture(m) : {};
        const key = `${tmpl.type}::${captures.path ?? ""}::${sentence}`;
        if (seen.has(key)) continue;
        seen.add(key);
        claims.push({ type: tmpl.type, raw: sentence, captures });
      }
    }
  }
  return claims;
}
