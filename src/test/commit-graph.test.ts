import { describe, expect, it } from "vitest";
import { layoutGraph } from "@/lib/commit-graph";

describe("layoutGraph", () => {
  it("linear history uses a single lane", () => {
    const { rows, width } = layoutGraph([
      { id: "c", parentIds: ["b"] },
      { id: "b", parentIds: ["a"] },
      { id: "a", parentIds: [] },
    ]);
    expect(width).toBe(1);
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    expect(rows[2].outgoingLanes).toEqual([]);
  });

  it("merge commit joins two lanes back into one", () => {
    // m has parents [a, b]. Before m, both a and b are tips.
    const { rows, width } = layoutGraph([
      { id: "m", parentIds: ["a", "b"] },
      { id: "b", parentIds: ["base"] },
      { id: "a", parentIds: ["base"] },
      { id: "base", parentIds: [] },
    ]);
    expect(width).toBeGreaterThanOrEqual(2);
    // m sits at lane 0; its parents occupy two lanes.
    expect(rows[0].lane).toBe(0);
    expect(rows[0].parentLanes).toHaveLength(2);
    // `base` row collapses back to a single lane (either 0 or 1 depending on
    // arrival order — just check width collapses by the final row).
    expect(rows[3].outgoingLanes).toEqual([]);
  });

  it("fork assigns a new lane to the side branch", () => {
    // m merges a and b; b branched off earlier. Before b's row we should see
    // two lanes; after `base` we collapse.
    const { rows } = layoutGraph([
      { id: "m", parentIds: ["a", "b"] },
      { id: "a", parentIds: ["base"] },
      { id: "b", parentIds: ["base"] },
      { id: "base", parentIds: [] },
    ]);
    // m's two parents should occupy distinct lanes
    expect(new Set(rows[0].parentLanes).size).toBe(2);
  });
});
