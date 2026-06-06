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
  iconDefinitions: Record<string, { iconPath: string }>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  file: string;
};
const m = manifest as unknown as Manifest;

const NEST_EXTENSION_OVERRIDES: Record<string, string> = {
  "controller.ts": "nest-controller",
  "controller.js": "nest-controller",
  "decorator.ts": "nest-decorator",
  "decorator.js": "nest-decorator",
  "filter.ts": "nest-filter",
  "filter.js": "nest-filter",
  "gateway.ts": "nest-gateway",
  "gateway.js": "nest-gateway",
  "guard.ts": "nest-guard",
  "guard.js": "nest-guard",
  "interceptor.ts": "nest-interceptor",
  "interceptor.js": "nest-interceptor",
  "middleware.ts": "nest-middleware",
  "middleware.js": "nest-middleware",
  "module.ts": "nest-module",
  "module.js": "nest-module",
  "pipe.ts": "nest-pipe",
  "pipe.js": "nest-pipe",
  "resolver.ts": "nest-resolver",
  "resolver.js": "nest-resolver",
  "service.ts": "nest-service",
  "service.js": "nest-service",
};

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
  // Filename mappings are case-sensitive in the manifest (e.g. `CLAUDE.md`,
  // `Dockerfile`). Try the original casing first, fall back to lowercase
  // for entries like `readme.md` / `license`.
  const raw = basename(path);
  const lower = raw.toLowerCase();
  if (m.fileNames[raw]) return m.fileNames[raw];
  if (m.fileNames[lower]) return m.fileNames[lower];

  // Extensions are always lowercase in the manifest.
  const segments = lower.split(".");
  for (let i = 1; i < segments.length; i++) {
    const ext = segments.slice(i).join(".");
    const hit = NEST_EXTENSION_OVERRIDES[ext] ?? m.fileExtensions[ext] ?? EXTENSION_OVERRIDES[ext];
    if (hit) return hit;
  }
  return m.file;
}

function iconAssetName(icon: string): string {
  const iconPath = m.iconDefinitions[icon]?.iconPath;
  return (
    iconPath
      ?.split("/")
      .pop()
      ?.replace(/\.svg$/, "") ?? icon
  );
}

export function getFileIconUrl(path: string): string | undefined {
  const icon = resolveIconName(path);
  return urlByName.get(iconAssetName(icon)) ?? urlByName.get(icon) ?? urlByName.get(m.file);
}
