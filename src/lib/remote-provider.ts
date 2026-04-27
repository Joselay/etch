export type RemoteProviderKind = "github" | "gitlab" | "unknown";

export type RemoteProvider = {
  kind: RemoteProviderKind;
  label: string;
  host: string | null;
};

export function detectRemoteProvider(url: string | null | undefined): RemoteProvider {
  if (!url) return { kind: "unknown", label: "Git", host: null };
  const host = extractHost(url);
  if (!host) return { kind: "unknown", label: "Git", host: null };

  const h = host.toLowerCase();
  if (h === "github.com" || h.endsWith(".github.com")) {
    return { kind: "github", label: "GitHub", host };
  }
  if (h === "gitlab.com" || h.startsWith("gitlab.") || h.includes(".gitlab.")) {
    return { kind: "gitlab", label: "GitLab", host };
  }
  return { kind: "unknown", label: host, host };
}

function extractHost(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  // SCP-like: git@host:path
  const scp = trimmed.match(/^[\w.-]+@([\w.-]+):/);
  if (scp) return scp[1];
  try {
    const u = new URL(trimmed);
    return u.hostname || null;
  } catch {
    return null;
  }
}
