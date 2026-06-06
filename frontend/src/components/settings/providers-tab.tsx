"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CreditCard,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  X,
  Zap,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/stores/settings-store";
import { api, ApiError } from "@/lib/api";
import { errorToMessage } from "@/lib/errors";
import { API, queryKeys } from "@/lib/constants";
import {
  INTERNAL_MODEL_LABEL,
  INTERNAL_MODEL_ONLY,
  INTERNAL_PROVIDER_ID,
} from "@/lib/internal-model";
import {
  isByokProviderId,
  isCustomEndpointProviderId,
  providerBucket,
} from "@/lib/providers";
import { useModels } from "@/hooks/use-models";
import type {
  ApiKeyStatus,
  LocalProviderStatus,
  ProviderInfo,
} from "@/types/usage";
import type { ModelInfo } from "@/types/model";
import { OllamaPanel } from "@/components/settings/ollama-panel";
import { RapidMLXPanel } from "@/components/settings/rapid-mlx-panel";
import { ByokPanel } from "@/components/settings/providers/byok-panel";
import { ChatGPTSubPanel } from "@/components/settings/providers/chatgpt-sub-panel";
import { CustomEndpointPanel } from "@/components/settings/providers/custom-endpoint-panel";

type ProviderMode = "byok" | "chatgpt" | "ollama" | "rapid-mlx" | "custom";

interface OpenAISubscriptionStatus {
  is_connected: boolean;
}
interface OllamaRuntimeStatus {
  binary_installed: boolean;
  running: boolean;
}
interface RapidMLXRuntimeStatus {
  running: boolean;
}

function extractApiDetail(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  return errorToMessage(err, fallback);
}

function pickModelForMode(
  mode: ProviderMode,
  models: ModelInfo[] | undefined,
): ModelInfo | null {
  if (!models || models.length === 0) return null;
  if (mode === "byok") {
    return models.find((m) => isByokProviderId(m.provider_id)) ?? null;
  }
  if (mode === "chatgpt") {
    return (
      models.find((m) => m.provider_id === "openai-subscription") ?? null
    );
  }
  if (mode === "ollama") {
    return models.find((m) => m.provider_id === "ollama") ?? null;
  }
  if (mode === "rapid-mlx") {
    return models.find((m) => m.provider_id === "rapid-mlx") ?? null;
  }
  if (mode === "custom") {
    return models.find((m) => isCustomEndpointProviderId(m.provider_id)) ?? null;
  }
  return null;
}

interface CompanyGatewayPanelProps {
  provider: ProviderInfo | undefined;
  modelCount: number;
  onSaved: () => void;
}

