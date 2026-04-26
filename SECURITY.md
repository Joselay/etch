# Security Policy

## Supported Versions

Etch is pre-1.0 and under active development. Only the `main` branch receives security fixes.

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report vulnerabilities privately via GitHub's [Security Advisories](https://github.com/Joselay/etch/security/advisories/new) form, or email the maintainer at tongmenglaysmae5@gmail.com with:

- A description of the issue and its impact
- Steps to reproduce (proof-of-concept welcome)
- The affected version or commit

You should receive an acknowledgement within 7 days. Once the issue is confirmed, we will work on a fix and coordinate a disclosure timeline with you.

## Scope

In scope:

- The Etch desktop application (Tauri shell, Rust backend, React frontend)
- Git command execution paths in `src-tauri/src/git/`
- Tauri command handlers in `src-tauri/src/commands/`
- Persisted settings and credentials handling

Out of scope:

- Vulnerabilities in upstream dependencies (please report to those projects directly)
- Issues requiring physical access to an unlocked machine
- Social-engineering attacks
