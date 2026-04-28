import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AlertCircle,
  CheckCircle2,
  Columns2,
  ExternalLink,
  Eye,
  EyeOff,
  FolderGit2,
  Hash,
  KeyRound,
  Loader2,
  Lock,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Rows2,
  Sun,
  Trash2,
  UserRound,
  WrapText,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProviderToken, ProviderTokenIdentity } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/modal-store";
import { useRepoStore } from "@/stores/repo-store";
import { useUiStore } from "@/stores/ui-store";
import { useGitIdentity, useWriteGitIdentity } from "../hooks/use-git-identity";
import {
  useClearProviderToken,
  useProviderTokenIdentity,
  useProviderTokens,
  useSetProviderToken,
  useValidateProviderToken,
} from "../hooks/use-provider-tokens";
import { GitignoreEditor } from "./gitignore-editor";
import { SigningSection } from "./signing-section";

type Tab = "appearance" | "review" | "identity" | "signing" | "providers" | "repository";

export function SettingsDialog() {
  const open = useModalStore((s) => s.settingsOpen);
  const setOpen = useModalStore((s) => s.setSettingsOpen);
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
          <TabsList className="mx-6 grid w-auto grid-cols-6">
            <TabsTrigger value="appearance">
              <Palette className="h-3.5 w-3.5" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="review">
              <Eye className="h-3.5 w-3.5" />
              Review
            </TabsTrigger>
            <TabsTrigger value="identity">
              <UserRound className="h-3.5 w-3.5" />
              Identity
            </TabsTrigger>
            <TabsTrigger value="signing">
              <Lock className="h-3.5 w-3.5" />
              Signing
            </TabsTrigger>
            <TabsTrigger value="repository">
              <FolderGit2 className="h-3.5 w-3.5" />
              Repository
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
            <TabsContent value="review" className="m-0 flex flex-col gap-6">
              <ReviewSection />
            </TabsContent>
            <TabsContent value="identity" className="m-0 flex flex-col gap-6">
              <IdentitySection title="Global identity" repoPath={null} />
              <ActiveRepoIdentity />
            </TabsContent>
            <TabsContent value="signing" className="m-0 flex flex-col gap-6">
              <SigningSection repoPath={null} />
              <ActiveRepoSigning />
            </TabsContent>
            <TabsContent value="repository" className="m-0 flex flex-col gap-6">
              <RepositorySection />
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

function ActiveRepoSigning() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  if (!activeRepo) return null;
  return (
    <div className="flex flex-col gap-6">
      <Separator />
      <SigningSection repoPath={activeRepo.path} />
    </div>
  );
}

function RepositorySection() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  if (!activeRepo) {
    return (
      <p className="text-sm text-muted-foreground">
        Open a repository to manage its repository-scoped settings.
      </p>
    );
  }
  return <GitignoreEditor repoPath={activeRepo.path} />;
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
  return (
    <div className="flex flex-col gap-4">
      {isLoading || !data ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        data.map((p, i) => (
          <div key={p.host} className="flex flex-col gap-3">
            {i > 0 && <Separator />}
            <ProviderRow provider={p} />
          </div>
        ))
      )}
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

const DIFF_LAYOUT_OPTIONS = [
  { value: "unified", label: "Unified", Icon: Rows2 },
  { value: "split", label: "Split", Icon: Columns2 },
] as const;

