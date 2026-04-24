const hashCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

const GITHUB_NOREPLY_WITH_ID = /^(\d+)\+([^@]+)@users\.noreply\.github\.com$/i;
const GITHUB_NOREPLY_PLAIN = /^([^@+]+)@users\.noreply\.github\.com$/i;

export function githubNoreplyAvatar(email: string, pixelSize: number): string | null {
  const normalized = email.trim().toLowerCase();
  const withId = normalized.match(GITHUB_NOREPLY_WITH_ID);
  if (withId) {
    return `https://avatars.githubusercontent.com/u/${withId[1]}?s=${pixelSize}&v=4`;
  }
  const plain = normalized.match(GITHUB_NOREPLY_PLAIN);
  if (plain) {
    return `https://github.com/${plain[1]}.png?size=${pixelSize}`;
  }
  return null;
}

export async function gravatarHash(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const cached = hashCache.get(normalized);
  if (cached) return cached;
  const pending = inflight.get(normalized);
  if (pending) return pending;

  const task = (async () => {
    const bytes = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    hashCache.set(normalized, hex);
    inflight.delete(normalized);
    return hex;
  })();
  inflight.set(normalized, task);
  return task;
}

export function gravatarUrl(hash: string, pixelSize: number): string {
  return `https://www.gravatar.com/avatar/${hash}?s=${pixelSize}&d=identicon`;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
