import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useUnsetGitConfig, useWriteGitConfig } from "@/features/repo/hooks/use-git-config";
import { useSigningConfig } from "@/features/repo/hooks/use-status";

type Props = { repoPath: string | null };

export function SigningSection({ repoPath }: Props) {
  const { data, isLoading } = useSigningConfig(repoPath);
  const write = useWriteGitConfig(repoPath);
  const unset = useUnsetGitConfig(repoPath);
  const [key, setKey] = useState("");
  const [format, setFormat] = useState<"openpgp" | "ssh" | "x509">("openpgp");

  useEffect(() => {
    setKey(data?.key ?? "");
    if (data?.format === "ssh" || data?.format === "x509") setFormat(data.format);
    else setFormat("openpgp");
  }, [data]);

  const enabled = data?.enabled ?? false;
  const scope = repoPath ? "repo" : "global";

  const toggle = (next: boolean) => {
    if (next) {
      write.mutate({ key: "commit.gpgsign", value: "true", global: !repoPath });
    } else {
      unset.mutate({ key: "commit.gpgsign", global: !repoPath });
    }
  };

  const saveKey = () => {
    write.mutate({ key: "user.signingkey", value: key.trim(), global: !repoPath });
  };

  const saveFormat = (next: "openpgp" | "ssh" | "x509") => {
    setFormat(next);
    write.mutate({ key: "gpg.format", value: next, global: !repoPath });
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Label className="text-sm font-medium">Commit signing</Label>
        <p className="text-xs text-muted-foreground">
          Etch reads your git config; signing is performed by your installed git, gpg, or ssh agent.
          Scope: <span className="font-mono">{scope}</span>.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Sign commits by default</span>
          <span className="text-xs text-muted-foreground">
            Sets <code>commit.gpgsign</code>. Individual commits can override.
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={toggle}
          disabled={isLoading || write.isPending || unset.isPending}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Signing format</Label>
        <RadioGroup
          value={format}
          onValueChange={(v) => saveFormat(v as typeof format)}
          className="grid grid-cols-3 gap-2"
        >
          {(["openpgp", "ssh", "x509"] as const).map((v) => (
            <Label
              key={v}
              htmlFor={`sign-fmt-${v}`}
              className="flex cursor-pointer items-center justify-between rounded-md border bg-background px-3 py-2 text-sm font-normal hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <span className="uppercase">{v}</span>
              <RadioGroupItem id={`sign-fmt-${v}`} value={v} />
            </Label>
          ))}
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signing-key" className="text-sm font-medium">
          Signing key
        </Label>
        <p className="text-xs text-muted-foreground">
          For GPG: key ID or fingerprint. For SSH: path to public key file. Leave blank to use git's
          default.
        </p>
        <div className="flex gap-2">
          <Input
            id="signing-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={format === "ssh" ? "~/.ssh/id_ed25519.pub" : "ABCDEF1234"}
          />
          <Button onClick={saveKey} disabled={write.isPending}>
            Save
          </Button>
          {data?.key && (
            <Button
              variant="ghost"
              onClick={() => unset.mutate({ key: "user.signingkey", global: !repoPath })}
              disabled={unset.isPending}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
