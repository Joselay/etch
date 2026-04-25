// Lane-based commit graph layout.
//
// Input: commits in display order (most recent first, as returned by `git log`).
// Output: per-row lane state sufficient to render a classic vertical git graph.
//
// A "lane" is a column; a single row owns a commit at one lane and may have
// other lanes passing through (pending parents of earlier-rendered commits).

export type GraphCommit = { id: string; parentIds: string[] };

export type GraphRow = {
  // Lane (column index) where this commit's dot is drawn.
  lane: number;
  // Lane-indexed snapshot of the pending-commit ids before this row is
  // consumed. The commit's own id lives at `lane`; other non-null entries
  // are pass-through lanes for later commits.
  incomingLanes: (string | null)[];
  // Same shape, after this row. Entry at `lane` is the first parent's id
  // (or null if root). Additional parents occupy other lanes.
  outgoingLanes: (string | null)[];
  // Lane index where each parent ends up. parentLanes[0] is typically === lane.
  parentLanes: number[];
  // Stable color index for this commit's dot / inbound edge.
  color: number;
  // Per-lane color indexes aligned with incomingLanes / outgoingLanes.
  // Entries are -1 where the lane is empty.
  incomingColors: number[];
  outgoingColors: number[];
};

export type GraphLayout = {
  rows: GraphRow[];
  // Max of incoming/outgoing lane counts across all rows — use as column width.
  width: number;
  // idColor[i] is the color index assigned to outgoing lane i's occupant; use
  // `getColor(id, row.incomingLanes)` helper below for the incoming side.
  idColor: Map<string, number>;
};

export function layoutGraph(commits: GraphCommit[]): GraphLayout {
  const rows: GraphRow[] = [];
  let lanes: (string | null)[] = [];
  const idColor = new Map<string, number>();
  let nextColor = 0;

  const colorOf = (id: string): number => {
    const existing = idColor.get(id);
    if (existing !== undefined) return existing;
    const c = nextColor++;
    idColor.set(id, c);
    return c;
  };

  let width = 0;

  for (const c of commits) {
    const incoming: (string | null)[] = [...lanes];
    let lane = incoming.indexOf(c.id);
    if (lane === -1) {
      // Branch tip (no one was waiting for this id).
      lane = incoming.indexOf(null);
      if (lane === -1) {
        lane = incoming.length;
        incoming.push(null);
      }
      incoming[lane] = c.id;
    }
    const color = colorOf(c.id);

    const outgoing: (string | null)[] = [...incoming];
    outgoing[lane] = null;
    const parentLanes: number[] = [];

    for (let pi = 0; pi < c.parentIds.length; pi++) {
      const p = c.parentIds[pi];
      let pl = outgoing.indexOf(p);
      if (pl === -1) {
        if (pi === 0) {
          pl = lane;
          outgoing[lane] = p;
          // First parent inherits this commit's color so a straight branch
          // keeps a single color.
          if (!idColor.has(p)) idColor.set(p, color);
        } else {
          pl = outgoing.indexOf(null);
          if (pl === -1) {
            pl = outgoing.length;
            outgoing.push(null);
          }
          outgoing[pl] = p;
          colorOf(p);
        }
      }
      parentLanes.push(pl);
    }

    // Trim trailing nulls so width is tight.
    while (outgoing.length > 0 && outgoing[outgoing.length - 1] === null) outgoing.pop();

    const rowWidth = Math.max(incoming.length, outgoing.length);
    if (rowWidth > width) width = rowWidth;

    const incomingColors = incoming.map((x) => (x ? colorOf(x) : -1));
    const outgoingColors = outgoing.map((x) => (x ? colorOf(x) : -1));

    rows.push({
      lane,
      incomingLanes: incoming,
      outgoingLanes: outgoing,
      parentLanes,
      color,
      incomingColors,
      outgoingColors,
    });
    lanes = outgoing;
  }

  return { rows, width, idColor };
}

// Qualitative palette tuned per-theme: dark mode gets brighter, more
// saturated colors so lanes pop against the dark background; light mode is
// kept slightly deeper so they read against white. Hues are shared between
// the two so a given lane keeps its identity across theme switches.
const LANE_HUES = [210, 150, 35, 330, 265, 185, 15, 85];

const LIGHT_LANE_COLORS = LANE_HUES.map((h, i) => {
  const sat = i % 2 === 0 ? 70 : 60;
  const light = i % 2 === 0 ? 50 : 45;
  return `hsl(${h} ${sat}% ${light}%)`;
});

const DARK_LANE_COLORS = LANE_HUES.map((h, i) => {
  const sat = i % 2 === 0 ? 80 : 70;
  const light = i % 2 === 0 ? 65 : 60;
  return `hsl(${h} ${sat}% ${light}%)`;
});

// Kept as the public default so existing callers that read it directly
// (e.g. for legend chips) get the light palette. Use `laneColor` for
// rendering.
export const LANE_COLORS = LIGHT_LANE_COLORS;

export function laneColor(colorIndex: number, isDark = false): string {
  const palette = isDark ? DARK_LANE_COLORS : LIGHT_LANE_COLORS;
  return palette[colorIndex % palette.length];
}
