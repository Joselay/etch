import { describe, expect, it } from "vitest";
import { hasConflictMarkers, parseConflictSegments } from "./conflict-markers";

describe("parseConflictSegments", () => {
  it("returns a single context segment when there are no markers", () => {
    const segs = parseConflictSegments("hello\nworld\n");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("context");
  });

  it("parses a single 2-way conflict block", () => {
    const src = [
      "before",
      "<<<<<<< HEAD",
      "ours-a",
      "ours-b",
      "=======",
      "theirs-a",
      ">>>>>>> topic",
      "after",
      "",
    ].join("\n");
    const segs = parseConflictSegments(src);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ kind: "context", lines: ["before"] });
    expect(segs[2]).toMatchObject({ kind: "context" });
    if (segs[1].kind !== "conflict") throw new Error("expected conflict");
    expect(segs[1].block.oursLabel).toBe("HEAD");
    expect(segs[1].block.theirsLabel).toBe("topic");
    expect(segs[1].block.ours).toEqual(["ours-a", "ours-b"]);
    expect(segs[1].block.theirs).toEqual(["theirs-a"]);
    expect(segs[1].block.base).toBeNull();
  });

  it("parses a diff3 block with the ||||||| base marker", () => {
    const src = ["<<<<<<< ours", "o", "||||||| base", "b", "=======", "t", ">>>>>>> theirs"].join(
      "\n",
    );
    const segs = parseConflictSegments(src);
    expect(segs).toHaveLength(1);
    if (segs[0].kind !== "conflict") throw new Error("expected conflict");
    expect(segs[0].block.base).toEqual(["b"]);
    expect(segs[0].block.baseLabel).toBe("base");
  });

  it("handles multiple blocks", () => {
    const src = [
      "<<<<<<< a",
      "1",
      "=======",
      "2",
      ">>>>>>> b",
      "mid",
      "<<<<<<< a",
      "3",
      "=======",
      "4",
      ">>>>>>> b",
    ].join("\n");
    const segs = parseConflictSegments(src);
    const conflicts = segs.filter((s) => s.kind === "conflict");
    expect(conflicts).toHaveLength(2);
  });

  it("detects marker presence", () => {
    expect(hasConflictMarkers("plain file")).toBe(false);
    expect(hasConflictMarkers("<<<<<<< a\n=======\n>>>>>>> b\n")).toBe(true);
  });
});
