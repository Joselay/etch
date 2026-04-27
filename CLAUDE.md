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
  - Shared: `src/stores/` (Zustand: `repo-store`, `selection-store`, `ui-store`, `file-tree-store`, `modal-store`), `src/lib/` (notable: `query-client.ts` wires TanStack Query + sync-storage persister; `tauri.ts` wraps `invoke`; `command-registry.tsx` + `menu-events.ts` + `shortcut-format.tsx` back the command palette / native menu bridge; `highlighter.ts` wraps Shiki; `file-tree.ts` / `file-icon.ts` build tree models and map paths via `material-icon-theme`; `commit-graph.ts` + `lane-colors.ts` lay out and color the log graph; `patch.ts` + `word-diff.ts` + `conflict-markers.ts` parse and present diffs; `avatar.ts` resolves commit avatars; `undo-toast.tsx` wraps Sonner for undoable actions; `utils.ts` = shadcn `cn`), `src/hooks/`, `src/components/`.
  - Server state → TanStack Query (persisted); ephemeral UI/selection state → Zustand. Don't mix.
- **Rust backend** (`src-tauri/src/`): `main.rs` is a thin entry; `lib.rs::run()` only wires plugins (`tauri-plugin-opener`, `tauri-plugin-dialog`, `tauri-plugin-store` — the last is where persisted settings live), `.manage(WatcherState)`, calls `settings::init(app)` in `.setup`, builds the native menu via `menu::build`, and registers commands via `.invoke_handler(tauri::generate_handler![...])`.
  - `commands/<domain>.rs` (`repo.rs`, `settings.rs`) — thin `#[tauri::command]` handlers; add new commands here and register them in `lib.rs`, then call via `@tauri-apps/api`'s `invoke`.
  - `git/` — all git operations, one module per domain (`branch`, `blame`, `bisect`, `config`, `conflict`, `diff`, `identity`, `ignore`, `lfs`, `log`, `rebase`, `reflog`, `refs`, `remote`, `repo`, `sign`, `stage`, `stash`, `state`, `status`, `submodule`, `tags`, `validate`, `worktree`). All shell out through `git/cli.rs` (no `git2` crate). New git features go here as a new module, not inline in commands.
  - `providers/` — external provider integrations (e.g. `github.rs`). `settings.rs` — persisted app settings. `watcher.rs` — FS watcher state shared across commands. `cancel.rs` — cooperative cancellation tokens for long-running git ops. `menu.rs` — native app menu + accelerator wiring. `error.rs` — unified error type.
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
