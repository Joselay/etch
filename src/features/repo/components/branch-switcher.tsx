import { Check, ChevronDown, GitBranch, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCheckout } from "../hooks/use-branch-mutations";
import { useRefs } from "../hooks/use-refs";
import { CreateBranchDialog } from "./create-branch-dialog";

type Props = {
  repoPath: string;
  label: string;
};

export function BranchSwitcher({ repoPath, label }: Props) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { data } = useRefs(repoPath);
  const checkout = useCheckout(repoPath);

  const locals = data?.local ?? [];

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" className="h-7 gap-1.5 px-2 font-normal">
            <GitBranch className="h-3 w-3" />
            <span className="max-w-[20ch] truncate">{label}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Switch branch..." />
            <CommandList>
              <CommandEmpty>No branches</CommandEmpty>
              <CommandGroup heading="Local">
                {locals.map((b) => (
                  <CommandItem
                    key={b.fullName}
                    value={b.name}
                    onSelect={() => {
                      if (!b.isHead) checkout.mutate({ target: b.name });
                      setOpen(false);
                    }}
                  >
                    <Check className={`h-3.5 w-3.5 ${b.isHead ? "opacity-100" : "opacity-0"}`} />
                    <span className="truncate">{b.name}</span>
                    {b.isHead && (
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        current
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New branch from HEAD
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <CreateBranchDialog
        repoPath={repoPath}
        open={createOpen}
        onOpenChange={setCreateOpen}
        startPoint={null}
      />
    </>
  );
}
