import { describe, expect, it } from "vitest";
import { wordDiffRanges } from "@/lib/word-diff";

function highlight(s: string, ranges: Array<[number, number]>): string {
  let out = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    out += s.slice(cursor, start);
    out += "[";
    out += s.slice(start, end);
    out += "]";
    cursor = end;
  }
  out += s.slice(cursor);
  return out;
}

describe("wordDiffRanges", () => {
  it("highlights the changed identifier", () => {
    const a = "const fooBar = 1;";
    const b = "const fooBaz = 1;";
    const { left, right } = wordDiffRanges(a, b);
    expect(highlight(a, left)).toBe("const [fooBar] = 1;");
    expect(highlight(b, right)).toBe("const [fooBaz] = 1;");
  });

  it("highlights an inserted argument", () => {
    const a = "fn(a, b)";
    const b = "fn(a, b, c)";
    const { left, right } = wordDiffRanges(a, b);
    expect(highlight(a, left)).toBe("fn(a, b)");
    expect(highlight(b, right)).toBe("fn(a, b[, c])");
  });

  it("returns empty ranges for identical strings", () => {
    const { left, right } = wordDiffRanges("same", "same");
    expect(left).toEqual([]);
    expect(right).toEqual([]);
  });

  it("does not highlight pure-whitespace differences", () => {
    const a = "if (x)";
    const b = "if  (x)";
    const { right } = wordDiffRanges(a, b);
    expect(right).toEqual([]);
  });

  it("returns empty for empty inputs", () => {
    expect(wordDiffRanges("", "abc")).toEqual({ left: [], right: [] });
    expect(wordDiffRanges("abc", "")).toEqual({ left: [], right: [] });
  });
});
