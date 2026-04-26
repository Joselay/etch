// Lane palette for the commit graph. Documented exception to Etch's
// otherwise strict B&W chrome: branch lanes are a categorical encoding
// (data viz), and hue is the only channel that lets adjacent lanes be
// parsed quickly when they run in parallel through the gutter. Keep these
// colors scoped to the graph itself — do not reuse for icons, status text,
// or anything in the surrounding chrome.

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

// Kept as the public default so callers that read it directly (e.g. for
// legend chips) get the light palette. Use `laneColor` for rendering.
export const LANE_COLORS = LIGHT_LANE_COLORS;

export function laneColor(colorIndex: number, isDark = false): string {
  const palette = isDark ? DARK_LANE_COLORS : LIGHT_LANE_COLORS;
  return palette[colorIndex % palette.length];
}
