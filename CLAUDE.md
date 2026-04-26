# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Etch is a cross-platform Git GUI client (macOS/Windows/Linux) built with Tauri 2 (Rust core) + Vite + React 19 + TypeScript.

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
  - Feature-based layout: `src/features/<name>/` (currently `repo`, `settings`) owns its components/hooks. Keep route-level files thin.
  - Shared: `src/stores/` (Zustand: `repo-store`, `selection-store`, `ui-store`), `src/lib/` (`query-client.ts` wires TanStack Query + sync-storage persister, `tauri.ts` wraps `invoke`, `highlighter.ts` wraps Shiki, `file-tree.ts` builds tree models, `file-icon.ts` maps paths via `material-icon-theme`, `commit-graph.ts` lays out the log graph, `patch.ts` parses unified diffs, `avatar.ts` resolves commit avatars, `utils.ts` = shadcn `cn`), `src/hooks/`, `src/components/`.
  - Server state → TanStack Query (persisted); ephemeral UI/selection state → Zustand. Don't mix.
- **Rust backend** (`src-tauri/src/`): `main.rs` is a thin entry; `lib.rs::run()` only wires plugins (`tauri-plugin-opener`, `tauri-plugin-dialog`, `tauri-plugin-store` — the last is where persisted settings live), `.manage(WatcherState)`, calls `settings::init(app)` in `.setup`, and registers commands via `.invoke_handler(tauri::generate_handler![...])`.
  - `commands/<domain>.rs` (`repo.rs`, `settings.rs`) — thin `#[tauri::command]` handlers; add new commands here and register them in `lib.rs`, then call via `@tauri-apps/api`'s `invoke`.
  - `git/` — all git operations (`branch`, `blame`, `diff`, `identity`, `log`, `refs`, `remote`, `repo`, `stage`, `stash`, `state`, `status`, `tags`). These shell out through `git/cli.rs` (no `git2` crate). New git features go here, not inline in commands.
  - `providers/` — external provider integrations (e.g. `github.rs`). `settings.rs` — persisted app settings. `watcher.rs` — FS watcher state shared across commands. `error.rs` — unified error type.
  - Tauri config: `src-tauri/tauri.conf.json`; per-window capabilities: `src-tauri/capabilities/`.
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
