import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ResetMode, type TodoEntry, toastGitError } from "@/lib/tauri";
import { toastUndoable } from "@/lib/undo-toast";

function invalidateRepo(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["refs", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
  qc.invalidateQueries({ queryKey: ["commit-log", path] });
  qc.invalidateQueries({ queryKey: ["upstream-status", path] });
  qc.invalidateQueries({ queryKey: ["repo", path] });
  qc.invalidateQueries({ queryKey: ["repo-state", path] });
  qc.invalidateQueries({ queryKey: ["conflicts", path] });
  qc.invalidateQueries({ queryKey: ["working-diff", path] });
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
    mutationFn: async (vars: { name: string; force?: boolean; target?: string | null }) => {
      const [upstreamRemote, upstreamMerge] = await Promise.all([
        api.readGitConfig(path, `branch.${vars.name}.remote`, false).catch(() => null),
        api.readGitConfig(path, `branch.${vars.name}.merge`, false).catch(() => null),
      ]);
      await api.deleteBranch(path, vars.name, vars.force ?? false);
      return { upstreamRemote, upstreamMerge, target: vars.target ?? null };
    },
    onSuccess: (snap, vars) => {
      invalidateRepo(qc, path);
      if (!snap.target) {
        toast.success(`Deleted ${vars.name}`);
        return;
      }
      const target = snap.target;
      toastUndoable(`Deleted ${vars.name}`, async () => {
        try {
          await api.createBranch(path, vars.name, target);
          if (snap.upstreamRemote && snap.upstreamMerge) {
            const remoteBranch = snap.upstreamMerge.replace(/^refs\/heads\//, "");
            await api
              .setUpstream(path, vars.name, snap.upstreamRemote, remoteBranch)
              .catch(() => {});
          }
          invalidateRepo(qc, path);
          toast.success(`Restored ${vars.name}`);
        } catch (err) {
          toastGitError(err);
        }
      });
    },
    // do not toast on error — caller may want to offer force fallback
  });
}

export function useMerge(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { target: string; noFf?: boolean; squash?: boolean }) =>
      api.merge(path, vars.target, { noFf: vars.noFf, squash: vars.squash }),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(vars.squash ? `Squash-merged ${vars.target}` : `Merged ${vars.target}`);
    },
    onError: toastGitError,
  });
}

export function useStartRebase(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { onto: string; upstream?: string | null }) =>
      api.startRebase(path, vars.onto, vars.upstream ?? null),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(`Rebasing onto ${vars.onto}`);
    },
    onError: toastGitError,
  });
}

export function useStartInteractiveRebase(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { onto: string; upstream: string; todo: TodoEntry[] }) =>
      api.startInteractiveRebase(path, vars.onto, vars.upstream, vars.todo),
    onSuccess: (_d, vars) => {
      invalidateRepo(qc, path);
      toast.success(`Rebasing onto ${vars.onto}`);
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
    mutationFn: async (vars: { target: string; mode: ResetMode }) => {
      const refs = await api.listRefs(path);
      const prevHead = refs.headCommitId;
      await api.reset(path, vars.target, vars.mode);
      return { prevHead };
    },
    onSuccess: (snap, vars) => {
      invalidateRepo(qc, path);
      qc.invalidateQueries({ queryKey: ["working-diff", path] });
      const message = `Reset (${vars.mode}) to ${vars.target.slice(0, 7)}`;
      // Only soft/mixed are losslessly reversible — hard reset may have already
      // discarded uncommitted work that we cannot bring back.
      if (!snap.prevHead || vars.mode === "hard") {
        toast.success(message);
        return;
      }
      const prev = snap.prevHead;
      toastUndoable(message, async () => {
        try {
          await api.reset(path, prev, vars.mode);
          invalidateRepo(qc, path);
          qc.invalidateQueries({ queryKey: ["working-diff", path] });
          toast.success(`Reset back to ${prev.slice(0, 7)}`);
        } catch (err) {
          toastGitError(err);
        }
      });
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
      toastUndoable(`Renamed to ${vars.newName}`, async () => {
        try {
          await api.renameBranch(path, vars.newName, vars.oldName, false);
          invalidateRepo(qc, path);
          toast.success(`Renamed back to ${vars.oldName}`);
        } catch (err) {
          toastGitError(err);
        }
      });
    },
    onError: toastGitError,
  });
}