function ReviewSection() {
  const diffLayout = useUiStore((s) => s.diffLayout);
  const setDiffLayout = useUiStore((s) => s.setDiffLayout);
  const diffWordWrap = useUiStore((s) => s.diffWordWrap);
  const toggleWrap = useUiStore((s) => s.toggleDiffWordWrap);
  const diffLineNumbers = useUiStore((s) => s.diffLineNumbers);
  const toggleLineNumbers = useUiStore((s) => s.toggleDiffLineNumbers);
  const diffWordHighlight = useUiStore((s) => s.diffWordHighlight);
  const toggleWordHighlight = useUiStore((s) => s.toggleDiffWordHighlight);
  const allBranches = useUiStore((s) => s.commitLogAllBranches);
  const setAllBranches = useUiStore((s) => s.setCommitLogAllBranches);

  return (
    <>
      <section className="flex flex-col gap-3">
        <div>
          <Label className="text-sm font-medium">Diff layout</Label>
          <p className="text-xs text-muted-foreground">
            How added and removed lines are arranged. You can also toggle this from the diff header.
          </p>
        </div>
        <RadioGroup
          value={diffLayout}
          onValueChange={(v) => setDiffLayout(v as "unified" | "split")}
          className="grid grid-cols-2 gap-2"
        >
          {DIFF_LAYOUT_OPTIONS.map(({ value, label, Icon }) => (
            <Label
              key={value}
              htmlFor={`difflayout-${value}`}
              className="flex cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              <RadioGroupItem id={`difflayout-${value}`} value={value} />
            </Label>
          ))}
        </RadioGroup>
      </section>
      <Separator />
      <section className="flex flex-col gap-3">
        <Label className="text-sm font-medium">Diff display</Label>
        <ToggleRow
          icon={<Hash className="h-4 w-4" />}
          title="Show line numbers"
          description="Show old and new line numbers in the gutter."
          checked={diffLineNumbers}
          onChange={toggleLineNumbers}
        />
        <ToggleRow
          icon={<WrapText className="h-4 w-4" />}
          title="Wrap long lines"
          description="Wrap diff lines instead of scrolling horizontally."
          checked={diffWordWrap}
          onChange={toggleWrap}
        />
        <ToggleRow
          icon={<Eye className="h-4 w-4" />}
          title="Highlight word changes"
          description="Emphasize changed words within paired add/remove lines."
          checked={diffWordHighlight}
          onChange={toggleWordHighlight}
        />
      </section>
      <Separator />
      <section className="flex flex-col gap-3">
        <Label className="text-sm font-medium">History</Label>
        <ToggleRow
          icon={<KeyRound className="h-4 w-4" />}
          title="Show all branches by default"
          description="Include commits from every branch in the log, not just the current one."
          checked={allBranches}
          onChange={() => setAllBranches(!allBranches)}
        />
      </section>
    </>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  const id = useId();
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border border-input bg-background px-3 py-2.5 text-sm font-normal hover:bg-accent/60"
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Label>
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
  const [reveal, setReveal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const save = useSetProviderToken();
  const clear = useClearProviderToken();
  const validate = useValidateProviderToken();
  const identity = useProviderTokenIdentity(provider.host, provider.hasToken);

  const trimmed = token.trim();
  const isDirty = trimmed.length > 0;
  const looksLikeGithubToken =
    !isDirty ||
    trimmed.startsWith("ghp_") ||
    trimmed.startsWith("github_pat_") ||
    trimmed.startsWith("gho_");

  const onSave = async () => {
    if (!trimmed) return;
    try {
      await validate.mutateAsync({ host: provider.host, token: trimmed });
    } catch {
      return;
    }
    await save.mutateAsync({ host: provider.host, token: trimmed });
    setToken("");
    setReveal(false);
  };

  const onTest = async () => {
    if (!trimmed) return;
    try {
      const id = await validate.mutateAsync({ host: provider.host, token: trimmed });
      toast.success(`Connected as @${id.login}`);
    } catch {
      // toast already shown by hook
    }
  };

  const onConfirmRemove = async () => {
    await clear.mutateAsync(provider.host);
    setConfirmRemove(false);
    toast.success(`Removed ${provider.host} token`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium">{provider.label}</span>
          <span className="truncate text-xs text-muted-foreground">{provider.host}</span>
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

      {provider.hasToken && (
        <ProviderIdentityCard
          host={provider.host}
          isLoading={identity.isLoading}
          error={identity.error?.message ?? null}
          identity={identity.data ?? null}
          onRecheck={() => identity.refetch()}
          onRemove={() => setConfirmRemove(true)}
          isRemoving={clear.isPending}
        />
      )}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {provider.label} token?</AlertDialogTitle>
            <AlertDialogDescription>
              The token will be deleted from your OS keychain. Author avatars and any authenticated
              GitHub features will fall back to public/anonymous access until you add it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clear.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmRemove} disabled={clear.isPending}>
              {clear.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`token-${provider.host}`} className="text-xs text-muted-foreground">
          {provider.hasToken ? "Replace token" : "Personal access token"}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id={`token-${provider.host}`}
              type={reveal ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={
                provider.hasToken ? "Paste a new token to replace" : "ghp_… or github_pat_…"
              }
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
              }}
              className="pr-9 font-mono text-xs"
              aria-invalid={isDirty && !looksLikeGithubToken}
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={reveal ? "Hide token" : "Show token"}
              tabIndex={-1}
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button
            variant="outline"
            onClick={onTest}
            disabled={!isDirty || validate.isPending || save.isPending}
          >
            {validate.isPending && !save.isPending ? "Testing…" : "Test"}
          </Button>
          <Button onClick={onSave} disabled={!isDirty || save.isPending || validate.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        <p
          className={cn(
            "text-xs",
            isDirty && !looksLikeGithubToken ? "text-destructive" : "text-muted-foreground/80",
          )}
        >
          {isDirty && !looksLikeGithubToken
            ? "Doesn't look like a GitHub token — expected ghp_… or github_pat_…"
            : "Tokens are validated against GitHub before saving and stored in your OS keychain."}
        </p>
      </div>
    </div>
  );
}

function ProviderIdentityCard({
  host,
  isLoading,
  error,
  identity,
  onRecheck,
  onRemove,
  isRemoving,
}: {
  host: string;
  isLoading: boolean;
  error: string | null;
  identity: ProviderTokenIdentity | null;
  onRecheck: () => void;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const isError = !isLoading && (error !== null || identity === null);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2.5",
        isError ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30",
      )}
    >
      <div className="relative shrink-0">
        {identity?.avatarUrl ? (
          <img
            src={identity.avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full grayscale"
            loading="lazy"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <UserRound className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background",
            isLoading ? "bg-muted-foreground/40" : isError ? "bg-destructive" : "bg-foreground",
          )}
          aria-hidden
        >
          {isLoading ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin text-background" />
          ) : isError ? (
            <AlertCircle className="h-2.5 w-2.5 text-destructive-foreground" />
          ) : (
            <CheckCircle2 className="h-2.5 w-2.5 text-background" />
          )}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {isLoading ? (
          <>
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </>
        ) : isError ? (
          <>
            <span className="text-sm font-medium text-destructive">Token not working</span>
            <span className="truncate text-xs text-muted-foreground" title={error ?? undefined}>
              {error ?? `No response from ${host}`}
            </span>
          </>
        ) : (
          identity && (
            <>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                @{identity.login}
                {identity.name && (
                  <span className="truncate font-normal text-muted-foreground">
                    · {identity.name}
                  </span>
                )}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                  {identity.tokenType === "fine-grained"
                    ? "Fine-grained PAT"
                    : identity.tokenType === "classic"
                      ? "Classic PAT"
                      : "Token"}
                </Badge>
                {identity.scopes.length > 0 ? (
                  identity.scopes.slice(0, 4).map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="h-4 px-1.5 font-mono text-[10px] font-normal"
                    >
                      {s}
                    </Badge>
                  ))
                ) : identity.tokenType === "fine-grained" ? (
                  <span className="text-[10px] text-muted-foreground">
                    Permissions managed in GitHub
                  </span>
                ) : null}
                {identity.scopes.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{identity.scopes.length - 4}
                  </span>
                )}
              </div>
            </>
          )
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRecheck}
          disabled={isLoading}
          aria-label="Recheck token"
          title="Recheck"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={isRemoving}
          aria-label="Remove token"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
