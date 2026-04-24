export type ConflictBlock = {
  start: number;
  oursLabel: string;
  ours: string[];
  baseLabel: string | null;
  base: string[] | null;
  theirsLabel: string;
  theirs: string[];
  end: number;
};

export type ConflictSegment =
  | { kind: "context"; lines: string[]; startLine: number }
  | { kind: "conflict"; block: ConflictBlock };

const OURS_RE = /^<{7}\s*(.*)$/;
const BASE_RE = /^\|{7}\s*(.*)$/;
const SEP_RE = /^={7}\s*$/;
const THEIRS_RE = /^>{7}\s*(.*)$/;

export function parseConflictSegments(content: string): ConflictSegment[] {
  const lines = content.split("\n");
  const segments: ConflictSegment[] = [];
  let i = 0;
  let contextStart = 0;
  let context: string[] = [];

  const flushContext = () => {
    if (context.length > 0) {
      segments.push({ kind: "context", lines: context, startLine: contextStart });
      context = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const oursMatch = line.match(OURS_RE);
    if (!oursMatch) {
      if (context.length === 0) contextStart = i;
      context.push(line);
      i++;
      continue;
    }

    // Start of a conflict block.
    const start = i;
    const oursLabel = oursMatch[1];
    const ours: string[] = [];
    let baseLabel: string | null = null;
    let base: string[] | null = null;
    let theirsLabel = "";
    const theirs: string[] = [];

    i++;
    while (i < lines.length && !SEP_RE.test(lines[i]) && !BASE_RE.test(lines[i])) {
      ours.push(lines[i]);
      i++;
    }
    if (i < lines.length && BASE_RE.test(lines[i])) {
      const m = lines[i].match(BASE_RE);
      baseLabel = m?.[1] ?? "";
      base = [];
      i++;
      while (i < lines.length && !SEP_RE.test(lines[i])) {
        base.push(lines[i]);
        i++;
      }
    }
    if (i >= lines.length || !SEP_RE.test(lines[i])) {
      // Malformed block — treat the marker line as context and bail.
      if (context.length === 0) contextStart = start;
      context.push(lines[start]);
      i = start + 1;
      continue;
    }
    i++; // skip =======
    while (i < lines.length && !THEIRS_RE.test(lines[i])) {
      theirs.push(lines[i]);
      i++;
    }
    if (i >= lines.length) {
      // No closing marker; treat as context.
      if (context.length === 0) contextStart = start;
      context.push(lines[start]);
      i = start + 1;
      continue;
    }
    const theirsMatch = lines[i].match(THEIRS_RE);
    theirsLabel = theirsMatch?.[1] ?? "";
    const end = i;
    i++;

    flushContext();
    segments.push({
      kind: "conflict",
      block: { start, oursLabel, ours, baseLabel, base, theirsLabel, theirs, end },
    });
  }
  flushContext();
  return segments;
}

export function hasConflictMarkers(content: string): boolean {
  return /^<{7}/m.test(content) && /^={7}\s*$/m.test(content) && /^>{7}/m.test(content);
}
