import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ExternalLink, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProviderToken } from "@/lib/tauri";
import { useRepoStore } from "@/stores/repo-store";
import { useUiStore } from "@/stores/ui-store";
import { useGitIdentity, useWriteGitIdentity } from "../hooks/use-git-identity";
import {
  useClearProviderToken,
  useProviderTokens,
  useSetProviderToken,
} from "../hooks/use-provider-tokens";

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const { data, isLoading } = useProviderTokens();
  const activeRepo = useRepoStore((s) => s.activeRepo);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your git identity and personal access tokens. Tokens are stored in your OS
            keychain.
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Appearance</h3>
          <AppearanceSection />
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Git identity</h3>
          <IdentitySection title="Global" repoPath={null} />
          {activeRepo && (
            <>
              <Separator />
              <IdentitySection title="This repository" repoPath={activeRepo.path} />
            </>
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Providers</h3>
          {isLoading || !data ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            data.map((p, i) => (
              <div key={p.host} className="flex flex-col gap-3">
                {i > 0 && <Separator />}
                <ProviderRow provider={p} />
              </div>
            ))
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

const THEME_OPTIONS = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <RadioGroup
      value={theme ?? "system"}
      onValueChange={setTheme}
      className="grid grid-cols-3 gap-2"
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => (
        <Label
          key={value}
          htmlFor={`theme-${value}`}
          className="flex cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
        >
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
          </span>
          <RadioGroupItem id={`theme-${value}`} value={value} />
        </Label>
      ))}
    </RadioGroup>
  );
}

function IdentitySection({ title, repoPath }: { title: string; repoPath: string | null }) {
  const { data, isLoading } = useGitIdentity(repoPath);
  const write = useWriteGitIdentity(repoPath);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setName(data?.name ?? "");
    setEmail(data?.email ?? "");
  }, [data]);

  const dirty = (data?.name ?? "") !== name || (data?.email ?? "") !== email;

  const save = async () => {
    // Empty string → unset that key (backend interprets empty as unset).
    await write.mutateAsync({
      name: name.trim() || (repoPath ? "" : null),
      email: email.trim() || (repoPath ? "" : null),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {repoPath && (
          <span className="truncate text-xs text-muted-foreground" title={repoPath}>
            {repoPath.split(/[\\/]/).filter(Boolean).pop()}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`identity-name-${repoPath ?? "global"}`}>Name</Label>
            <Input
              id={`identity-name-${repoPath ?? "global"}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={repoPath ? "(use global)" : "Your Name"}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`identity-email-${repoPath ?? "global"}`}>Email</Label>
            <Input
              id={`identity-email-${repoPath ?? "global"}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={repoPath ? "(use global)" : "you@example.com"}
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={!dirty || write.isPending}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderRow({ provider }: { provider: ProviderToken }) {
  const [token, setToken] = useState("");
  const save = useSetProviderToken();
  const clear = useClearProviderToken();

  const onSave = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    await save.mutateAsync({ host: provider.host, token: trimmed });
    setToken("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{provider.label}</span>
          <span className="text-xs text-muted-foreground">{provider.host}</span>
          {provider.hasToken && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Check className="h-3 w-3" />
              Token saved
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => openUrl(provider.tokenHelpUrl)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Generate token
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`token-${provider.host}`} className="sr-only">
            Token for {provider.label}
          </Label>
          <Input
            id={`token-${provider.host}`}
            type="password"
            autoComplete="off"
            placeholder={provider.hasToken ? "•••••• (replace)" : "Paste personal access token"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
            }}
          />
        </div>
        <Button onClick={onSave} disabled={!token.trim() || save.isPending}>
          Save
        </Button>
        {provider.hasToken && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => clear.mutate(provider.host)}
            disabled={clear.isPending}
            aria-label="Clear token"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
