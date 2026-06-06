"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Plug,
  Plus,
  RotateCw,
  Search,
  Unplug,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { API, IS_DESKTOP, queryKeys } from "@/lib/constants";
import { desktopAPI } from "@/lib/tauri-api";
import {
  useConnectors,
  useConnectorToggle,
  useConnectorConnect,
  useConnectorDisconnect,
  useConnectorReconnect,
  useAddCustomConnector,
  useSetConnectorToken,
} from "@/hooks/use-connectors";
import type { ConnectorInfo } from "@/types/connectors";

/** Derive i18n key from category slug: "dev-tools" → "category_dev_tools" */
const categoryKey = (cat: string) => `category_${cat.replace(/-/g, "_")}`;

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-emerald-500",
  needs_auth: "bg-amber-500",
  failed: "bg-red-500",
  disconnected: "bg-[var(--text-tertiary)]",
  disabled: "bg-[var(--text-tertiary)]",
};

type Filter = "all" | "connected" | "custom";

const CATEGORY_ORDER = [
  "communication", "productivity", "dev-tools", "design", "crm",
  "analytics", "marketing", "sales", "data", "legal", "operations",
  "knowledge", "bio-research", "custom", "other",
];

export function ConnectorsContent() {
  const { t } = useTranslation("plugins");
  const { data, isLoading } = useConnectors();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  const entries = useMemo(() => Object.entries(data?.connectors ?? {}), [data]);

  const connectedCount = entries.filter(([, c]) => c.status === "connected").length;
  const customCount = entries.filter(([, c]) => c.source === "custom").length;

  // Categories present in the data, sorted by the canonical order.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const [, c] of entries) set.add(c.category || "other");
    return Array.from(set).sort(
      (a, b) => (CATEGORY_ORDER.indexOf(a) ?? 99) - (CATEGORY_ORDER.indexOf(b) ?? 99),
    );
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(([id, c]) => {
      if (filter === "connected" && c.status !== "connected") return false;
      if (filter === "custom" && c.source !== "custom") return false;
      if (activeCategory !== "all" && (c.category || "other") !== activeCategory) return false;
      if (q) {
        return (
          id.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entries, search, filter, activeCategory]);

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filterAll"), count: entries.length },
    { key: "connected", label: t("filterConnected"), count: connectedCount },
    { key: "custom", label: t("filterCustom"), count: customCount },
  ];

  return (
    <div className="space-y-5">
      {/* Description */}
      <p className="text-xs text-[var(--text-tertiary)] -mt-1">
        {t("connectorsDescription")}
      </p>

      {/* Search + Add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("connectorsSearchPlaceholder")}
            className="w-full h-10 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
          />
        </div>
        <Button
          variant="outline"
          className="h-10 px-3.5 text-xs shrink-0"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("add")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-default)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filter === tab.key
                ? "border-[var(--brand-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
            <span
              className={`text-ui-3xs px-1.5 py-0.5 rounded-full ${
                filter === tab.key
                  ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                  : "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {showAdd && <AddConnectorForm onClose={() => setShowAdd(false)} />}

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {["all", ...categories].map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-ui-2xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--brand-primary)] text-[var(--brand-primary-text)]"
                    : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)]"
                }`}
              >
                {cat === "all" ? t("filterAll") : t(categoryKey(cat), cat)}
              </button>
            );
          })}
        </div>
      )}

      {/* Card grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-[var(--surface-tertiary)] animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-12">
          {t("noConnectors")}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(([id, connector]) => (
            <ConnectorCard key={id} id={id} connector={connector} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectorCard({
  id,
  connector,
}: {
  id: string;
  connector: ConnectorInfo;
}) {
  const { t } = useTranslation("plugins");
  const toggle = useConnectorToggle();
  const connect = useConnectorConnect();
  const disconnect = useConnectorDisconnect();
  const reconnect = useConnectorReconnect();
  const setToken = useSetConnectorToken();
  const [tokenInput, setTokenInput] = useState("");

  const isPending =
    toggle.isPending || connect.isPending || disconnect.isPending || reconnect.isPending;

  const qc = useQueryClient();

  const handleConnect = async () => {
    let result: { success: boolean; auth_url?: string; state?: string; error?: string };
    try {
      const isGoogle = id === "google-workspace";
      result = isGoogle
        ? await api.post<{ success: boolean; auth_url?: string; state?: string; error?: string }>(API.GOOGLE.AUTH_START)
        : await connect.mutateAsync(id);
    } catch {
      return;
    }

    if (result.success && result.auth_url) {
      if (IS_DESKTOP) {
        await desktopAPI.openExternal(result.auth_url);
        const poll = setInterval(async () => {
          await qc.invalidateQueries({ queryKey: queryKeys.connectors });
        }, 3000);
        setTimeout(() => clearInterval(poll), 300_000);
      } else {
        const popup = window.open(
          result.auth_url,
          "connector-auth",
          "width=600,height=700,menubar=no,toolbar=no",
        );
        const handler = (event: MessageEvent) => {
          if (
            event.data?.type === "connector-auth-complete" ||
            event.data?.type === "mcp-auth-complete"
          ) {
            window.removeEventListener("message", handler);
            qc.invalidateQueries({ queryKey: queryKeys.connectors });
          }
        };
        window.addEventListener("message", handler);
        if (popup) {
          const timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer);
              window.removeEventListener("message", handler);
              qc.invalidateQueries({ queryKey: queryKeys.connectors });
            }
          }, 1000);
        }
      }
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 transition-colors hover:border-[var(--border-heavy)]">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)]">
          <Plug className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {connector.name}
            </span>
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                STATUS_COLORS[connector.status] ?? STATUS_COLORS.disconnected
              }`}
            />
          </div>
          <p className="text-ui-2xs text-[var(--text-tertiary)] line-clamp-2 mt-0.5">
            {connector.description}
          </p>
        </div>

        <Switch
          checked={connector.enabled}
          onCheckedChange={async (checked) => {
            await toggle.mutateAsync({ id, enable: checked });
            if (checked && (connector.type === "remote" || id === "google-workspace")) {
              await new Promise((r) => setTimeout(r, 500));
              await qc.invalidateQueries({ queryKey: queryKeys.connectors });
              handleConnect();
            } else if (checked) {
              await new Promise((r) => setTimeout(r, 1000));
              await qc.invalidateQueries({ queryKey: queryKeys.connectors });
            }
          }}
          disabled={toggle.isPending}
          className="shrink-0"
        />
      </div>

      {/* Footer: tags + actions */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-ui-3xs px-1.5 py-0.5 rounded-full bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
            {connector.type === "remote" ? t("remote") : t("localSetup")}
          </span>
          {connector.source === "custom" && (
            <span className="text-ui-3xs px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500">
              {t("custom")}
            </span>
          )}
          {connector.status === "connected" && connector.tools_count > 0 && (
            <span className="text-ui-3xs text-[var(--text-tertiary)]">
              {connector.tools_count} {t("tools")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {connector.status === "needs_auth" && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-ui-3xs px-2"
              onClick={handleConnect}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              <span className="ml-1">{t("connect")}</span>
            </Button>
          )}

          {connector.status === "connected" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-ui-3xs px-1.5 text-[var(--text-tertiary)]"
              onClick={() => disconnect.mutate(id)}
              disabled={isPending}
              title={t("disconnect")}
            >
              <Unplug className="h-3 w-3" />
            </Button>
          )}

          {connector.status === "failed" && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-ui-3xs px-2"
              onClick={() => reconnect.mutate(id)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCw className="h-3 w-3" />
              )}
              <span className="ml-1">{t("retry")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Token entry for connectors that need a PAT */}
      {(connector.status === "needs_auth" || connector.status === "failed") && connector.enabled && (
        <form
          className="mt-2 flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (tokenInput.trim()) {
              setToken.mutate({ id, token: tokenInput.trim() });
              setTokenInput("");
            }
          }}
        >
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={t("tokenPatPlaceholder")}
            className="h-6 flex-1 rounded border border-[var(--border-default)] bg-transparent px-1.5 text-ui-3xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-6 text-ui-3xs px-2"
            disabled={!tokenInput.trim() || setToken.isPending}
          >
            {setToken.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
          </Button>
        </form>
      )}
    </div>
  );
}

function AddConnectorForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("plugins");
  const addConnector = useAddCustomConnector();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await addConnector.mutateAsync({ id, name, url });
    onClose();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] p-3 space-y-2.5"
    >
      <h4 className="text-xs font-semibold text-[var(--text-primary)]">
        {t("addConnector")}
      </h4>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("connectorName")}
        className="w-full h-7 rounded-md border border-[var(--border-default)] bg-transparent px-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
        required
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://mcp.example.com/mcp"
        className="w-full h-7 rounded-md border border-[var(--border-default)] bg-transparent px-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
        required
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-ui-2xs" onClick={onClose} type="button">
          {t("cancel")}
        </Button>
        <Button size="sm" className="h-7 text-ui-2xs" type="submit" disabled={addConnector.isPending}>
          {addConnector.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          {t("add")}
        </Button>
      </div>
    </form>
  );
}
