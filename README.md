# Loom

A fast, cross-platform Git GUI client for macOS and Windows, built with [Tauri](https://tauri.app/).

## Tech Stack

- **Runtime:** Tauri 2 (Rust core) + Vite + React 19 + TypeScript
- **UI:** Tailwind CSS v4, shadcn/ui, Base UI, Radix, lucide icons
- **Tooling:** Bun, Biome (lint/format), Vitest

## Development

Requires [Bun](https://bun.sh), [Rust](https://rustup.rs), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
bun install
bun run tauri dev
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

## License

[MIT](./LICENSE)
