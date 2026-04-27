# Etch

A fast, cross-platform Git GUI client for macOS, Windows and Linux, built with [Tauri](https://tauri.app/).

> ⚠️ **Pre-1.0 alpha.** Etch is built and maintained by a single developer. It works for everyday local development, but you _will_ find bugs in less common workflows. Please use it on repositories you can recover (or that are already pushed to a remote), and [open an issue](https://github.com/Joselay/etch/issues/new/choose) when something breaks — that's the fastest way the project improves.

## Features

- Open, clone, and initialize Git repositories
- Review working tree status, staged changes, diffs, and commit history
- Stage, unstage, discard, patch-apply, and commit changes
- Create, rename, checkout, delete, and track branches
- Fetch, pull, push, and manage remotes
- Work with tags, stashes, submodules, worktrees, reflog, blame, bisect, and rebase flows
- Inspect merge conflicts and resolve common conflict states
- Store provider tokens in the native OS keychain for GitHub integration

## Known limitations

These are areas that are intentionally minimal or untested in v0.1. Reports and PRs welcome:

- **Large repositories** — performance on repos with very large histories (>100k commits) or huge working trees has not been broadly tested.
- **Git LFS** — basic operations work; less common LFS flows (locks, custom transfer agents) are not exercised.
- **Submodules** — supported for inspection and common updates; deeply nested or recursive submodule edits may be rough.
- **Interactive rebase** — works for common reorder/squash/drop flows; exotic todo edits and conflicts mid-rebase may need terminal fallback.
- **Signed commits / SSH signing** — basic GPG/SSH signing is wired through `git`; advanced key configurations may not surface helpful errors.
- **Windows path edge cases** — long paths, case-insensitive collisions, and CRLF behaviors are less tested than macOS/Linux.
- **Monorepos with sparse checkout / partial clone** — not specifically optimized.
- **No built-in merge conflict editor** — Etch surfaces conflicts and lets you resolve files; complex three-way merging is best done in your editor.
- **Code signing** — current release builds are not yet code-signed/notarized on macOS or Windows. Expect OS warnings on first launch.

## Tech Stack

- **Runtime:** Tauri 2 (Rust core) + Vite + React 19 + TypeScript
- **UI:** Tailwind CSS v4, shadcn/ui, Base UI, Radix, lucide icons
- **Tooling:** Bun, Biome (lint/format), Vitest

## Status

Etch is open source under the MIT License and accepts contributions through GitHub issues and pull requests.

Current project expectations:

- Public API and UI workflows can change before 1.0.
- Only the `main` branch receives security fixes.
- Release builds are produced from `v*` tags through GitHub Actions.

## Development

Requires [Bun](https://bun.sh), [Rust](https://rustup.rs), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
bun install
bun run tauri dev
```

For UI-only iteration without the Tauri shell:

```bash
bun run dev
```

## Scripts

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `bun run dev`         | Run Vite dev server (web only)  |
| `bun run tauri dev`   | Run Tauri app in dev mode       |
| `bun run build`       | Type-check and build web assets |
| `bun run tauri build` | Build native installers         |
| `bun run typecheck`   | Type-check without emitting     |
| `bun run lint`        | Biome lint + format check       |
| `bun run lint:fix`    | Apply safe Biome fixes          |
| `bun run format`      | Format with Biome               |
| `bun run test`        | Run Vitest in watch mode        |
| `bun run test:run`    | Run Vitest once                 |

## Checks

Run these before opening a pull request:

```bash
bun run typecheck
bun run lint
bun run test:run
cd src-tauri && cargo fmt --all --check && cargo clippy --all-targets --all-features -- -D warnings
```

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Use the GitHub issue templates for bugs and feature requests. For security vulnerabilities, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

All participants are expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Releases

Release notes are tracked in [CHANGELOG.md](./CHANGELOG.md). Maintainers can create a release by pushing a version tag such as `v0.1.0`; the release workflow builds draft artifacts for macOS, Windows, and Linux.

## License

[MIT](./LICENSE)
