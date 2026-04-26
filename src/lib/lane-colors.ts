// Lane palette for the commit graph. Intentionally neutral grayscale —
// Etch's UI is strictly black-and-white, so lanes are disambiguated by
// lightness rather than hue. Theming lives here so the layout module
// (`commit-graph.ts`) stays purely algorithmic.

// Eight gray steps spread across the lightness range. Adjacent values
// differ enough to be distinguishable when two lanes draw next to each
// other in the gutter.
const LANE_LIGHTS_LIGHT = [25, 50, 35, 60, 30, 55, 40, 45];
const LANE_LIGHTS_DARK = [85, 60, 75, 50, 80, 55, 70, 65];

const LIGHT_LANE_COLORS = LANE_LIGHTS_LIGHT.map((l) => `hsl(0 0% ${l}%)`);
const DARK_LANE_COLORS = LANE_LIGHTS_DARK.map((l) => `hsl(0 0% ${l}%)`);

// Kept as the public default so callers that read it directly (e.g. for
// legend chips) get the light palette. Use `laneColor` for rendering.
export const LANE_COLORS = LIGHT_LANE_COLORS;

export function laneColor(colorIndex: number, isDark = false): string {
  const palette = isDark ? DARK_LANE_COLORS : LIGHT_LANE_COLORS;
  return palette[colorIndex % palette.length];
}
