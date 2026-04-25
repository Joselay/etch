import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Check,
  ExternalLink,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProviderToken } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/stores/repo-store";
import { useUiStore } from "@/stores/ui-store";
import { useGitIdentity, useWriteGitIdentity } from "../hooks/use-git-identity";
import {
  useClearProviderToken,
  useProviderTokens,
  useSetProviderToken,
} from "../hooks/use-provider-tokens";

type Tab = "appearance" | "identity" | "providers";

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const [tab, setTab] = useState<Tab>("appearance");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Tokens are stored in your OS keychain. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="flex max-h-[70vh] flex-col"
        >
          <TabsList className="mx-6 grid w-auto grid-cols-3">
            <TabsTrigger value="appearance">
              <Palette className="h-3.5 w-3.5" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="identity">
              <UserRound className="h-3.5 w-3.5" />
              Identity
            </TabsTrigger>
            <TabsTrigger value="providers">
              <KeyRound className="h-3.5 w-3.5" />
              Providers
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TabsContent value="appearance" className="m-0 flex flex-col gap-4">
              <AppearanceSection />
            </TabsContent>
            <TabsContent value="identity" className="m-0 flex flex-col gap-6">
              <IdentitySection title="Global identity" repoPath={null} />
              <ActiveRepoIdentity />
            </TabsContent>
            <TabsContent value="providers" className="m-0 flex flex-col gap-4">
              <ProvidersSection />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ActiveRepoIdentity() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  if (!activeRepo) return null;
  return (
    <>
      <Separator />
      <IdentitySection title="This repository" repoPath={activeRepo.path} />
    </>
  );
}

function ProvidersSection() {
  const { data, isLoading } = useProviderTokens();
  if (isLoading || !data) {
    return <Skeleton className="h-16 w-full" />;
  }
  return (
    <div className="flex flex-col gap-4">
      {data.map((p, i) => (
        <div key={p.host} className="flex flex-col gap-3">
          {i > 0 && <Separator />}
          <ProviderRow provider={p} />
        </div>
      ))}
    </div>
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
    <div className="flex flex-col gap-3">
      <div>
        <Label className="text-sm font-medium">Theme</Label>
        <p className="text-xs text-muted-foreground">Affects the entire app.</p>
      </div>
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
    </div>
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

  const dirty = !isLoading && ((data?.name ?? "") !== name || (data?.email ?? "") !== email);

  const save = async () => {
    await write.mutateAsync({
      name: name.trim() || (repoPath ? "" : null),
      email: email.trim() || (repoPath ? "" : null),
    });
  };

  const subtitle = repoPath
    ? (repoPath.split(/[\\/]/).filter(Boolean).pop() ?? repoPath)
    : "Used when no per-repo override is set";

  return (
    <section className="flex flex-col gap-3">
      <div>
        <Label className="text-sm font-medium">{title}</Label>
        <p className="truncate text-xs text-muted-foreground" title={repoPath ?? undefined}>
          {subtitle}
        </p>
      </div>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`identity-name-${repoPath ?? "global"}`} className="text-xs">
                Name
              </Label>
              <Input
                id={`identity-name-${repoPath ?? "global"}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={repoPath ? "(use global)" : "Your Name"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`identity-email-${repoPath ?? "global"}`} className="text-xs">
                Email
              </Label>
              <Input
                id={`identity-email-${repoPath ?? "global"}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={repoPath ? "(use global)" : "you@example.com"}
              />
            </div>
          </div>
          <DialogFooter
            className={cn(
              "gap-2 transition-opacity",
              dirty ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setName(data?.name ?? "");
                setEmail(data?.email ?? "");
              }}
              disabled={!dirty || write.isPending}
            >
              Reset
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || write.isPending}>
              {write.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </div>
      )}
    </section>
  );
}

function ProviderRow({ provider }: { provider: ProviderToken }) {
  const [token, setToken] = useState("");
  const save = useSetProviderToken();
  const clear = useClearProviderToken();

  const isDirty = useMemo(() => token.trim().length > 0, [token]);

  const onSave = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    await save.mutateAsync({ host: provider.host, token: trimmed });
    setToken("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium">{provider.label}</span>
          <span className="truncate text-xs text-muted-foreground">{provider.host}</span>
          {provider.hasToken && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Check className="h-3 w-3" />
              Saved
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => openUrl(provider.tokenHelpUrl)}
          className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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
        <Button onClick={onSave} disabled={!isDirty || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
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
