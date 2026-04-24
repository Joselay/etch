# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Loom is a cross-platform Git GUI client (macOS/Windows) built with Tauri 2 (Rust core) + Vite + React 19 + TypeScript.

## Commands

- `bun install` — install JS deps (Rust deps resolve on first Tauri build)
- `bun run tauri dev` — run the full desktop app in dev mode (use this, not `bun run dev`, for anything that touches the Rust side)
- `bun run dev` — Vite-only dev server on port 1420 (web UI without Tauri shell)
- `bun run build` — `tsc && vite build` (type-check + bundle web assets)
- `bun run tauri build` — produce native installers
- `bun run typecheck` — `tsc --noEmit`
- `bun run lint` / `bun run lint:fix` — Biome check (+ safe fixes)
- `bun run format` — Biome format
- `bun run test` / `bun run test:run` — Vitest (watch / one-shot); `bun run test:ui` for the UI
- Single test file: `bun run test:run src/test/smoke.test.ts`; single test: add `-t "name"`

## Architecture

Two-process app. Keep the boundary clean:

- **Frontend** (`src/`): React 19 + Vite, entrypoint `src/main.tsx` → `src/App.tsx`. Tailwind v4 via `@tailwindcss/vite` (CSS in `src/App.css`, no `tailwind.config`). Path alias `@/* → src/*`.
- **Rust backend** (`src-tauri/src/`): `main.rs` is a thin entry; real setup is in `lib.rs::run()` where the `tauri::Builder` registers plugins and `#[tauri::command]` handlers via `invoke_handler!`. Add new commands there, then call them from the frontend with `@tauri-apps/api`'s `invoke`. Tauri config lives in `src-tauri/tauri.conf.json`; per-window capabilities in `src-tauri/capabilities/`.
- **Dev server contract**: Tauri expects Vite on a fixed port 1420 (`strictPort: true`) and ignores `src-tauri/**` from watch — don't change these without updating `tauri.conf.json` in lockstep.

## UI conventions

- shadcn/ui (`components.json`, style `radix-nova`, base color `neutral`, icons `lucide`) with Base UI + Radix primitives. Component aliases: `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`.
- `src/components/ui/` is generated shadcn output — Biome excludes it (`!src/components/ui` in `biome.json`). Don't hand-edit; regenerate via shadcn CLI.

## Code style (enforced by Biome, not ESLint)

- Double quotes, 2-space indent, semicolons, trailing commas, 100-col line width, arrow parens always.
- `noConsole` is an **error** — only `console.warn` / `console.error` are allowed.
- Imports are auto-organized by Biome's assist (`organizeImports: on`).
- TS strict + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch` are on.

## Testing

Vitest with jsdom + `@testing-library/react` + `@testing-library/jest-dom`. Globals enabled (no need to import `describe`/`it`). Setup: `src/test/setup.ts`. Tests live alongside code or in `src/test/`.
