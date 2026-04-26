import { describe, expect, it } from "vitest";
import { buildPartialDiscardPatch, buildPartialHunkPatch } from "@/lib/patch";
import type { DiffHunk, FileDiff } from "@/lib/tauri";

function makeDiff(hunk: DiffHunk): FileDiff {
  return {
    path: "src/foo.ts",
    oldPath: "src/foo.ts",
    isBinary: false,
    hunks: [hunk],
  };
}

const SAMPLE_HUNK: DiffHunk = {
  header: "@@ -1,3 +1,4 @@",
  lines: [
    { kind: "context", content: "a", oldLine: 1, newLine: 1 },
    { kind: "deletion", content: "b", oldLine: 2, newLine: null },
    { kind: "addition", content: "B", oldLine: null, newLine: 2 },
    { kind: "addition", content: "X", oldLine: null, newLine: 3 },
    { kind: "context", content: "c", oldLine: 3, newLine: 4 },
  ],
};

describe("buildPartialHunkPatch", () => {
  it("returns null when no changed lines selected", () => {
    expect(buildPartialHunkPatch(makeDiff(SAMPLE_HUNK), 0, new Set([0, 4]))).toBeNull();
  });

  it("returns null when selection is empty", () => {
    expect(buildPartialHunkPatch(makeDiff(SAMPLE_HUNK), 0, new Set())).toBeNull();
  });

  it("stages only the selected addition, demoting other +/- to context", () => {
    // User picked just the `+X` line.
    const patch = buildPartialHunkPatch(makeDiff(SAMPLE_HUNK), 0, new Set([3]));
    expect(patch).not.toBeNull();
    expect(patch).toBe(
      [
        "diff --git a/src/foo.ts b/src/foo.ts",
        "--- a/src/foo.ts",
        "+++ b/src/foo.ts",
        "@@ -1,3 +1,4 @@",
        " a",
        " b",
        "+X",
        " c",
        "",
      ].join("\n"),
    );
  });

  it("stages only the selected deletion, demoting unrelated additions to dropped", () => {
    const patch = buildPartialHunkPatch(makeDiff(SAMPLE_HUNK), 0, new Set([1]));
    expect(patch).not.toBeNull();
    expect(patch).toBe(
      [
        "diff --git a/src/foo.ts b/src/foo.ts",
        "--- a/src/foo.ts",
        "+++ b/src/foo.ts",
        "@@ -1,3 +1,2 @@",
        " a",
        "-b",
        " c",
        "",
      ].join("\n"),
    );
  });

  it("stages the full hunk when every changed line is selected", () => {
    const patch = buildPartialHunkPatch(makeDiff(SAMPLE_HUNK), 0, new Set([1, 2, 3]));
    expect(patch).not.toBeNull();
    expect(patch).toBe(
      [
        "diff --git a/src/foo.ts b/src/foo.ts",
        "--- a/src/foo.ts",
        "+++ b/src/foo.ts",
        "@@ -1,3 +1,4 @@",
        " a",
        "-b",
        "+B",
        "+X",
        " c",
        "",
      ].join("\n"),
    );
  });
});

describe("buildPartialDiscardPatch", () => {
  it("returns null when nothing changed is selected", () => {
    expect(buildPartialDiscardPatch(makeDiff(SAMPLE_HUNK), 0, new Set([0, 4]))).toBeNull();
  });

  it("returns null when selection is empty", () => {
    expect(buildPartialDiscardPatch(makeDiff(SAMPLE_HUNK), 0, new Set())).toBeNull();
  });

  it("removes only the selected addition from the working tree", () => {
    // User wants to discard just the `+X` addition; B should remain.
    const patch = buildPartialDiscardPatch(makeDiff(SAMPLE_HUNK), 0, new Set([3]));
    expect(patch).not.toBeNull();
    expect(patch).toBe(
      [
        "diff --git a/src/foo.ts b/src/foo.ts",
        "--- a/src/foo.ts",
        "+++ b/src/foo.ts",
        "@@ -1,4 +1,3 @@",
        " a",
        " B",
        "-X",
        " c",
        "",
      ].join("\n"),
    );
  });

  it("restores only the selected deletion to the working tree", () => {
    // User wants to bring back `b`; B/X stay.
    const patch = buildPartialDiscardPatch(makeDiff(SAMPLE_HUNK), 0, new Set([1]));
    expect(patch).not.toBeNull();
    expect(patch).toBe(
      [
        "diff --git a/src/foo.ts b/src/foo.ts",
        "--- a/src/foo.ts",
        "+++ b/src/foo.ts",
        "@@ -1,4 +1,5 @@",
        " a",
        "+b",
        " B",
        " X",
        " c",
        "",
      ].join("\n"),
    );
  });

  it("discards the full hunk when every changed line is selected", () => {
    const patch = buildPartialDiscardPatch(makeDiff(SAMPLE_HUNK), 0, new Set([1, 2, 3]));
    expect(patch).not.toBeNull();
    expect(patch).toBe(
      [
        "diff --git a/src/foo.ts b/src/foo.ts",
        "--- a/src/foo.ts",
        "+++ b/src/foo.ts",
        "@@ -1,4 +1,3 @@",
        " a",
        "+b",
        "-B",
        "-X",
        " c",
        "",
      ].join("\n"),
    );
  });
});
