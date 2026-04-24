import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/tauri";

function invalidateRepo(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["refs", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
  qc.invalidateQueries({ queryKey: ["commit-log", path] });
  qc.invalidateQueries({ queryKey: ["repo", path] });
}

function onError(err: unknown) {
  toast.error((err as Error).message || "git error");
}

export function useCreateBranch(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; startPoint?: string | null }) =>
      api.createBranch(path, vars.name, vars.startPoint ?? null),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(`Created branch ${vars.name}`);
    },
    onError,
  });
}

export function useCheckout(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { target: string; create?: boolean }) =>
      api.checkout(path, vars.target, vars.create ?? false),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(`Switched to ${vars.target}`);
    },
    onError,
  });
}

export function useCheckoutTracking(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { localName: string; upstream: string }) =>
      api.checkoutTracking(path, vars.localName, vars.upstream),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(`Tracking ${vars.upstream} as ${vars.localName}`);
    },
    onError,
  });
}

export function useDeleteBranch(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; force?: boolean }) =>
      api.deleteBranch(path, vars.name, vars.force ?? false),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(`Deleted ${vars.name}`);
    },
    // do not toast on error — caller may want to offer force fallback
  });
}

export function useRenameBranch(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { oldName: string; newName: string; force?: boolean }) =>
      api.renameBranch(path, vars.oldName, vars.newName, vars.force ?? false),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(`Renamed to ${vars.newName}`);
    },
    onError,
  });
}
