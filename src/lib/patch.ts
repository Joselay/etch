// Reconstruct a minimal unified diff patch for a single hunk of a FileDiff.
//
// The Rust backend returns structured hunks (header + typed lines), not raw
// patch text. To stage/unstage/discard an individual hunk via `git apply`,
// we need to rebuild a git-style patch that includes the diff / --- / +++
// headers plus that one hunk.

import type { DiffHunk, FileDiff } from "./tauri";

function serializeHunk(hunk: DiffHunk): string {
  const out: string[] = [];
  out.push(hunk.header.endsWith("\n") ? hunk.header : `${hunk.header}\n`);
  for (const line of hunk.lines) {
    const marker = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
    out.push(`${marker}${line.content}\n`);
  }
  return out.join("");
}

export function serializeHunkForClipboard(hunk: DiffHunk): string {
  return serializeHunk(hunk);
}

// Parse the count side of a hunk header segment like "-0,0" or "+12,3".
// Returns null if the header doesn't match, in which case callers fall back
// to treating the file as a normal modification.
function hunkRange(header: string, side: "-" | "+"): { start: number; count: number } | null {
  const m = header.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!m) return null;
  const [, oStart, oCount, nStart, nCount] = m;
  return side === "-"
    ? { start: Number(oStart), count: oCount === undefined ? 1 : Number(oCount) }
    : { start: Number(nStart), count: nCount === undefined ? 1 : Number(nCount) };
}

function inferStatus(diff: FileDiff): "added" | "deleted" | "modified" {
  if (diff.hunks.length === 0) return "modified";
  const allNewFile = diff.hunks.every((h) => {
    const r = hunkRange(h.header, "-");
    return r !== null && r.count === 0;
  });
  if (allNewFile) return "added";
  const allDeletedFile = diff.hunks.every((h) => {
    const r = hunkRange(h.header, "+");
    return r !== null && r.count === 0;
  });
  if (allDeletedFile) return "deleted";
  return "modified";
}

export function buildHunkPatch(diff: FileDiff, hunkIndex: number): string {
  const hunk = diff.hunks[hunkIndex];
  if (!hunk) throw new Error(`hunk ${hunkIndex} out of range`);
  const oldPath = diff.oldPath ?? diff.path;
  const newPath = diff.path;
  const status = inferStatus(diff);
  const headerLines = [`diff --git a/${oldPath} b/${newPath}`];
  if (status === "added") {
    headerLines.push("new file mode 100644");
    headerLines.push("--- /dev/null");
    headerLines.push(`+++ b/${newPath}`);
  } else if (status === "deleted") {
    headerLines.push("deleted file mode 100644");
    headerLines.push(`--- a/${oldPath}`);
    headerLines.push("+++ /dev/null");
  } else {
    headerLines.push(`--- a/${oldPath}`);
    headerLines.push(`+++ b/${newPath}`);
  }
  headerLines.push("");
  return headerLines.join("\n") + serializeHunk(hunk);
}
