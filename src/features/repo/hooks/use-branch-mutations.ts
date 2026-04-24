import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ResetMode, toastGitError } from "@/lib/tauri";

function invalidateRepo(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["refs", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
  qc.invalidateQueries({ queryKey: ["commit-log", path] });
  qc.invalidateQueries({ queryKey: ["upstream-status", path] });
  qc.invalidateQueries({ queryKey: ["repo", path] });
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
    onError: toastGitError,
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
    onError: toastGitError,
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
    onError: toastGitError,
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

export function useMerge(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { target: string; noFf?: boolean }) =>
      api.merge(path, vars.target, vars.noFf ?? false),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(`Merged ${vars.target}`);
    },
    onError: toastGitError,
  });
}

export function useRevert(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { commit: string; noEdit?: boolean }) =>
      api.revert(path, vars.commit, vars.noEdit ?? true),
    onSuccess: () => {
      invalidateRepo(qc, path);
      toast.success("Revert commit created");
    },
    onError: toastGitError,
  });
}

export function useCherryPick(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commit: string) => api.cherryPick(path, commit),
    onSuccess: (_d, commit) => {
      invalidateRepo(qc, path);
      toast.success(`Cherry-picked ${commit.slice(0, 7)}`);
    },
    onError: toastGitError,
  });
}

export function useReset(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { target: string; mode: ResetMode }) =>
      api.reset(path, vars.target, vars.mode),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      qc.invalidateQueries({ queryKey: ["working-diff", path] });
      toast.success(`Reset (${vars.mode}) to ${vars.target.slice(0, 7)}`);
    },
    onError: toastGitError,
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
    onError: toastGitError,
  });
}