function CompanyGatewayPanel({
  provider,
  modelCount,
  onSaved,
}: CompanyGatewayPanelProps) {
  const { t } = useTranslation("settings");
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateKey = useMutation({
    mutationFn: async (nextKey: string) => {
      if (!provider) throw new Error("Company gateway is not configured");
      if (isCustomEndpointProviderId(provider.id)) {
        return api.patch<ProviderInfo>(API.CONFIG.CUSTOM_ENDPOINT_ITEM(provider.id), {
          api_key: nextKey,
        });
      }
      return api.post<ProviderInfo>(API.CONFIG.PROVIDER_KEY(provider.id), {
        api_key: nextKey,
      });
    },
    onSuccess: () => {
      setApiKey("");
      setError(null);
      onSaved();
      qc.invalidateQueries({ queryKey: queryKeys.providers });
      qc.invalidateQueries({ queryKey: queryKeys.models });
    },
    onError: (err) => {
      setError(
        extractApiDetail(
          err,
          t("failedSaveKey", { defaultValue: "Failed to save key" }),
        ),
      );
    },
  });

  const connected = provider?.status === "connected" && provider.enabled;
  const submitDisabled = !provider || !apiKey.trim() || updateKey.isPending;

  return (
    <div className="space-y-5">
      <p className="text-xs text-[var(--text-tertiary)] -mt-1">
        使用公司预设网关，输入你的内部 API Key 后即可使用。模型可在聊天页顶部下拉框中选择。
      </p>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)]">
            <Cpu className="h-5 w-5 text-[var(--text-secondary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {provider?.name || INTERNAL_MODEL_LABEL}
              </p>
              <span className="rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-ui-3xs font-medium text-[var(--text-secondary)]">
                固定
              </span>
              {connected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-ui-3xs font-medium text-[var(--color-success)]">
                  <Check className="h-3 w-3" />
                  已连接
                </span>
              )}
            </div>
            <p className="text-ui-2xs text-[var(--text-tertiary)] mt-1">
              {modelCount > 0
                ? `可用模型 ${modelCount} 个`
                : "保存 Key 后将从公司网关加载可用模型"}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-[var(--border-default)]" />

        {/* API Key field */}
        <label className="block text-ui-2xs font-medium text-[var(--text-secondary)] mb-1.5">
          内部 API Key
        </label>

        {provider?.masked_key && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <Check className="h-3.5 w-3.5 text-[var(--color-success)]" />
            <span className="font-mono text-[var(--text-secondary)]">
              {provider.masked_key}
            </span>
            <button
              type="button"
              onClick={() => updateKey.mutate("")}
              disabled={updateKey.isPending}
              className="ml-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--color-destructive)]"
              title={t("removeApiKey")}
            >
              {updateKey.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="请输入内部 API Key"
                className="pr-8 font-mono text-xs"
                autoComplete="one-time-code"
                data-form-type="other"
                disabled={!provider}
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                disabled={!provider}
              >
                {showKey ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-destructive)]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <Button
            onClick={() => updateKey.mutate(apiKey.trim())}
            disabled={submitDisabled}
          >
            {updateKey.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t("save")
            )}
          </Button>
        </div>

        {!provider && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-destructive)]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>未找到公司网关配置，请检查后端 custom endpoint 配置。</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProvidersTab() {
  const { t } = useTranslation("settings");
  const {
    activeProvider,
    selectedModel,
    selectedProviderId,
    setActiveProvider,
    setSelectedModel,
  } = useSettingsStore();

  const [viewingProvider, setViewingProvider] = useState<ProviderMode>(
    () => (activeProvider as ProviderMode) ?? "byok",
  );
  const [mounted, setMounted] = useState(false);

  const { data: allModels } = useModels();

  const { data: keyStatus } = useQuery({
    queryKey: queryKeys.apiKeyStatus,
    queryFn: () => api.get<ApiKeyStatus>(API.CONFIG.API_KEY),
  });
  const { data: providers } = useQuery({
    queryKey: queryKeys.providers,
    queryFn: () => api.get<ProviderInfo[]>(API.CONFIG.PROVIDERS),
  });
  const { data: localStatus } = useQuery({
    queryKey: queryKeys.localProvider,
    queryFn: () => api.get<LocalProviderStatus>(API.CONFIG.LOCAL_PROVIDER),
  });
  const { data: openaiSubStatus } = useQuery({
    queryKey: queryKeys.openaiSubscription,
    queryFn: () =>
      api.get<OpenAISubscriptionStatus>(API.CONFIG.OPENAI_SUBSCRIPTION),
  });
  const { data: ollamaRuntimeStatus } = useQuery({
    queryKey: ["ollamaRuntime"],
    queryFn: () => api.get<OllamaRuntimeStatus>(API.OLLAMA.STATUS),
  });
  const { data: rapidMlxRuntimeStatus } = useQuery({
    queryKey: ["rapidMlxRuntime"],
    queryFn: () => api.get<RapidMLXRuntimeStatus>(API.RAPID_MLX.STATUS),
    retry: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!INTERNAL_MODEL_ONLY) return;
    const internalProviderMode = providerBucket(INTERNAL_PROVIDER_ID);
    if (activeProvider !== internalProviderMode) {
      setActiveProvider(internalProviderMode);
    }
    const internalModels =
      allModels?.filter((m) => m.provider_id === INTERNAL_PROVIDER_ID) ?? [];
    const selectedStillAvailable = internalModels.some(
      (m) => m.id === selectedModel && m.provider_id === selectedProviderId,
    );
    if (!selectedStillAvailable) {
      const first = internalModels[0];
      setSelectedModel(first?.id ?? null, first?.provider_id ?? null);
    }
  }, [
    activeProvider,
    allModels,
    selectedModel,
    selectedProviderId,
    setActiveProvider,
    setSelectedModel,
  ]);

  const activateProviderMode = (mode: ProviderMode) => {
    setActiveProvider(mode);
    const picked = pickModelForMode(mode, allModels);
    if (picked) {
      useSettingsStore
        .getState()
        .setSelectedModel(picked.id, picked.provider_id);
    }
  };

  const fallbackToOtherProviders = () => {
    if (openaiSubStatus?.is_connected) {
      setActiveProvider("chatgpt");
    } else if (rapidMlxRuntimeStatus?.running) {
      setActiveProvider("rapid-mlx");
    } else if (
      localStatus?.is_connected ||
      (providers ?? []).some(
        (p) => p.id.startsWith("custom_") && p.is_configured,
      )
    ) {
      setActiveProvider("custom");
    } else if (
      keyStatus?.is_configured ||
      (providers ?? []).some((p) => p.is_configured)
    ) {
      setActiveProvider("byok");
    } else {
      setActiveProvider(null);
    }
  };

  const ollamaConnected = !!ollamaRuntimeStatus?.running;
  const rapidMlxConnected = !!rapidMlxRuntimeStatus?.running;
  const customConnected =
    !!localStatus?.is_connected ||
    (providers ?? []).some(
      (p) => p.id.startsWith("custom_") && p.is_configured,
    );

  const modes: Array<{
    mode: ProviderMode;
    label: string;
    icon: typeof Eye;
    connected: boolean;
  }> = [
    {
      mode: "byok",
      label: t("ownApiKey"),
      icon: Eye,
      connected:
        !!keyStatus?.is_configured ||
        (providers ?? []).some(
          (p) => p.is_configured && !p.id.startsWith("custom_"),
        ),
    },
    {
      mode: "chatgpt",
      label: t("chatgptSubscription"),
      icon: CreditCard,
      connected: !!openaiSubStatus?.is_connected,
    },
    { mode: "ollama", label: "Ollama", icon: Cpu, connected: ollamaConnected },
    {
      mode: "rapid-mlx",
      label: "Rapid-MLX",
      icon: Zap,
      connected: rapidMlxConnected,
    },
    {
      mode: "custom",
      label: t("customEndpoint"),
      icon: Plug,
      connected: customConnected,
    },
  ];

  if (INTERNAL_MODEL_ONLY) {
    const companyProvider = providers?.find(
      (p) => p.id === INTERNAL_PROVIDER_ID,
    );
    const internalModels =
      allModels?.filter((m) => m.provider_id === INTERNAL_PROVIDER_ID) ?? [];
    const modelCount = internalModels.length || companyProvider?.model_count || 0;

    return (
      <CompanyGatewayPanel
        provider={companyProvider}
        modelCount={modelCount}
        onSaved={() => {
          setActiveProvider(providerBucket(INTERNAL_PROVIDER_ID));
          const first = internalModels[0];
          if (first) setSelectedModel(first.id, first.provider_id);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-[var(--text-secondary)]">
        {t("providerModeDesc")}
      </p>

      {/* Provider cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {modes.map(({ mode, label, icon: Icon, connected }) => (
          <button
            key={mode}
            onClick={() => {
              setViewingProvider(mode);
              if (connected) activateProviderMode(mode);
            }}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors relative ${
              viewingProvider === mode
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                : "border-[var(--border-default)] hover:bg-[var(--surface-secondary)]"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium text-center leading-tight">
              {label}
            </span>
            {mounted && connected && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-success)]" />
            )}
            {activeProvider === mode && mounted && connected && (
              <span className="absolute bottom-1 text-ui-3xs font-medium text-[var(--brand-primary)]">
                {t("activeProvider")}
              </span>
            )}
          </button>
        ))}
      </div>

      {viewingProvider === "byok" && (
        <ByokPanel
          providers={providers}
          onSaved={() => activateProviderMode("byok")}
        />
      )}
      {viewingProvider === "chatgpt" && (
        <ChatGPTSubPanel keyStatus={keyStatus} />
      )}
      {viewingProvider === "ollama" && <OllamaPanel />}
      {viewingProvider === "rapid-mlx" && <RapidMLXPanel />}
      {viewingProvider === "custom" && (
        <CustomEndpointPanel
          providers={providers}
          localStatus={localStatus}
          onLocalDeleted={() => {
            if (activeProvider === "custom") fallbackToOtherProviders();
          }}
        />
      )}
    </div>
  );
}
