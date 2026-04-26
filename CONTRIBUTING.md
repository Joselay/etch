# Contributing to Etch

Thanks for your interest in contributing! Etch is a cross-platform Git GUI client built with Tauri 2, React 19, and TypeScript.

## Prerequisites

- [Bun](https://bun.sh) (package manager + runtime)
- [Rust](https://rustup.rs) (stable toolchain)
- Tauri OS prerequisites: https://tauri.app/start/prerequisites/

## Getting Started

```bash
bun install
bun run tauri dev
```

For UI-only iteration without the Tauri shell:

```bash
bun run dev
```

## Project Layout

- `src/` — React frontend (Vite). Feature-based: `src/features/<name>/`.
- `src-tauri/` — Rust backend. Git operations live in `src-tauri/src/git/`; Tauri commands in `src-tauri/src/commands/`.
- `src/test/` — Vitest setup + smoke tests.

See [CLAUDE.md](./CLAUDE.md) for the architectural overview.

## Development Workflow

1. Fork and create a topic branch from `main`.
2. Make your changes. Keep the frontend/backend boundary clean — UI never shells out to git directly; go through a Tauri command in `src-tauri/src/commands/`.
3. Run the checks locally:
   ```bash
   bun run typecheck
   bun run lint
   bun run test:run
   ```
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat(repo): …`, `fix(diff): …`, `refactor: …`).
5. Open a pull request against `main`. Fill in the PR template.

## Code Style

Enforced by Biome (not ESLint) — `bun run lint:fix` will auto-fix most issues.

- TypeScript strict mode; no JavaScript files.
- Double quotes, 2-space indent, semicolons, trailing commas, 100-col width.
- `console.log` is banned (`console.warn` / `console.error` only).
- ES modules only — no CommonJS.
- shadcn/ui generated files in `src/components/ui/` are not hand-edited; regenerate via the shadcn CLI.

## UI Conventions

- Tailwind v4 (no `tailwind.config`; CSS lives in `src/App.css`).
- shadcn/ui components on Base UI / Radix primitives, lucide icons.
- Strict neutral grayscale palette — no chromatic accent colors in UI chrome or icons.
- Server state → TanStack Query (persisted). Ephemeral UI state → Zustand. Don't mix.

## Rust / Tauri Conventions

- Git operations shell out via `git/cli.rs` — we do not depend on `git2`.
- New git features go in `src-tauri/src/git/<domain>.rs`, exposed through a thin `#[tauri::command]` in `src-tauri/src/commands/<domain>.rs`, and registered in `lib.rs`.
- Long-running operations should respect cancellation tokens from `cancel.rs`.

## Tests

```bash
bun run test:run                      # one-shot
bun run test:run src/test/smoke.test.ts   # single file
bun run test:ui                       # Vitest UI
```

## Reporting Issues

Use the issue templates. For security issues, see [SECURITY.md](./SECURITY.md) — do not file a public issue.

## License

By contributing, you agree your contributions will be licensed under the [MIT License](./LICENSE).
