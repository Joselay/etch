import manifest from "material-icon-theme/dist/material-icons.json";

const svgUrls = import.meta.glob<string>("/node_modules/material-icon-theme/icons/*.svg", {
  query: "?url",
  import: "default",
  eager: true,
});

const urlByName = new Map<string, string>();
for (const [fullPath, url] of Object.entries(svgUrls)) {
  const name = fullPath
    .split("/")
    .pop()
    ?.replace(/\.svg$/, "");
  if (name) urlByName.set(name, url);
}

type Manifest = {
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  file: string;
};
const m = manifest as unknown as Manifest;

const EXTENSION_OVERRIDES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  cjs: "javascript",
  php: "php",
  yml: "yaml",
  yaml: "yaml",
  html: "html",
  htm: "html",
};

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

function resolveIconName(path: string): string {
  const name = basename(path).toLowerCase();
  if (m.fileNames[name]) return m.fileNames[name];

  const segments = name.split(".");
  for (let i = 1; i < segments.length; i++) {
    const ext = segments.slice(i).join(".");
    const hit = m.fileExtensions[ext] ?? EXTENSION_OVERRIDES[ext];
    if (hit) return hit;
  }
  return m.file;
}

export function getFileIconUrl(path: string): string | undefined {
  const icon = resolveIconName(path);
  return urlByName.get(icon) ?? urlByName.get(m.file);
}
