<div align="center">
  <img src="./docs/assets/logo.svg" alt="Etch" width="96" height="96" />

  <h1>Etch</h1>

  <p><strong>A fast, native Git GUI for macOS, Windows & Linux.</strong><br/>
  Built to make branching, committing, and reviewing code feel effortless.</p>

  <p>
    <a href="./LICENSE"><img src="https://img.shields.io/github/license/Joselay/etch?style=flat-square" alt="License" /></a>
    <a href="https://github.com/Joselay/etch/releases"><img src="https://img.shields.io/github/v/release/Joselay/etch?include_prereleases&style=flat-square" alt="Latest release" /></a>
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square" alt="Platforms" />
    <img src="https://img.shields.io/badge/status-early%20access-blue?style=flat-square" alt="Early access" />
  </p>

  <img src="./docs/assets/etch-demo.webp" alt="Etch demo — multi-repo tabs, ⌘K palette, word-level diff" width="100%" />
</div>

> ⚠️ **Pre-1.0 alpha.** Etch is built and maintained by a single developer. It works for everyday local development, but you _will_ find bugs in less common workflows. Please use it on repositories you can recover (or that are already pushed to a remote), and [open an issue](https://github.com/Joselay/etch/issues/new/choose) when something breaks — that's the fastest way the project improves.

## Why Etch?

- **Native and fast.** Built on Tauri 2 — small binary, low memory, no Electron.
- **Multi-repo tabs.** Switch between repositories the way you switch browser tabs. Sessions persist across restarts.
- **Keyboard-first.** Navigate the graph, stage hunks, and run any command without leaving the home row. `⌘K` opens the palette.
- **Honest visuals.** Strict neutral palette, word-level diffs, readable commit graph — designed to disappear when you're working.
- **Open source.** MIT-licensed, no telemetry, no account required.

## Features

- **Browse:** lane-colored commit graph, word-level diffs with syntax highlighting, blame, bisect, reflog, conflict inspection.
- **Stage:** line- and hunk-level staging, GPG/SSH signed commits, amend / fixup / reword from the history view.
- **Branch & sync:** branches, tags, stashes, worktrees, remotes; GitHub tokens stored in the native OS keychain.
- **Advanced:** interactive rebase (reorder / squash / drop), submodule inspection, multi-repo tabs that persist across restarts.

## Install

Pre-built binaries for macOS, Windows, and Linux are published on the [Releases page](https://github.com/Joselay/etch/releases).

> Release builds are not yet code-signed/notarized. Expect a Gatekeeper / SmartScreen warning on first launch.

### macOS first-launch warning

Because the build isn't notarized yet, macOS will refuse to open Etch on first launch with a message like _"Etch.app is damaged and can't be opened"_ or _"cannot be opened because the developer cannot be verified"_. Strip the quarantine attribute that Safari/Chrome added to the download:

```bash
xattr -dr com.apple.quarantine /Applications/Etch.app
```

Then re-open Etch normally. You only need to do this once per install.

### Windows SmartScreen

On Windows, SmartScreen may show _"Windows protected your PC"_. Click **More info → Run anyway**. Notarized/signed builds are planned before 1.0.

To build from source, see [Development](#development).

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

Before opening a pull request, run:

```bash
bun run typecheck
bun run lint
bun run test:run
cd src-tauri && cargo fmt --all --check && cargo clippy --all-targets --all-features -- -D warnings
```

A full list of scripts and contributor workflow lives in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Use the GitHub issue templates for bugs and feature requests. For security vulnerabilities, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

All participants are expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Tech stack

Tauri 2 (Rust core) + Vite + React 19 + TypeScript. UI built with Tailwind v4, shadcn/ui, Base UI, Radix, and lucide. Tooling: Bun, Biome, Vitest.

## Known limitations

Pre-1.0 areas that are intentionally minimal or untested. Reports and PRs welcome:

- Repos with very large histories (>100k commits) or huge working trees aren't broadly tested.
- Git LFS — basic operations work; locks and custom transfer agents are not exercised.
- Submodules — inspection and common updates only; deeply nested edits may be rough.
- Interactive rebase — common flows work; exotic todo edits and conflicts mid-rebase may need terminal fallback.
- No built-in merge conflict editor — Etch surfaces conflicts but complex three-way merging is best done in your editor.
- Release builds are not yet code-signed/notarized on macOS or Windows.

Release notes live in [CHANGELOG.md](./CHANGELOG.md). Public API and UI can change before 1.0; only `main` receives security fixes.

## License

[MIT](./LICENSE) — built by [@Joselay](https://github.com/Joselay). If Etch is useful to you, [star the repo](https://github.com/Joselay/etch) — it genuinely helps.
