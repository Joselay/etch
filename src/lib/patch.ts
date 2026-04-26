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

// Build a patch for a single hunk where only the user-selected addition /
// deletion lines are kept. Unselected `+` lines are dropped (they remain in
// the working tree only); unselected `-` lines are demoted to context (they
// remain in both old and new). Returns null if no real changes remain after
// filtering.
//
// We deliberately restrict each call to a single hunk so we don't need to
// recompute downstream hunk offsets, which is what makes general partial-line
// staging notoriously fiddly.
export function buildPartialHunkPatch(
  diff: FileDiff,
  hunkIndex: number,
  selectedLineIndices: ReadonlySet<number>,
): string | null {
  const hunk = diff.hunks[hunkIndex];
  if (!hunk) throw new Error(`hunk ${hunkIndex} out of range`);
  const oldRange = hunkRange(hunk.header, "-");
  const newRange = hunkRange(hunk.header, "+");
  if (!oldRange || !newRange) return null;

  const oldPath = diff.oldPath ?? diff.path;
  const newPath = diff.path;
  const headerLines = [`diff --git a/${oldPath} b/${newPath}`];
  // Partial-line staging never makes sense for full add/delete — caller
  // should stage the whole hunk in those cases. Treat the file as a normal
  // modification.
  headerLines.push(`--- a/${oldPath}`);
  headerLines.push(`+++ b/${newPath}`);

  const body: string[] = [];
  let oldCount = 0;
  let newCount = 0;
  let hasRealChange = false;

  for (let li = 0; li < hunk.lines.length; li++) {
    const line = hunk.lines[li];
    if (line.kind === "context") {
      body.push(` ${line.content}\n`);
      oldCount++;
      newCount++;
    } else if (line.kind === "deletion") {
      if (selectedLineIndices.has(li)) {
        body.push(`-${line.content}\n`);
        oldCount++;
        hasRealChange = true;
      } else {
        // Unselected deletion: act as if the line stays in both versions.
        body.push(` ${line.content}\n`);
        oldCount++;
        newCount++;
      }
    } else {
      // addition
      if (selectedLineIndices.has(li)) {
        body.push(`+${line.content}\n`);
        newCount++;
        hasRealChange = true;
      }
      // Unselected addition: drop entirely.
    }
  }

  if (!hasRealChange) return null;

  const newHeader = `@@ -${oldRange.start},${oldCount} +${newRange.start},${newCount} @@`;
  return `${headerLines.join("\n")}\n${newHeader}\n${body.join("")}`;
}

// Build a patch that discards user-selected addition/deletion lines from the
// working tree, leaving the rest of the diff intact. Apply with
// `cached: false, reverse: false` — the reversal is baked into the patch
// (the patch's pre-image is the current working tree, post-image is the
// working tree with selected changes reverted). Do NOT pass reverse: true.
//
// Selected addition → emitted as `-` (removed from WT).
// Selected deletion → emitted as `+` (restored to WT).
// Unselected addition → demoted to context (stays in WT).
// Unselected deletion → skipped entirely (stays absent from WT).
export function buildPartialDiscardPatch(
  diff: FileDiff,
  hunkIndex: number,
  selectedLineIndices: ReadonlySet<number>,
): string | null {
  const hunk = diff.hunks[hunkIndex];
  if (!hunk) throw new Error(`hunk ${hunkIndex} out of range`);
  const newRange = hunkRange(hunk.header, "+");
  if (!newRange) return null;

  const oldPath = diff.oldPath ?? diff.path;
  const newPath = diff.path;
  const headerLines = [
    `diff --git a/${oldPath} b/${newPath}`,
    `--- a/${oldPath}`,
    `+++ b/${newPath}`,
  ];

  const body: string[] = [];
  let oldCount = 0;
  let newCount = 0;
  let hasRealChange = false;

  for (let li = 0; li < hunk.lines.length; li++) {
    const line = hunk.lines[li];
    if (line.kind === "context") {
      body.push(` ${line.content}\n`);
      oldCount++;
      newCount++;
    } else if (line.kind === "addition") {
      if (selectedLineIndices.has(li)) {
        body.push(`-${line.content}\n`);
        oldCount++;
        hasRealChange = true;
      } else {
        body.push(` ${line.content}\n`);
        oldCount++;
        newCount++;
      }
    } else {
      if (selectedLineIndices.has(li)) {
        body.push(`+${line.content}\n`);
        newCount++;
        hasRealChange = true;
      }
    }
  }

  if (!hasRealChange) return null;

  const newHeader = `@@ -${newRange.start},${oldCount} +${newRange.start},${newCount} @@`;
  return `${headerLines.join("\n")}\n${newHeader}\n${body.join("")}`;
}
