"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API, queryKeys } from "@/lib/constants";
import type { SavedAgent } from "@/types/saved-agent";

export function useSavedAgents(workspace: string) {
  return useQuery({
    queryKey: queryKeys.savedAgents.all(workspace),
    queryFn: () => api.get<SavedAgent[]>(API.SAVED_AGENTS.LIST(workspace)),
    enabled: !!workspace,
  });
}

export function useRunSavedAgent() {
  return useMutation({
    mutationFn: (vars: {
      id: string;
      inputs: Record<string, unknown>;
      model?: string;
    }) =>
      api.post<{ session_id: string; status: string }>(
        API.SAVED_AGENTS.RUN(vars.id),
        { inputs: vars.inputs, model: vars.model },
      ),
  });
}

export function useDeleteSavedAgent(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(API.SAVED_AGENTS.DELETE(id)),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.savedAgents.all(workspace) }),
  });
}
