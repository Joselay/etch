import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, type ProviderTokenIdentity } from "@/lib/tauri";

export function useProviderTokens() {
  return useQuery({
    queryKey: ["provider-tokens"],
    queryFn: () => api.listProviderTokens(),
    staleTime: 1000 * 60,
  });
}

export function useSetProviderToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { host: string; token: string }) =>
      api.setProviderToken(vars.host, vars.token),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["provider-tokens"] });
      qc.invalidateQueries({ queryKey: ["provider-token-identity", vars.host] });
      qc.invalidateQueries({ queryKey: ["remote-authors"] });
      toast.success(`Saved ${vars.host} token`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useClearProviderToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (host: string) => api.clearProviderToken(host),
    onSuccess: (_d, host) => {
      qc.invalidateQueries({ queryKey: ["provider-tokens"] });
      qc.removeQueries({ queryKey: ["provider-token-identity", host] });
      qc.invalidateQueries({ queryKey: ["remote-authors"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useProviderTokenIdentity(host: string, enabled: boolean) {
  return useQuery<ProviderTokenIdentity, Error>({
    queryKey: ["provider-token-identity", host],
    queryFn: () => api.validateProviderToken(host),
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useValidateProviderToken() {
  return useMutation({
    mutationFn: (vars: { host: string; token: string }) =>
      api.validateProviderToken(vars.host, vars.token),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
