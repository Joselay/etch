# Changelog

All notable changes to Etch will be documented in this file.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) where practical. Etch is pre-1.0, so breaking changes can happen between minor releases.

## [Unreleased]

## [0.1.0] - 2026-04-27

This is the first public pre-release of Etch. Treat it as alpha — please report bugs at https://github.com/Joselay/etch/issues.

### Added

- Initial pre-release application foundation for a cross-platform Git GUI built with Tauri, React, TypeScript, and Rust.
- Public project documentation, contribution guide, security policy, issue templates, and `Known limitations` section in the README.
- CI workflow runs typecheck, lint, and tests on Ubuntu, plus Rust clippy + `cargo test` on macOS, Windows, and Linux.
- Release workflow builds draft pre-release artifacts for macOS (aarch64 + x86_64), Linux, and Windows from `v*` tags.

### Security

- **conflict:** Reject path traversal in `resolve_with_content` — a crafted conflict path like `../../.ssh/authorized_keys` could write outside the repo root. (#7)
- **branch:** Validate ref arguments in `checkout`, `checkout_tracking`, `create_branch`, `rename_branch`, and `delete_branch` to block git flag injection via flag-shaped branch names. (#11)
- **rebase:** Validate refs in `preview_todo`, `start_interactive_rebase`, and `start_rebase` (including todo OIDs) so values like `--exec=touch /tmp/pwned` can't reach git as options. (#2)
- **config:** Restrict `cmd_write_git_config` to an allowlist of safe keys; previously any caller could set `core.editor`, `credential.helper`, `gpg.program`, `*.smudge`, `*.textconv`, etc. — a persistent code-execution vector. Also reject control characters in values. (#6)
- **conflict:** Validate file paths in `read_conflict_sides`, `resolve_with`, `mark_resolved`, and `unmark`. Blocks `:HEAD:.git/config`-style git revision injection through `show_stage`. (#1)
- **identity:** Insert `--` separator on every `git config` write for `user.name` / `user.email`, blocking flag-shaped values like `--unset` from mutating other keys. (#24)
- **bisect:** Validate refs through the shared `validate_commit_ish` allowlist so `bisect_start` rejects the same inputs as the rest of the app. (#25)
- **sign:** Canonicalize and bound-check the `commit.template` path so a hostile `.git/config` can't read files outside the repo root. (#26)

### Fixed

- **cli:** Drain stdout/stderr on dedicated reader threads in `wait_with_cancel` so cancellable git ops with verbose output (clone, fetch, log of large repos) no longer deadlock when the OS pipe buffer fills. (#3)
- **rebase:** Preserve the interactive rebase work directory until the rebase actually finishes; `continue_rebase` and `abort_rebase` clean it up afterwards. Previously the temp script was deleted immediately after spawn, corrupting state on conflict-paused rebases. (#8)
- **cancel:** Drop tokens from `CancelRegistry` after cancellable ops complete so the registry no longer grows unbounded over a long session. (#5)
- **bisect:** Drop the misplaced `--` in `bisect_start` — `git bisect start [<bad> [<good>...]] [--] [<paths>...]` treats arguments after `--` as pathspecs, so the bisect feature was broken end-to-end. (#4)
- **remote:** `origin_remote_url` returns `None` (not an error) when no `origin` remote is configured, fixing spurious git errors in PR/CI polling. (#12)
- **log:** Reorder commit log columns so the subject (`%s`) sits last and parse with `splitn(10, '\x1f')` — a literal `\x1f` byte in a commit subject no longer shifts every later column and corrupts dates / parent oids in the graph. (#27)
- **stage:** Detect unborn HEAD in `unstage_paths` and fall back to `git rm --cached` so freshly initialised repos can unstage from the UI without surfacing `fatal: ambiguous argument 'HEAD'`. (#28)

### Performance

- **word-diff:** Bail out before LCS when the token product exceeds 10 000 cells; minified or generated lines no longer freeze the UI. (#9)
