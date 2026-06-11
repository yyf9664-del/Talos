"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API, queryKeys } from "@/lib/constants";
import type { SavedAgent } from "@/types/saved-agent";

export function useSavedAgents() {
  return useQuery({
    queryKey: queryKeys.savedAgents.all(),
    queryFn: () => api.get<SavedAgent[]>(API.SAVED_AGENTS.LIST()),
  });
}

export function useRunSavedAgent() {
  return useMutation({
    mutationFn: (vars: {
      id: string;
      inputs: Record<string, unknown>;
      model?: string;
      provider_id?: string;
    }) =>
      api.post<{ session_id: string; stream_id: string; status: string }>(
        API.SAVED_AGENTS.RUN(vars.id),
        { inputs: vars.inputs, model: vars.model, provider_id: vars.provider_id },
      ),
  });
}

export function useDeleteSavedAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(API.SAVED_AGENTS.DELETE(id)),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.savedAgents.all() }),
  });
}
