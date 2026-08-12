import type { DiffHunk } from "./tauri";

export function serializeHunkForClipboard(hunk: DiffHunk): string {
  const lines = [hunk.header.endsWith("\n") ? hunk.header : `${hunk.header}\n`];
  for (const line of hunk.lines) {
    const marker = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
    lines.push(`${marker}${line.content}\n`);
  }
  return lines.join("");
}
