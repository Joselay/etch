import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProviderToken } from "@/lib/tauri";
import { useUiStore } from "@/stores/ui-store";
import {
  useClearProviderToken,
  useProviderTokens,
  useSetProviderToken,
} from "../hooks/use-provider-tokens";

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const { data, isLoading } = useProviderTokens();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Personal access tokens are stored in your OS keychain. They unlock private-repo metadata
            (avatars, author info) from forges like GitHub.
          </DialogDescription>
        </DialogHeader>

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
