export type RemoteProviderKind = "github" | "gitlab" | "bitbucket" | "unknown";

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
  // Strip a trailing "-suffix" segment to handle SSH config Host aliases like
  // `github.com-personal` or `github.com-work` that users add to ~/.ssh/config
  // when juggling multiple accounts.
  const canonical = h.replace(/-[^.]*$/, "");
  if (canonical === "github.com" || canonical.endsWith(".github.com")) {
    return { kind: "github", label: "GitHub", host };
  }
  if (
    canonical === "gitlab.com" ||
    canonical.startsWith("gitlab.") ||
    canonical.includes(".gitlab.")
  ) {
    return { kind: "gitlab", label: "GitLab", host };
  }
  if (
    canonical === "bitbucket.org" ||
    canonical.endsWith(".bitbucket.org") ||
    canonical.startsWith("bitbucket.") ||
    canonical.includes(".bitbucket.")
  ) {
    return { kind: "bitbucket", label: "Bitbucket", host };
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
