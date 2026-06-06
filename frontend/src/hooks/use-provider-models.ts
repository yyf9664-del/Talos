"use client";

import { useMemo } from "react";
import { useModels } from "@/hooks/use-models";
import { useSettingsStore } from "@/stores/settings-store";
import {
  INTERNAL_MODEL_ONLY,
  INTERNAL_PROVIDER_ID,
} from "@/lib/internal-model";
import {
  isByokProviderId,
  isCustomEndpointProviderId,
  providerBucket,
} from "@/lib/providers";

export function useProviderModels() {
  const { data: allModels, isLoading, isError, error } = useModels();
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const effectiveActiveProvider = INTERNAL_MODEL_ONLY
    ? providerBucket(INTERNAL_PROVIDER_ID)
    : activeProvider;

  const data = useMemo(() => {
    if (!allModels) return [];

    if (INTERNAL_MODEL_ONLY) {
      return allModels.filter((m) => m.provider_id === INTERNAL_PROVIDER_ID);
    }

    if (!effectiveActiveProvider) return [];

    if (effectiveActiveProvider === "byok") {
      // "byok" mode: show models from all BYOK providers
      // (everything except subscription, Ollama, and custom/local endpoints)
      return allModels.filter((m) => isByokProviderId(m.provider_id));
    }

    if (effectiveActiveProvider === "custom") {
      return allModels.filter((m) => isCustomEndpointProviderId(m.provider_id));
    }

    if (effectiveActiveProvider === "chatgpt") {
      return allModels.filter((m) => m.provider_id === "openai-subscription");
    }

    if (effectiveActiveProvider === "ollama") {
      return allModels.filter((m) => m.provider_id === "ollama");
    }

    if (effectiveActiveProvider === "rapid-mlx") {
      return allModels.filter((m) => m.provider_id === "rapid-mlx");
    }

    return [];
  }, [allModels, effectiveActiveProvider]);

  return { data, allModels, isLoading, isError, error, activeProvider: effectiveActiveProvider };
}
