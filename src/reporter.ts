import type { Finding } from "./types";

/**
 * Renders findings into a compact "receipt" — the evidence, never a bare
 * accusation. Returns an empty string when there is nothing to report, so the
 * caller can stay completely silent on a clean turn.
 */
export function renderReceipt(findings: Finding[]): string {
  if (findings.length === 0) return "";

  const n = findings.length;
  const lines: string[] = [
    `⚠️  getreceipts — ${n} unverified claim${n > 1 ? "s" : ""} caught`,
  ];

  for (const f of findings) {
    lines.push(`  ✗ ${f.message}`);
    for (const e of f.evidence) {
      lines.push(`      • ${e.label}: ${e.detail}`);
    }
  }

  return lines.join("\n");
}
