// Compute character-index ranges of changed regions between two strings, by
// tokenising into "words" + whitespace + single punctuation chars and running
// a Hirschberg-like LCS. Used to highlight the substrings that actually
// changed inside paired addition/deletion lines, the way Sublime Merge,
// GitHub, and Fork all do.
//
// We avoid pulling in `diff` / `diff-match-patch` because lines are short,
// the algorithm is small, and the project already ships zero diff deps.

type Range = [number, number];

const WORD_RE = /[A-Za-z0-9_]+|\s+|./gsu;

function tokenize(s: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((m = WORD_RE.exec(s)) !== null) {
    out.push(m[0]);
    if (m[0].length === 0) WORD_RE.lastIndex++;
  }
  return out;
}

// Backtrack through an LCS table to mark which tokens are common.
function commonMask(a: string[], b: string[]): { aCommon: boolean[]; bCommon: boolean[] } {
  const n = a.length;
  const m = b.length;
  const dp: number[] = new Array((n + 1) * (m + 1)).fill(0);
  const idx = (i: number, j: number) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[idx(i, j)] =
        a[i - 1] === b[j - 1]
          ? dp[idx(i - 1, j - 1)] + 1
          : Math.max(dp[idx(i - 1, j)], dp[idx(i, j - 1)]);
    }
  }
  const aCommon = new Array(n).fill(false);
  const bCommon = new Array(m).fill(false);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      aCommon[i - 1] = true;
      bCommon[j - 1] = true;
      i--;
      j--;
    } else if (dp[idx(i - 1, j)] >= dp[idx(i, j - 1)]) {
      i--;
    } else {
      j--;
    }
  }
  return { aCommon, bCommon };
}

function rangesFromMask(tokens: string[], common: boolean[]): Range[] {
  // Precompute character offsets of each token boundary so we can convert
  // token-index ranges into character-index ranges in O(1).
  const offsets: number[] = [];
  let acc = 0;
  for (const t of tokens) {
    offsets.push(acc);
    acc += t.length;
  }
  offsets.push(acc);

  const isWs = (t: string) => /^\s+$/.test(t);

  const out: Range[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (common[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < tokens.length && !common[j]) j++;
    // [i, j) is a contiguous changed run. Trim pure-whitespace tokens at the
    // boundaries — highlighting them adds noise without helping the eye spot
    // the real edit. Whitespace *inside* the run is kept so adjacent changes
    // merge into one visual chunk (e.g. ", c" reads as one inserted argument
    // instead of two pieces).
    let s = i;
    let e = j;
    while (s < e && isWs(tokens[s])) s++;
    while (e > s && isWs(tokens[e - 1])) e--;
    if (s < e) out.push([offsets[s], offsets[e]]);
    i = j;
  }
  return out;
}

export function wordDiffRanges(a: string, b: string): { left: Range[]; right: Range[] } {
  // Skip anything wildly different (the LCS mask would just paint everything).
  if (!a || !b) return { left: [], right: [] };
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  // Cheap escape hatch: if the strings share too few tokens, the highlight
  // becomes visual noise. Bail out and let the line bg do the work.
  if (aTokens.length === 0 || bTokens.length === 0) return { left: [], right: [] };
  const { aCommon, bCommon } = commonMask(aTokens, bTokens);
  return {
    left: rangesFromMask(aTokens, aCommon),
    right: rangesFromMask(bTokens, bCommon),
  };
}
