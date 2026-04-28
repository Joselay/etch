import { ask, message } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";

let inFlight: { promise: Promise<void>; silent: boolean } | null = null;

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Silent mode: only surface a toast/dialog when an update exists. Used for
// the once-per-session background check on launch. Manual mode (menu /
// command palette) also surfaces "you're up to date" and errors so the
// user gets feedback for an action they took. If a manual call arrives
// while a silent check is in flight, upgrade it so the user still gets
// feedback — otherwise the click would silently no-op.
export function checkForUpdates(opts: { silent?: boolean } = {}): Promise<void> {
  const silent = opts.silent ?? false;
  if (inFlight) {
    if (!silent) inFlight.silent = false;
    return inFlight.promise;
  }
  const state = { promise: Promise.resolve(), silent };
  state.promise = run(state).finally(() => {
    inFlight = null;
  });
  inFlight = state;
  return state.promise;
}

async function run(state: { silent: boolean }): Promise<void> {
  let update: Awaited<ReturnType<typeof check>> = null;
  try {
    update = await check();
  } catch (err) {
    if (!state.silent) {
      await message(`Could not check for updates: ${errMessage(err)}`, {
        title: "Update check failed",
        kind: "error",
      });
    } else {
      console.warn("Update check failed:", err);
    }
    return;
  }

  if (!update) {
    if (!state.silent) toast.success("You're on the latest version.");
    return;
  }

  const proceed = await ask(
    `Etch ${update.version} is available (you have ${update.currentVersion}).\n\nDownload and install now? The app will restart.`,
    { title: "Update available", kind: "info", okLabel: "Install", cancelLabel: "Later" },
  );
  if (!proceed) return;

  const t = toast.loading(`Downloading Etch ${update.version}…`);
  try {
    let downloaded = 0;
    let total = 0;
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? 0;
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          if (total > 0) {
            const pct = Math.min(100, Math.round((downloaded / total) * 100));
            toast.loading(`Downloading Etch ${update.version}… ${pct}%`, { id: t });
          } else {
            toast.loading(`Downloading Etch ${update.version}… ${formatBytes(downloaded)}`, {
              id: t,
            });
          }
          break;
        case "Finished":
          toast.loading("Installing…", { id: t });
          break;
      }
    });
    toast.success("Update installed. Restarting…", { id: t });
    await relaunch();
  } catch (err) {
    toast.error(`Update failed: ${errMessage(err)}`, { id: t });
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
