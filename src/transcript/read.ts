import { closeSync, fstatSync, openSync, readFileSync, readSync } from "node:fs";

/**
 * Reads a transcript file, but only the last `maxBytes` for large files. The
 * current turn always lives at the END of the JSONL, so reading the tail keeps
 * the hook fast on multi-megabyte sessions. A partially-read first line is fine:
 * the JSONL parser skips malformed lines.
 */
export function readTranscriptTail(path: string, maxBytes = 1_000_000): string | null {
  try {
    const fd = openSync(path, "r");
    try {
      const size = fstatSync(fd).size;
      if (size <= maxBytes) return readFileSync(path, "utf8");

      const buf = Buffer.allocUnsafe(maxBytes);
      const bytesRead = readSync(fd, buf, 0, maxBytes, size - maxBytes);
      return buf.toString("utf8", 0, bytesRead);
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}
