# Etch

A fast, cross-platform Git GUI client for macOS, Windows and Linux, built with [Tauri](https://tauri.app/).

Etch is early-stage software. The app is usable for local development, but expect rough edges while the project is pre-1.0.

## Features

- Open, clone, and initialize Git repositories
- Review working tree status, staged changes, diffs, and commit history
- Stage, unstage, discard, patch-apply, and commit changes
- Create, rename, checkout, delete, and track branches
- Fetch, pull, push, and manage remotes
- Work with tags, stashes, submodules, worktrees, reflog, blame, bisect, and rebase flows
- Inspect merge conflicts and resolve common conflict states
- Store provider tokens in the native OS keychain for GitHub integration

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
