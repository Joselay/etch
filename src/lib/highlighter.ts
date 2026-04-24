import type { BundledLanguage, BundledTheme, Highlighter, ThemedToken } from "shiki";

export const LIGHT_THEME: BundledTheme = "github-light-default";
export const DARK_THEME: BundledTheme = "github-dark-default";

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();
const pendingLangs = new Map<string, Promise<boolean>>();

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({ themes: [LIGHT_THEME, DARK_THEME], langs: [] }),
    );
  }
  return highlighterPromise;
}

/** Ensure a language grammar is loaded. Resolves to true if usable. */
export function ensureLanguage(lang: string): Promise<boolean> {
  if (loadedLangs.has(lang)) return Promise.resolve(true);
  const existing = pendingLangs.get(lang);
  if (existing) return existing;
  const task = (async () => {
    try {
      const hl = await getHighlighter();
      await hl.loadLanguage(lang as BundledLanguage);
      loadedLangs.add(lang);
      return true;
    } catch {
      return false;
    } finally {
      pendingLangs.delete(lang);
    }
  })();
  pendingLangs.set(lang, task);
  return task;
}

export function tokenizeLine(
  hl: Highlighter,
  code: string,
  lang: string,
  theme: BundledTheme,
): ThemedToken[] | null {
  if (!loadedLangs.has(lang)) return null;
  const lines = hl.codeToTokensBase(code, { lang: lang as BundledLanguage, theme });
  return lines[0] ?? null;
}

export function getHighlighterIfReady(): Highlighter | null {
  return syncHighlighter;
}

let syncHighlighter: Highlighter | null = null;

export async function awaitHighlighter(): Promise<Highlighter> {
  const hl = await getHighlighter();
  syncHighlighter = hl;
  return hl;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  mjs: "js",
  cjs: "js",
  json: "json",
  jsonc: "jsonc",
  md: "md",
  mdx: "mdx",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  rs: "rust",
  go: "go",
  py: "python",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "fish",
  ps1: "powershell",
  sql: "sql",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  svg: "xml",
  vue: "vue",
  svelte: "svelte",
  dart: "dart",
  lua: "lua",
};

const FILENAME_TO_LANG: Record<string, string> = {
  Dockerfile: "docker",
  Makefile: "make",
  ".gitignore": "gitignore",
  ".gitattributes": "gitattributes",
};

export function langFromPath(path: string): string | null {
  const base = path.split("/").pop() ?? path;
  if (FILENAME_TO_LANG[base]) return FILENAME_TO_LANG[base];
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? null;
}
